const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const kbLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false
});

const ticketLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many ticket submissions, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: false
});

/** GET /api/kb/categories — distinct published categories */
router.get('/categories', kbLimiter, async (req, res, next) => {
    try {
        const result = await db.query(
            `SELECT DISTINCT category FROM kb_entries WHERE is_published = TRUE ORDER BY category`
        );
        res.json({ categories: result.rows.map(r => r.category) });
    } catch (err) {
        next(err);
    }
});

/** GET /api/kb/categories/:category — all published titles in a category */
router.get('/categories/:category', kbLimiter, async (req, res, next) => {
    try {
        const result = await db.query(
            `SELECT id, title FROM kb_entries
             WHERE category = $1 AND is_published = TRUE
             ORDER BY title`,
            [req.params.category]
        );
        res.json({ entries: result.rows });
    } catch (err) {
        next(err);
    }
});

/** GET /api/kb/entries/:id — full content of a single published entry */
router.get('/entries/:id', kbLimiter, async (req, res, next) => {
    try {
        const result = await db.query(
            `SELECT id, category, title, content FROM kb_entries
             WHERE id = $1 AND is_published = TRUE`,
            [req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ entry: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/kb/tickets — submit a support ticket.
 *
 * Restricted to authenticated students. The ticket is always associated with
 * the signed-in account (email + full name from the JWT); any email/name in
 * the request body is ignored. This prevents anonymous abuse and stops a
 * caller from forging tickets under someone else's identity.
 */
router.post('/tickets', requireAuth, ticketLimiter, async (req, res, next) => {
    try {
        const { category, title } = req.body || {};
        if (!category || !title) {
            return res.status(400).json({ error: 'category and title are required' });
        }

        // Identity comes from the verified JWT, not the request body.
        const studentEmail = (req.user && req.user.email ? String(req.user.email) : '')
            .trim()
            .toLowerCase();
        const studentName = (req.user && req.user.full_name ? String(req.user.full_name) : '').trim();

        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRe.test(studentEmail)) {
            // Should never happen for a valid JWT, but guard anyway.
            return res.status(401).json({ error: 'Your account is missing a valid email. Please sign in again.' });
        }

        const result = await db.query(
            `INSERT INTO kb_tickets (category, title, student_email, student_name)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [
                String(category).trim().substring(0, 100),
                String(title).trim().substring(0, 512),
                studentEmail,
                studentName.substring(0, 255) || null
            ]
        );

        res.status(201).json({
            id: result.rows[0].id,
            message: 'Ticket submitted successfully. You will be notified by email when it is resolved.'
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
