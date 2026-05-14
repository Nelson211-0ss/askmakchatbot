const path = require('path');
const cron = require('node-cron');
const db = require('../config/db');
const storage = require('./storage');

function start() {
    cron.schedule('0 3 * * 0', async () => {
        console.log('[CRON] Weekly knowledge base re-ingestion starting...');
        try {
            const { execSync } = require('child_process');
            const ingestJs = path.join(__dirname, '..', 'scripts', 'ingest.js');
            const projectRoot = path.join(__dirname, '..', '..');
            execSync(`node "${ingestJs}"`, { stdio: 'inherit', cwd: projectRoot, env: process.env });
            console.log('[CRON] Re-ingestion complete');
        } catch (err) {
            console.error('[CRON] Re-ingestion failed:', err.message);
        }
    });

    cron.schedule('0 4 * * *', async () => {
        console.log('[CRON] Purging guest-only chats (guest sessions must not persist).');
        try {
            const images = await db.query(
                `SELECT DISTINCT m.image_key FROM messages m
                 JOIN chats c ON c.id = m.chat_id
                 WHERE c.guest_token IS NOT NULL AND c.user_id IS NULL
                   AND m.image_key IS NOT NULL`
            );

            for (const row of images.rows) {
                await storage.deleteFile(process.env.MINIO_BUCKET_UPLOADS, row.image_key).catch(() => {});
            }

            const result = await db.query(
                `DELETE FROM chats WHERE guest_token IS NOT NULL AND user_id IS NULL`
            );

            console.log(`[CRON] Purged ${result.rowCount} guest-only chat rows`);
        } catch (err) {
            console.error('[CRON] Guest purge failed:', err.message);
        }
    });

    cron.schedule('0 5 * * *', async () => {
        console.log('[CRON] Generating daily stats...');
        try {
            const stats = {};

            const users = await db.query('SELECT COUNT(*) FROM users WHERE email_verified = TRUE');
            stats.total_users = parseInt(users.rows[0].count);

            const chats = await db.query("SELECT COUNT(*) FROM chats WHERE created_at > NOW() - INTERVAL '24 hours'");
            stats.chats_today = parseInt(chats.rows[0].count);

            const messages = await db.query("SELECT COUNT(*) FROM messages WHERE created_at > NOW() - INTERVAL '24 hours'");
            stats.messages_today = parseInt(messages.rows[0].count);

            const escalations = await db.query("SELECT COUNT(*) FROM escalations WHERE status = 'pending'");
            stats.pending_escalations = parseInt(escalations.rows[0].count);

            console.log('[CRON] Daily stats:', stats);
        } catch (err) {
            console.error('[CRON] Stats generation failed:', err.message);
        }
    });

    console.log('Cron jobs scheduled');
}

module.exports = { start };
