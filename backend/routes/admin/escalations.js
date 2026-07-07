const router = require('express').Router();
const db = require('../../config/db');
const storage = require('../../services/storage');
const UP_BUCKET = process.env.MINIO_BUCKET_UPLOADS || 'uploads';

router.get('/escalations', async (req, res, next) => {
    try {
        const { status, page = 1, limit = 20, from, to } = req.query;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const params = [];
        let where = [];
        let i = 1;
        if (status) {
            where.push(`e.status = $${i++}`);
            params.push(status);
        }
        if (from) {
            where.push(`e.created_at >= $${i++}`);
            params.push(from);
        }
        if (to) {
            where.push(`e.created_at <= $${i++}`);
            params.push(to);
        }
        const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
        params.push(parseInt(limit, 10), offset);
        const sql = `
            SELECT e.*, c.title AS chat_title, m.content AS message_content,
                   u.full_name AS user_name, u.email AS user_email
            FROM escalations e
            JOIN chats c ON c.id = e.chat_id
            JOIN messages m ON m.id = e.message_id
            LEFT JOIN users u ON u.id = c.user_id
            ${w}
            ORDER BY e.created_at DESC
            LIMIT $${i} OFFSET $${i + 1}`;
        const result = await db.query(sql, params);
        const countSql = `SELECT COUNT(*)::int AS c FROM escalations e ${w}`;
        const countResult = await db.query(countSql, params.slice(0, params.length - 2));
        res.json({
            escalations: result.rows,
            total: countResult.rows[0].c,
            page: parseInt(page, 10),
            limit: parseInt(limit, 10)
        });
    } catch (err) {
        next(err);
    }
});

router.get('/escalations/:id', async (req, res, next) => {
    try {
        const esc = await db.query(
            `SELECT e.*, c.title AS chat_title, c.user_id, c.guest_token, u.full_name, u.email
             FROM escalations e
             JOIN chats c ON c.id = e.chat_id
             LEFT JOIN users u ON u.id = c.user_id
             WHERE e.id = $1`,
            [req.params.id]
        );
        if (!esc.rows.length) return res.status(404).json({ error: 'Not found' });
        const msgs = await db.query(
            `SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at ASC`,
            [esc.rows[0].chat_id]
        );
        for (const m of msgs.rows) {
            if (m.image_key) {
                m.image_url = await storage.getPresignedUrl(UP_BUCKET, m.image_key).catch(() => null);
            }
        }
        res.json({ escalation: esc.rows[0], messages: msgs.rows });
    } catch (err) {
        next(err);
    }
});

router.patch('/escalations/:id', async (req, res, next) => {
    try {
        const { status, admin_response } = req.body;
        if (!status) return res.status(400).json({ error: 'Status required' });
        const updates = ['status = $1', `resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END`];
        const params = [status];
        let idx = 2;
        if (admin_response) {
            updates.push(`admin_response = $${idx++}`);
            params.push(admin_response);
        }
        params.push(req.params.id);
        const result = await db.query(
            `UPDATE escalations SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
            params
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
        if (admin_response) {
            const esc = result.rows[0];
            await db.query(
                `INSERT INTO messages (chat_id, role, content) VALUES ($1, 'system', $2)`,
                [esc.chat_id, 'Staff response: ' + admin_response]
            );
        }
        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

router.get('/unresolved', async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const base = `SELECT m.id, m.chat_id, m.content, m.confidence_score, m.created_at,
                    c.user_id, c.guest_token, u.full_name, u.email
             FROM messages m
             JOIN chats c ON c.id = m.chat_id
             LEFT JOIN users u ON u.id = c.user_id
             WHERE m.role = 'assistant'
             AND (
               (m.confidence_score IS NOT NULL AND m.confidence_score < 0.65)
               OR m.content ILIKE '%not sure%'
               OR m.content ILIKE '%don''t have%'
               OR m.content ILIKE '%couldn''t find%'
               OR m.content ILIKE '%no information%'
             )`;
        const withDismiss = `${base}
             AND NOT EXISTS (SELECT 1 FROM admin_unresolved_dismissals d WHERE d.message_id = m.id)
             ORDER BY m.created_at DESC
             LIMIT $1`;
        let result;
        try {
            result = await db.query(withDismiss, [limit]);
        } catch (err) {
            if (err.code !== '42P01') throw err;
            result = await db.query(`${base} ORDER BY m.created_at DESC LIMIT $1`, [limit]);
        }
        res.json({ items: result.rows });
    } catch (err) {
        next(err);
    }
});

router.patch('/unresolved/:id', async (req, res, next) => {
    try {
        const messageId = req.params.id;
        const action = req.body.action;
        if (action === 'dismiss') {
            try {
                await db.query(
                    `INSERT INTO admin_unresolved_dismissals (message_id) VALUES ($1) ON CONFLICT (message_id) DO NOTHING`,
                    [messageId]
                );
            } catch (e) {
                if (e.code === '42P01') {
                    return res.status(503).json({ error: 'Run db/admin_schema.sql (admin_unresolved_dismissals missing)' });
                }
                throw e;
            }
            return res.json({ ok: true });
        }
        if (action === 'escalate') {
            const m = await db.query(
                `SELECT m.id, m.chat_id FROM messages m WHERE m.id = $1 AND m.role = 'assistant'`,
                [messageId]
            );
            if (!m.rows.length) return res.status(404).json({ error: 'Assistant message not found' });
            const existing = await db.query('SELECT id FROM escalations WHERE message_id = $1', [messageId]);
            if (existing.rows.length) return res.json({ ok: true, escalation_id: existing.rows[0].id });
            const ins = await db.query(
                `INSERT INTO escalations (chat_id, message_id, reason, status) VALUES ($1, $2, $3, 'pending') RETURNING id`,
                [m.rows[0].chat_id, messageId, 'Flagged from unresolved review queue']
            );
            return res.json({ ok: true, escalation_id: ins.rows[0].id });
        }
        return res.status(400).json({ error: 'action must be dismiss or escalate' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
