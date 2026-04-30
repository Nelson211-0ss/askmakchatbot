const OpenAI = require('openai');

let client;

function normalizeApiKey(raw) {
    let k = (raw || '').replace(/^\ufeff/, '').trim();
    if (
        (k.startsWith('"') && k.endsWith('"')) ||
        (k.startsWith("'") && k.endsWith("'"))
    ) {
        k = k.slice(1, -1).trim();
    }
    return k;
}

function getOpenAIClient() {
    const apiKey = normalizeApiKey(process.env.OPENAI_API_KEY);
    if (!apiKey) {
        throw new Error(
            'OPENAI_API_KEY is not set. Add it to your .env file (see .env.example if present).'
        );
    }
    if (!client) client = new OpenAI({ apiKey });
    return client;
}

function hasOpenAIApiKey() {
    return Boolean(normalizeApiKey(process.env.OPENAI_API_KEY));
}

module.exports = { getOpenAIClient, hasOpenAIApiKey };
