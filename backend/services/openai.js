const db = require('../config/db');
const storage = require('./storage');
const { hybridSearch, formatContextForLLM } = require('./embedding');
const { getToolSchemas, executeToolCall } = require('./mcp/registry');
const { stripLatestUserTurn, buildStandaloneSearchQuery } = require('./searchQuery');
const { logRetrieval } = require('./ragLog');
const { getOpenAIClient } = require('./openaiClient');

function buildSystemPrompt(memories = [], opts = {}) {
    const isGuest = opts.isGuest === true;
    let prompt = `You are **AskMak**, a **dedicated Makerere University end-user support assistant**. You are **not** a general-purpose chatbot, **not** ChatGPT, and **not** here for open-ended conversation, homework, coding, creative writing, medical/legal advice, news, politics, entertainment, or knowledge about other universities or countries unless the user only needs **which office at Makerere** might relate to their situation.

**Strict perimeter (must follow):**
- **Only** respond to requests that are **clearly about Makerere University** end-user support: the same kind of help as this app’s **quick-access topics** (e.g. ACMIS, webmail, Wi‑Fi, MUELE, passwords and account recovery, fees as shown on university systems, admissions **process/portal** basics, course registration on university systems, contacting ICT/support). You may use tools **only** to support answers **inside** this perimeter (e.g. Makerere / mak.ac.ug information, KB search, reference images that help a support answer).
- If the user asks about **anything outside** Makerere end-user support—or anything **generic** with no Makerere tie-in—**do not** answer the substance. Reply in **one or two short sentences**: you are **only** for Makerere support, and invite them to ask something about **portals, ICT, fees/balance on university systems, registration, admissions steps, or support tickets**. **No** apologies that enable off-topic help, **no** “here’s a general answer anyway”, **no** tips, **no** lists of facts unrelated to Makerere.
- If the question mixes Makerere with off-topic content, **only** address the Makerere part (if any); **ignore** the rest and you may say the rest is outside your role.
- **Grounding:** Treat fees, dates, policies, programme names, and procedures as **unknown** unless they appear in the **knowledge base context**, **tool results**, or an **official mak.ac.ug page** you retrieved for this support task. Never invent Makerere facts.
- **Support tickets (signed-in users only):** When staff help or a formal ticket is appropriate and the user **is signed in**, **always include** this markdown link: \`[Submit a support ticket](#support-ticket)\`. Do **not** tell users to hunt for a "Can't find your answer" button without a link. If they say they want to submit a ticket and they are **signed in**, reply briefly and include that link. Do **not** treat external ticketing sites as the default unless the KB or an official page you fetched explicitly says so.
- **Quick access (topic picker):** For **in-scope** substantive answers (not for pure perimeter refusals or one-line redirects), **always end** with a separate short line that includes this exact markdown link so they can pick another ICT topic from the app picker: \`[Choose another quick-access topic](#quick-topics)\`. You may tweak the link text slightly (e.g. “Pick another quick-access topic”) but keep the **\`#quick-topics\`** href exactly — do not invent other fragment links for this.
- **Sources:** When you use KB or tool text, name the source. If you have no citable support for a Makerere-specific claim, do not state it as fact.

**Tone and format:**
- Professional, concise, **markdown** where useful. For **in-scope** substantive answers (not for pure refusals), you may end with **one short sentence** suggesting a **related Makerere support** angle—never invent dates, amounts, or policies in that sentence. When you also include the **\`#quick-topics\`** link (required for those answers), that link line satisfies the “related next step” expectation unless a **ticket link** is more appropriate for the situation.
- Avoid generic assistant clichés (e.g. “Let me know if you need anything else”, “happy to help further”) unless you are also giving a concrete **Makerere** next step or the **ticket link**.
- Simple greetings: briefly greet and state you help with **Makerere end-user support** only; if they then go off-topic, refuse per above.

Available tools (use **only** for Makerere support tasks):
- Search the knowledge base; fetch **mak.ac.ug** pages when needed for support; reference images when they help a support answer; user context when personalized Makerere support is appropriate.`;

    if (isGuest) {
        prompt += `

**Guest session (this user is not signed in — applies to this chat):**
- **Support tickets** can only be used after they **register and sign in** to a student account on this app.
- Whenever staff follow-up, a ticket, or email updates from administrators are needed, **clearly say** they should **[Sign up](/signup.html)** to create an account (or **[Log in](/login.html)** if they already have one). **After** they are signed in, they can open \`[Submit a support ticket](#support-ticket)\`.
- **Do not** present the ticket link as if it will work while they stay in guest mode; explain that **account creation / login is required first** for ticket submission through this system.
- You may still answer in-scope Makerere support questions from the KB for guests.`;
    }

    if (memories.length) {
        prompt += '\n\nWhat you know about this user:\n';
        memories.forEach(m => {
            prompt += `- ${m.memory_key}: ${m.memory_value}\n`;
        });
    }

    return prompt;
}

async function getUserMemories(userId) {
    if (!userId) return [];
    const result = await db.query(
        'SELECT memory_key, memory_value FROM user_memories WHERE user_id = $1',
        [userId]
    );
    return result.rows;
}

async function getChatHistory(chatId, limit = 8) {
    const result = await db.query(
        `SELECT role, content, image_key FROM messages
         WHERE chat_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [chatId, limit]
    );
    return result.rows.reverse();
}

async function buildMessages(chatId, userContent, userId, imageKey) {
    const history = await getChatHistory(chatId, 12);
    return buildMessagesFromHistory(history, userContent, userId, imageKey);
}

async function buildMessagesFromHistory(history, userContent, userId, imageKey) {
    const memories = await getUserMemories(userId);
    const priorForPrompt = stripLatestUserTurn(history, userContent, imageKey);
    const searchQuery = buildStandaloneSearchQuery(priorForPrompt, userContent);

    const isSimple = /^(hi|hello|hey|thanks|thank you|bye|ok|okay)$/i.test((userContent || '').trim());
    let ragContext = '';
    let retrieval = null;
    let documents = [];

    if (!isSimple) {
        const searchResult = await hybridSearch(searchQuery, { limit: 5 });
        documents = searchResult.documents;
        retrieval = searchResult.retrieval;
        ragContext = formatContextForLLM(documents, retrieval);
    }

    const messages = [];
    let systemContent = buildSystemPrompt(memories, { isGuest: !userId });
    if (ragContext) {
        systemContent += '\n\nRelevant knowledge base context:\n' + ragContext;
    }

    messages.push({ role: 'system', content: systemContent });

    for (const msg of priorForPrompt) {
        if (msg.role === 'user' && msg.image_key) {
            const url = await storage.getPresignedUrl(process.env.MINIO_BUCKET_UPLOADS, msg.image_key);
            messages.push({
                role: 'user',
                content: [
                    { type: 'text', text: msg.content },
                    { type: 'image_url', image_url: { url } }
                ]
            });
        } else {
            messages.push({ role: msg.role, content: msg.content });
        }
    }

    if (imageKey) {
        const imageUrl = await storage.getPresignedUrl(process.env.MINIO_BUCKET_UPLOADS, imageKey);
        messages.push({
            role: 'user',
            content: [
                { type: 'text', text: userContent },
                { type: 'image_url', image_url: { url: imageUrl } }
            ]
        });
    } else {
        messages.push({ role: 'user', content: userContent });
    }

    return {
        messages,
        searchQuery: isSimple ? null : searchQuery,
        retrieval: isSimple ? null : retrieval,
        documentCount: documents.length,
        ragSkipped: isSimple
    };
}

function sanitizeGuestHistory(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const m of raw.slice(-24)) {
        if (!m || typeof m !== 'object') continue;
        if (m.role !== 'user' && m.role !== 'assistant') continue;
        const content = String(m.content || '').trim().slice(0, 8000);
        if (!content) continue;
        out.push({ role: m.role, content, image_key: null });
    }
    return out;
}

async function streamResponseEphemeral(priorHistory, userContent, userId, imageKey, onData) {
    const history = sanitizeGuestHistory(priorHistory);
    const built = await buildMessagesFromHistory(history, userContent, userId, imageKey);
    const { messages, searchQuery, retrieval, ragSkipped, documentCount } = built;

    logRetrieval({
        chat_id: null,
        user_message: (userContent || '').substring(0, 500),
        search_query: searchQuery,
        best_strength: retrieval?.bestStrength,
        passed_threshold: retrieval?.passedThreshold,
        threshold: retrieval?.threshold,
        document_count: documentCount,
        rag_skipped: ragSkipped
    });

    return runCompletionStream(messages, userContent, userId, retrieval, ragSkipped, onData);
}

async function streamResponse(chatId, userContent, userId, imageKey, onData) {
    const built = await buildMessages(chatId, userContent, userId, imageKey);
    const { messages, searchQuery, retrieval, ragSkipped, documentCount } = built;

    logRetrieval({
        chat_id: chatId,
        user_message: (userContent || '').substring(0, 500),
        search_query: searchQuery,
        best_strength: retrieval?.bestStrength,
        passed_threshold: retrieval?.passedThreshold,
        threshold: retrieval?.threshold,
        document_count: documentCount,
        rag_skipped: ragSkipped
    });

    return runCompletionStream(messages, userContent, userId, retrieval, ragSkipped, onData);
}

async function runCompletionStream(messages, userContent, userId, retrieval, ragSkipped, onData) {
    const tools = getToolSchemas();

    let fullContent = '';
    let tokensUsed = 0;
    let sources = [];
    let toolCallDepth = 0;
    const maxToolDepth = 3;

    async function callOpenAI(msgs) {
        const stream = await getOpenAIClient().chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o',
            messages: msgs,
            tools: tools.length ? tools : undefined,
            stream: true
        });

        let currentToolCalls = [];
        let pendingToolCall = { id: '', name: '', args: '' };

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            const finishReason = chunk.choices[0]?.finish_reason;

            if (delta?.content) {
                fullContent += delta.content;
                onData({ type: 'delta', content: delta.content });
            }

            if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                    if (tc.id) {
                        if (pendingToolCall.id) {
                            currentToolCalls.push({ ...pendingToolCall });
                        }
                        pendingToolCall = { id: tc.id, name: tc.function?.name || '', args: tc.function?.arguments || '' };
                    } else {
                        if (tc.function?.name) pendingToolCall.name += tc.function.name;
                        if (tc.function?.arguments) pendingToolCall.args += tc.function.arguments;
                    }
                }
            }

            if (finishReason === 'tool_calls') {
                if (pendingToolCall.id) currentToolCalls.push({ ...pendingToolCall });

                if (toolCallDepth >= maxToolDepth) {
                    msgs.push({ role: 'assistant', content: 'I was unable to complete the tool lookup. Let me answer based on what I know.' });
                    return callOpenAI(msgs);
                }

                toolCallDepth++;
                const toolMessage = { role: 'assistant', content: null, tool_calls: [] };

                for (const call of currentToolCalls) {
                    toolMessage.tool_calls.push({
                        id: call.id,
                        type: 'function',
                        function: { name: call.name, arguments: call.args }
                    });
                }

                msgs.push(toolMessage);

                for (const call of currentToolCalls) {
                    let args = {};
                    try { args = JSON.parse(call.args); } catch {}

                    let result;
                    try {
                        result = await executeToolCall(call.name, args, userId);
                        if (result.sources) sources.push(...result.sources);
                    } catch (err) {
                        result = { error: err.message };
                    }

                    msgs.push({
                        role: 'tool',
                        tool_call_id: call.id,
                        content: JSON.stringify(result)
                    });
                }

                currentToolCalls = [];
                pendingToolCall = { id: '', name: '', args: '' };
                return callOpenAI(msgs);
            }

            if (chunk.usage) {
                tokensUsed = chunk.usage.total_tokens || 0;
            }
        }
    }

    await callOpenAI(messages);

    const confidenceScore =
        ragSkipped || !retrieval ? null : Math.round((retrieval.bestStrength + Number.EPSILON) * 1000) / 1000;

    return { content: fullContent, tokensUsed, sources, confidenceScore };
}

async function generateTitle(content) {
    try {
        const response = await getOpenAIClient().chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'Generate a concise 4-6 word title for this conversation. Return only the title, no quotes.' },
                { role: 'user', content: content.substring(0, 200) }
            ],
            max_tokens: 20
        });
        return response.choices[0].message.content.trim();
    } catch {
        return content.substring(0, 50);
    }
}

module.exports = { streamResponse, streamResponseEphemeral, generateTitle };
