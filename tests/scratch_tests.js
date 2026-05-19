const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const db = require('../backend/config/db');
const { getOpenAIClient } = require('../backend/services/openaiClient');

async function test() {
    console.log('--- Testing Database ---');
    try {
        const userRes = await db.query('SELECT id, email, role, full_name FROM users WHERE email = $1', ['alvinmuwanguzi1@gmail.com']);
        const user = userRes.rows[0];
        console.log('User:', user);
        
        const chatRes = await db.query('SELECT id, title FROM chats WHERE user_id = $1 LIMIT 1', [user.id]);
        let chatId;
        if (chatRes.rows.length) {
            chatId = chatRes.rows[0].id;
            console.log('Existing Chat:', chatRes.rows[0]);
        } else {
            const newChat = await db.query('INSERT INTO chats (user_id, title) VALUES ($1, $2) RETURNING id', [user.id, 'Test Chat']);
            chatId = newChat.rows[0].id;
            console.log('Created Chat:', chatId);
        }

        console.log('\n--- Testing streamResponse ---');
        const { streamResponse } = require('../backend/services/openai');
        const streamResult = await streamResponse(
            chatId,
            'Can i get more clarity on ACMIS portal login?',
            user.id,
            null,
            (data) => {
                console.log('SSE Stream Chunk:', data);
            }
        );
        console.log('streamResponse Result:', streamResult);
    } catch (e) {
        console.error('Database/Stream Error:', e.stack || e.message);
    }

    console.log('\n--- Testing OpenAI Connection ---');
    try {
        const openai = getOpenAIClient();
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: 'test connection' }],
            max_tokens: 5
        });
        console.log('OpenAI Query Success:', response.choices[0].message.content);
    } catch (e) {
        console.error('OpenAI Query Error:', e.message);
    }

    process.exit(0);
}

test();
