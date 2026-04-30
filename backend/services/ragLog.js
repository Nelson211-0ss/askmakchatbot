const fs = require('fs');
const path = require('path');

const enabled = process.env.RAG_LOG === '1' || process.env.RAG_LOG === 'true';

function logRetrieval(entry) {
    if (!enabled) return;

    const logDir = path.join(__dirname, '..', '..', 'logs');
    try {
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
        fs.appendFileSync(path.join(logDir, 'retrieval.jsonl'), line, 'utf8');
    } catch (err) {
        console.warn('[ragLog]', err.message);
    }
}

module.exports = { logRetrieval };
