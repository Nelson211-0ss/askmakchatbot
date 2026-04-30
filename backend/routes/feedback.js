const router = require('express').Router();
const db = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth, requireAdmin);

router.post('/', async (req, res, next) => {
    try {
        const { message_id, rating, comment } = req.body;
        if (!message_id || rating === undefined) {
            return res.status(400).json({ error: 'message_id and rating required' });
        }

        const userId = req.user.id;

        const existing = await db.query(
            'SELECT id FROM feedback WHERE message_id = $1 AND user_id = $2',
            [message_id, userId]
        );

        if (existing.rows.length) {
            await db.query('UPDATE feedback SET rating = $1, comment = $2 WHERE id = $3', [
                rating,
                comment || null,
                existing.rows[0].id
            ]);
            return res.json({ message: 'Feedback updated' });
        }

        await db.query(
            `INSERT INTO feedback (message_id, user_id, guest_token, rating, comment)
             VALUES ($1, $2, NULL, $3, $4)`,
            [message_id, userId, rating, comment || null]
        );

        res.status(201).json({ message: 'Feedback submitted' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
