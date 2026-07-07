const router = require('express').Router();
const db = require('../../config/db');
const { clearKBCache } = require('../../config/redis');
const { syncKbEntryDocuments, removeKbSyncedDocuments } = require('./utils');
const nodemailer = require('nodemailer');

function getKbMailTransport() {
    if (!process.env.SMTP_HOST) return null;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true';
    const opts = { host: process.env.SMTP_HOST, port, secure };
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        opts.auth = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
    }
    if (port === 587 && !secure) opts.requireTLS = true;
    return nodemailer.createTransport(opts);
}

async function sendTicketResolutionMail(to, studentName, ticketTitle, adminResponse) {
    const transport = getKbMailTransport();
    if (!transport) {
        console.warn(`[AskMak] SMTP not configured — skipping ticket resolution email to ${to}`);
        return false;
    }
    const name = studentName || 'Student';
    const html = `
        <p>Dear ${name},</p>
        <p>Your support ticket <strong>"${ticketTitle}"</strong> has been resolved.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
        <p><strong>Answer from the AskMak team:</strong></p>
        <p style="background:#f9fafb;border-left:4px solid #00a651;padding:12px 16px;border-radius:4px">${adminResponse.replace(/\\n/g, '<br>')}</p>
        <p style="color:#6b7280;font-size:13px;margin-top:24px">
            This answer has been added to the AskMak knowledge base so other students can benefit from it.<br>
            Visit <a href="${process.env.CORS_ORIGIN || 'https://askmak.mak.ac.ug'}">AskMak</a> anytime for more help.
        </p>
        <p style="color:#6b7280;font-size:12px">— The Makerere University AskMak Team</p>`;
    try {
        await transport.sendMail({
            from: process.env.SMTP_FROM || '"AskMak" <noreply@mak.ac.ug>',
            to,
            subject: `[AskMak] Your ticket has been resolved: "${ticketTitle}"`,
            html
        });
        return true;
    } catch (err) {
        console.warn('[AskMak] Ticket resolution email failed:', err.message);
        return false;
    }
}

router.get('/kb', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const offset = (page - 1) * limit;
        const cat = req.query.category || '';
        const q = req.query.q || '';
        const params = [];
        const where = [];
        let i = 1;
        if (cat) { where.push(`category = $${i++}`); params.push(cat); }
        if (q)   { where.push(`(title ILIKE $${i} OR content ILIKE $${i})`); params.push('%' + q + '%'); i++; }
        const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
        params.push(limit, offset);
        const rows = await db.query(
            `SELECT id, category, title, LEFT(content,200) AS content_preview, is_published, created_at, updated_at
             FROM kb_entries ${w} ORDER BY category, title LIMIT $${i} OFFSET $${i + 1}`,
            params
        );
        const count = await db.query(`SELECT COUNT(*)::int AS c FROM kb_entries ${w}`, params.slice(0, -2));
        res.json({ entries: rows.rows, total: count.rows[0].c, page, limit });
    } catch (err) { next(err); }
});

router.get('/kb/categories', async (req, res, next) => {
    try {
        const r = await db.query(`SELECT DISTINCT category FROM kb_entries ORDER BY category`);
        res.json({ categories: r.rows.map(row => row.category) });
    } catch (err) { next(err); }
});

router.get('/kb/:id', async (req, res, next) => {
    try {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
            return res.status(404).json({ error: 'Not found' });
        }
        const r = await db.query(`SELECT * FROM kb_entries WHERE id = $1`, [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ entry: r.rows[0] });
    } catch (err) { next(err); }
});

router.post('/kb', async (req, res, next) => {
    try {
        const { category, title, content, is_published } = req.body;
        if (!category || !title || !content) {
            return res.status(400).json({ error: 'category, title, and content are required' });
        }
        const r = await db.query(
            `INSERT INTO kb_entries (category, title, content, is_published)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [category.trim(), title.trim(), content.trim(), is_published !== false]
        );
        const row = r.rows[0];
        let index_sync = null;
        try {
            index_sync = await syncKbEntryDocuments(row);
        } catch (syncErr) {
            index_sync = { ok: false, error: syncErr.message || String(syncErr) };
            console.warn('[AskMak] KB create→index sync failed:', syncErr.message);
        }
        await clearKBCache();
        res.status(201).json({ id: row.id, index_sync });
    } catch (err) { next(err); }
});

router.put('/kb/:id', async (req, res, next) => {
    try {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
            return res.status(404).json({ error: 'Not found' });
        }
        const { category, title, content, is_published } = req.body;
        const cur = await db.query(`SELECT id FROM kb_entries WHERE id = $1`, [req.params.id]);
        if (!cur.rows.length) return res.status(404).json({ error: 'Not found' });
        await db.query(
            `UPDATE kb_entries SET category=$1, title=$2, content=$3, is_published=$4, updated_at=NOW() WHERE id=$5`,
            [
                (category || '').trim(),
                (title || '').trim(),
                (content || '').trim(),
                is_published !== false,
                req.params.id
            ]
        );
        const full = await db.query(`SELECT * FROM kb_entries WHERE id = $1`, [req.params.id]);
        const row = full.rows[0];
        let index_sync = null;
        try {
            index_sync = await syncKbEntryDocuments(row);
        } catch (syncErr) {
            index_sync = { ok: false, error: syncErr.message || String(syncErr) };
            console.warn('[AskMak] KB update→index sync failed:', syncErr.message);
        }
        await clearKBCache();
        res.json({ ok: true, index_sync });
    } catch (err) { next(err); }
});

router.delete('/kb/:id', async (req, res, next) => {
    try {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
            return res.status(404).json({ error: 'Not found' });
        }
        await removeKbSyncedDocuments(req.params.id);
        const r = await db.query(`DELETE FROM kb_entries WHERE id = $1 RETURNING id`, [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        await clearKBCache();
        res.json({ ok: true });
    } catch (err) { next(err); }
});

router.get('/kb-tickets', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const offset = (page - 1) * limit;
        const status = req.query.status || '';
        const params = [];
        const where = [];
        let i = 1;
        if (status) { where.push(`status = $${i++}`); params.push(status); }
        const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
        params.push(limit, offset);
        const rows = await db.query(
            `SELECT id, category, title, student_email, student_name, status, created_at, resolved_at
             FROM kb_tickets ${w} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
            params
        );
        const count = await db.query(`SELECT COUNT(*)::int AS c FROM kb_tickets ${w}`, params.slice(0, -2));
        const pending = await db.query(`SELECT COUNT(*)::int AS c FROM kb_tickets WHERE status = 'pending'`);
        res.json({ tickets: rows.rows, total: count.rows[0].c, pending_count: pending.rows[0].c, page, limit });
    } catch (err) { next(err); }
});

router.get('/kb-tickets/:id', async (req, res, next) => {
    try {
        const r = await db.query(`SELECT * FROM kb_tickets WHERE id = $1`, [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ ticket: r.rows[0] });
    } catch (err) { next(err); }
});

router.patch('/kb-tickets/:id', async (req, res, next) => {
    try {
        const { admin_response, save_as_kb_entry } = req.body;
        if (!admin_response || !admin_response.trim()) {
            return res.status(400).json({ error: 'admin_response is required to resolve a ticket' });
        }
        const cur = await db.query(`SELECT * FROM kb_tickets WHERE id = $1`, [req.params.id]);
        if (!cur.rows.length) return res.status(404).json({ error: 'Not found' });
        const ticket = cur.rows[0];

        // Resolve ticket
        await db.query(
            `UPDATE kb_tickets
             SET status='resolved', admin_response=$1, content=$1, resolved_at=NOW()
             WHERE id=$2`,
            [admin_response.trim(), req.params.id]
        );

        // Send notification email
        let emailSent = false;
        try {
            emailSent = await sendTicketResolutionMail(
                ticket.student_email,
                ticket.student_name,
                ticket.title,
                admin_response.trim()
            );
            if (emailSent) {
                await db.query(`UPDATE kb_tickets SET notified_at=NOW() WHERE id=$1`, [req.params.id]);
            }
        } catch (mailErr) {
            console.warn('[AskMak] Email notification error:', mailErr.message);
        }

        // Optionally create a KB entry from the resolved ticket
        let kbEntryId = null;
        let entryIndexSync = null;
        if (save_as_kb_entry) {
            const kbInsert = await db.query(
                `INSERT INTO kb_entries (category, title, content)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [ticket.category, ticket.title, admin_response.trim()]
            );
            const kbRow = kbInsert.rows[0];
            kbEntryId = kbRow.id;
            try {
                entryIndexSync = await syncKbEntryDocuments(kbRow);
            } catch (syncErr) {
                entryIndexSync = { ok: false, error: syncErr.message || String(syncErr) };
                console.warn('[AskMak] KB ticket→index sync failed:', syncErr.message);
            }
            await clearKBCache();
        }

        res.json({ ok: true, email_sent: emailSent, kb_entry_id: kbEntryId, index_sync: entryIndexSync });
    } catch (err) { next(err); }
});

module.exports = router;
