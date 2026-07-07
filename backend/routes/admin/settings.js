const router = require('express').Router();
const db = require('../../config/db');
const { getToolSchemas } = require('../../services/mcp/registry');

router.get('/tools', async (req, res, next) => {
    try {
        const schemas = getToolSchemas();
        res.json({ tools: schemas.map(s => ({ name: s.function.name, description: s.function.description })) });
    } catch (err) {
        next(err);
    }
});

router.get('/tools/log', async (req, res, next) => {
    try {
        res.json({ calls: [] });
    } catch (err) {
        next(err);
    }
});

router.get('/settings', async (req, res, next) => {
    try {
        const rows = await db.query('SELECT key, value FROM admin_settings');
        const settings = {};
        rows.rows.forEach(r => { settings[r.key] = r.value; });
        res.json({
            settings,
            openai_model: process.env.OPENAI_MODEL,
            embedding_model: process.env.EMBEDDING_MODEL
        });
    } catch (err) {
        if (err.code === '42P01') {
            return res.json({
                settings: {},
                openai_model: process.env.OPENAI_MODEL,
                embedding_model: process.env.EMBEDDING_MODEL,
                note: 'Run db/admin_schema.sql against your database'
            });
        }
        next(err);
    }
});

router.put('/settings', async (req, res, next) => {
    try {
        const body = req.body.settings || req.body;
        if (typeof body !== 'object' || body === null) return res.status(400).json({ error: 'Invalid body' });
        for (const key of Object.keys(body)) {
            if (key === 'openai_model' || key === 'embedding_model') continue;
            const val = body[key];
            await db.query(
                `INSERT INTO admin_settings (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                [key, JSON.stringify(val)]
            );
        }
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
