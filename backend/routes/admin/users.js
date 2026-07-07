const router = require('express').Router();
const db = require('../../config/db');
const storage = require('../../services/storage');
const UP_BUCKET = process.env.MINIO_BUCKET_UPLOADS || 'uploads';

router.get('/activity/recent', async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
        const result = await db.query(
            `SELECT c.id, c.title, c.created_at, c.updated_at, c.user_id, c.guest_token,
                    u.full_name, u.email,
                    (SELECT content FROM messages m WHERE m.chat_id = c.id AND m.role = 'user' ORDER BY m.created_at ASC LIMIT 1) AS first_message,
                    EXISTS (SELECT 1 FROM escalations e WHERE e.chat_id = c.id AND e.status IN ('pending','in_progress')) AS escalated
             FROM chats c
             LEFT JOIN users u ON u.id = c.user_id
             ORDER BY c.updated_at DESC
             LIMIT $1`,
            [limit]
        );
        res.json({ chats: result.rows });
    } catch (err) {
        next(err);
    }
});

router.get('/users', async (req, res, next) => {
    try {
        const q = req.query.q || '';
        const page = parseInt(req.query.page, 10) || 1;
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
        const offset = (page - 1) * limit;
        const params = [];
        let whereClause = '';
        if (q) {
            whereClause = 'WHERE (u.full_name ILIKE $1 OR u.email ILIKE $1)';
            params.push('%' + q + '%');
        }
        params.push(limit, offset);
        const lim = params.length - 1;
        const off = params.length;
        const sql = `
            SELECT u.id, u.full_name, u.email, u.role, u.email_verified, u.created_at,
                   (SELECT MAX(c.updated_at) FROM chats c WHERE c.user_id = u.id) AS last_active,
                   (SELECT COUNT(*)::int FROM chats c WHERE c.user_id = u.id) AS chat_count
            FROM users u
            ${whereClause}
            ORDER BY u.created_at DESC
            LIMIT $${lim} OFFSET $${off}`;
        const [list, count, summaryResult] = await Promise.all([
            db.query(sql, params),
            db.query(`SELECT COUNT(*)::int AS c FROM users u ${whereClause}`, q ? [params[0]] : []),
            db.query(
                `SELECT COUNT(*)::int AS total_registered,
                        COUNT(*) FILTER (WHERE email_verified = TRUE)::int AS verified,
                        COUNT(*) FILTER (WHERE email_verified = FALSE)::int AS pending_verification,
                        COUNT(*) FILTER (WHERE role = 'admin')::int AS admins
                 FROM users`
            )
        ]);
        res.json({
            users: list.rows,
            total: count.rows[0].c,
            page,
            limit,
            summary: summaryResult.rows[0]
        });
    } catch (err) {
        next(err);
    }
});

router.get('/users/:id', async (req, res, next) => {
    try {
        const user = await db.query('SELECT id, full_name, email, role, email_verified, created_at FROM users WHERE id = $1', [req.params.id]);
        if (!user.rows.length) return res.status(404).json({ error: 'Not found' });
        const memories = await db.query('SELECT * FROM user_memories WHERE user_id = $1 ORDER BY updated_at DESC', [req.params.id]);
        const chats = await db.query(
            `SELECT id, title, created_at, updated_at FROM chats WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 50`,
            [req.params.id]
        );
        const fb = await db.query(
            `SELECT COUNT(*) FILTER (WHERE rating = true)::int AS up,
                    COUNT(*) FILTER (WHERE rating = false)::int AS down
             FROM feedback WHERE user_id = $1`
        );
        res.json({ user: user.rows[0], memories: memories.rows, chats: chats.rows, feedback: fb.rows[0] });
    } catch (err) {
        next(err);
    }
});

router.delete('/users/:id', async (req, res, next) => {
    try {
        if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete self' });
        const u = await db.query('SELECT role FROM users WHERE id = $1', [req.params.id]);
        if (!u.rows.length) return res.status(404).json({ error: 'Not found' });
        if (u.rows[0].role === 'admin') return res.status(403).json({ error: 'Cannot delete admin' });
        await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

router.get('/conversations', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
        const offset = (page - 1) * limit;
        const q = req.query.q || '';
        const guest = req.query.guest;
        const params = [];
        let where = [];
        let i = 1;
        if (q) {
            where.push(`(c.title ILIKE $${i} OR EXISTS (SELECT 1 FROM messages m WHERE m.chat_id = c.id AND m.content ILIKE $${i}))`);
            params.push('%' + q + '%');
            i++;
        }
        if (guest === '1') {
            where.push('c.user_id IS NULL AND c.guest_token IS NOT NULL');
        } else if (guest === '0') {
            where.push('c.user_id IS NOT NULL');
        }
        const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
        params.push(limit, offset);
        const sql = `
            SELECT c.*, u.full_name, u.email,
                   (SELECT COUNT(*)::int FROM messages m WHERE m.chat_id = c.id) AS message_count,
                   (SELECT AVG(confidence_score) FROM messages m WHERE m.chat_id = c.id AND m.role = 'assistant') AS avg_confidence,
                   EXISTS (SELECT 1 FROM escalations e WHERE e.chat_id = c.id) AS has_escalation,
                   EXISTS (SELECT 1 FROM feedback f JOIN messages m ON m.id = f.message_id WHERE m.chat_id = c.id AND f.rating = false) AS has_negative_feedback,
                   EXISTS (SELECT 1 FROM messages m WHERE m.chat_id = c.id AND m.image_key IS NOT NULL) AS has_images
            FROM chats c
            LEFT JOIN users u ON u.id = c.user_id
            ${w}
            ORDER BY c.updated_at DESC
            LIMIT $${i} OFFSET $${i + 1}`;
        const result = await db.query(sql, params);
        const countSql = `SELECT COUNT(*)::int AS c FROM chats c ${w}`;
        const count = await db.query(countSql, params.slice(0, params.length - 2));
        res.json({ conversations: result.rows, total: count.rows[0].c, page, limit });
    } catch (err) {
        next(err);
    }
});

router.get('/conversations/:id', async (req, res, next) => {
    try {
        const chat = await db.query(
            `SELECT c.*, u.full_name, u.email FROM chats c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = $1`,
            [req.params.id]
        );
        if (!chat.rows.length) return res.status(404).json({ error: 'Not found' });
        const msgs = await db.query(
            `SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at ASC`,
            [req.params.id]
        );
        for (const m of msgs.rows) {
            if (m.image_key) {
                m.image_url = await storage.getPresignedUrl(UP_BUCKET, m.image_key).catch(() => null);
            }
        }
        res.json({ chat: chat.rows[0], messages: msgs.rows });
    } catch (err) {
        next(err);
    }
});

router.get('/feedback', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = Math.min(parseInt(req.query.limit, 10) || 30, 200);
        const offset = (page - 1) * limit;
        const rating = req.query.rating;
        const params = [];
        let where = '';
        if (rating === 'up') {
            where = 'WHERE f.rating = true';
        } else if (rating === 'down') {
            where = 'WHERE f.rating = false';
        }
        params.push(limit, offset);
        const sql = `
            SELECT f.*, m.content AS message_preview, m.chat_id,
                   (SELECT content FROM messages m2 WHERE m2.chat_id = m.chat_id AND m2.role = 'assistant' AND m2.created_at < m.created_at ORDER BY m2.created_at DESC LIMIT 1) AS bot_preview,
                   u.full_name, u.email, c.guest_token
            FROM feedback f
            JOIN messages m ON m.id = f.message_id
            JOIN chats c ON c.id = m.chat_id
            LEFT JOIN users u ON u.id = f.user_id
            ${where}
            ORDER BY f.created_at DESC
            LIMIT $${params.length - 1} OFFSET $${params.length}`;
        const result = await db.query(sql, params);
        const count = await db.query(`SELECT COUNT(*)::int AS c FROM feedback f ${where}`);
        res.json({ feedback: result.rows, total: count.rows[0].c, page, limit });
    } catch (err) {
        next(err);
    }
});

router.get('/feedback/export', async (req, res, next) => {
    try {
        const result = await db.query(
            `SELECT f.created_at, f.rating, f.comment, m.content AS message_content, c.id AS chat_id,
                    u.email, c.guest_token
             FROM feedback f
             JOIN messages m ON m.id = f.message_id
             JOIN chats c ON c.id = m.chat_id
             LEFT JOIN users u ON u.id = f.user_id
             ORDER BY f.created_at DESC
             LIMIT 5000`
        );
        const headers = ['created_at', 'rating', 'comment', 'message', 'chat_id', 'user_email', 'guest'];
        const lines = [headers.join(',')];
        for (const row of result.rows) {
            const cells = [
                row.created_at,
                row.rating,
                row.comment || '',
                (row.message_content || '').substring(0, 2000),
                row.chat_id,
                row.email || '',
                row.guest_token || ''
            ].map(v => `"${String(v).replace(/"/g, '""')}"`);
            lines.push(cells.join(','));
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="askmak-feedback.csv"');
        res.send(lines.join('\\n'));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
