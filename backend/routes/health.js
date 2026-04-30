const router = require('express').Router();
const db = require('../config/db');
const storage = require('../services/storage');

router.get('/health', async (req, res) => {
    const checks = { status: 'ok', timestamp: new Date().toISOString() };

    try {
        await db.query('SELECT 1');
        checks.database = 'connected';
    } catch {
        checks.database = 'disconnected';
        checks.status = 'degraded';
    }

    try {
        await storage.listFiles(process.env.MINIO_BUCKET_UPLOADS || 'uploads', '');
        checks.storage = 'connected';
    } catch {
        checks.storage = 'disconnected';
        checks.status = 'degraded';
    }

    checks.openai = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-placeholder'
        ? 'configured' : 'not configured';

    const statusCode = checks.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(checks);
});

module.exports = router;
