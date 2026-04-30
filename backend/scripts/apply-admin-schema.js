/**
 * Applies backend/db/admin_schema.sql using DATABASE_URL from .env (host → Postgres).
 * Use when Postgres was created before admin_schema existed or init scripts never ran.
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const { Client } = require('pg');

const SQL_PATH = path.join(__dirname, '..', 'db', 'admin_schema.sql');

function statementsFromFile(sql) {
    return sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !/^--/.test(s));
}

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL is not set. Add postgres URL to .env');
        process.exit(1);
    }

    const raw = fs.readFileSync(SQL_PATH, 'utf8');
    const parts = statementsFromFile(raw);

    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    try {
        for (const stmt of parts) {
            await client.query(stmt + ';');
        }
    } finally {
        await client.end();
    }

    console.log('Admin schema applied (admin_settings, ingestion_runs, etc.)');
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
