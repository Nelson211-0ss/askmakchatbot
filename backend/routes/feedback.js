const router = require('express').Router();
const db = require('../config/db');
const { optionalAuth } = require('../middleware/auth');

router.post('/', optionalAuth, async (req, res, next) => {
    try {
        const { message_id, rating, comment } = req.body;
        if (!message_id || rating === undefined) {
            return res.status(400).json({ error: 'message_id and rating required' });
        }

        const userId = req.user?.id || null;
        const guestToken = req.guestToken || null;

        const existing = userId
            ? await db.query('SELECT id FROM feedback WHERE message_id = $1 AND user_id = $2', [message_id, userId])
            : await db.query('SELECT id FROM feedback WHERE message_id = $1 AND guest_token = $2', [message_id, guestToken]);

        if (existing.rows.length) {
            await db.query(
                'UPDATE feedback SET rating = $1, comment = $2 WHERE id = $3',
                [rating, comment || null, existing.rows[0].id]
            );
            return res.json({ message: 'Feedback updated' });
        }

        await db.query(
            `INSERT INTO feedback (message_id, user_id, guest_token, rating, comment)
             VALUES ($1, $2, $3, $4, $5)`,
            [message_id, userId, guestToken, rating, comment || null]
        );

        res.status(201).json({ message: 'Feedback submitted' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
