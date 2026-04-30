const OpenAI = require('openai');

let client;

function getOpenAIClient() {
    const apiKey = (process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) {
        throw new Error(
            'OPENAI_API_KEY is not set. Add it to your .env file (see .env.example if present).'
        );
    }
    if (!client) client = new OpenAI({ apiKey });
    return client;
}

function hasOpenAIApiKey() {
    return Boolean((process.env.OPENAI_API_KEY || '').trim());
}

module.exports = { getOpenAIClient, hasOpenAIApiKey };
