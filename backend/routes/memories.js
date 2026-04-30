const router = require('express').Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res, next) => {
    try {
        const result = await db.query(
            'SELECT id, memory_key, memory_value as content, created_at, updated_at FROM user_memories WHERE user_id = $1 ORDER BY updated_at DESC',
            [req.user.id]
        );
        res.json({ memories: result.rows });
    } catch (err) {
        next(err);
    }
});

router.delete('/:id', async (req, res, next) => {
    try {
        const result = await db.query(
            'DELETE FROM user_memories WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Memory not found' });
        res.json({ message: 'Memory deleted' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
