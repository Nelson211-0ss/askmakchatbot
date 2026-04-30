const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { optionalAuth } = require('../middleware/auth');
const { messageLimiter } = require('../middleware/rateLimit');
const { streamResponse, generateTitle } = require('../services/openai');
const { extractMemories } = require('../services/memory');
const storage = require('../services/storage');

router.use(optionalAuth);

router.post('/', async (req, res, next) => {
    try {
        const userId = req.user?.id || null;
        const guestToken = req.guestToken || null;
        const title = req.body.title || 'New chat';

        const result = await db.query(
            `INSERT INTO chats (user_id, guest_token, title) VALUES ($1, $2, $3) RETURNING *`,
            [userId, guestToken, title]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

router.get('/', async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const guestToken = req.guestToken;

        let result;
        if (userId) {
            result = await db.query(
                'SELECT * FROM chats WHERE user_id = $1 ORDER BY updated_at DESC',
                [userId]
            );
        } else if (guestToken) {
            result = await db.query(
                'SELECT * FROM chats WHERE guest_token = $1 ORDER BY updated_at DESC',
                [guestToken]
            );
        } else {
            return res.json({ chats: [] });
        }

        res.json({ chats: result.rows });
    } catch (err) {
        next(err);
    }
});

router.get('/search', async (req, res, next) => {
    try {
        const q = req.query.q;
        if (!q) return res.json({ chats: [] });

        const userId = req.user?.id;
        const guestToken = req.guestToken;

        const ownerCondition = userId
            ? 'c.user_id = $2'
            : 'c.guest_token = $2';
        const ownerValue = userId || guestToken;

        const result = await db.query(
            `SELECT DISTINCT c.* FROM chats c
             JOIN messages m ON m.chat_id = c.id
             WHERE ${ownerCondition}
             AND (c.title ILIKE $1 OR m.content ILIKE $1)
             ORDER BY c.updated_at DESC LIMIT 20`,
            ['%' + q + '%', ownerValue]
        );

        res.json({ chats: result.rows });
    } catch (err) {
        next(err);
    }
});

router.delete('/all', async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const guestToken = req.guestToken;

        if (userId) {
            const keys = await db.query(
                `SELECT DISTINCT m.image_key FROM messages m
                 INNER JOIN chats c ON c.id = m.chat_id
                 WHERE c.user_id = $1 AND m.image_key IS NOT NULL`,
                [userId]
            );
            for (const row of keys.rows) {
                await storage.deleteFile(process.env.MINIO_BUCKET_UPLOADS, row.image_key).catch(() => {});
            }
            await db.query('DELETE FROM chats WHERE user_id = $1', [userId]);
        } else if (guestToken) {
            const keys = await db.query(
                `SELECT DISTINCT m.image_key FROM messages m
                 INNER JOIN chats c ON c.id = m.chat_id
                 WHERE c.guest_token = $1 AND m.image_key IS NOT NULL`,
                [guestToken]
            );
            for (const row of keys.rows) {
                await storage.deleteFile(process.env.MINIO_BUCKET_UPLOADS, row.image_key).catch(() => {});
            }
            await db.query('DELETE FROM chats WHERE guest_token = $1', [guestToken]);
        } else {
            return res.status(400).json({ error: 'No session' });
        }

        res.json({ message: 'All chats cleared' });
    } catch (err) {
        next(err);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        const chat = await db.query('SELECT * FROM chats WHERE id = $1', [req.params.id]);
        if (!chat.rows.length) return res.status(404).json({ error: 'Chat not found' });

        const messages = await db.query(
            'SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at ASC',
            [req.params.id]
        );

        for (const msg of messages.rows) {
            if (msg.image_key) {
                msg.image_url = await storage.getPresignedUrl(
                    process.env.MINIO_BUCKET_UPLOADS, msg.image_key
                ).catch(() => null);
            }
        }

        res.json({ chat: chat.rows[0], messages: messages.rows });
    } catch (err) {
        next(err);
    }
});

router.get('/:id/messages', async (req, res, next) => {
    try {
        const result = await db.query(
            'SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at ASC',
            [req.params.id]
        );

        for (const msg of result.rows) {
            if (msg.image_key) {
                msg.image_url = await storage.getPresignedUrl(
                    process.env.MINIO_BUCKET_UPLOADS, msg.image_key
                ).catch(() => null);
            }
        }

        res.json({ messages: result.rows });
    } catch (err) {
        next(err);
    }
});

router.patch('/:id', async (req, res, next) => {
    try {
        const { title } = req.body;
        if (!title) return res.status(400).json({ error: 'Title required' });

        const result = await db.query(
            'UPDATE chats SET title = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [title, req.params.id]
        );

        if (!result.rows.length) return res.status(404).json({ error: 'Chat not found' });
        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

router.delete('/:id', async (req, res, next) => {
    try {
        const messages = await db.query(
            'SELECT image_key FROM messages WHERE chat_id = $1 AND image_key IS NOT NULL',
            [req.params.id]
        );

        for (const msg of messages.rows) {
            await storage.deleteFile(process.env.MINIO_BUCKET_UPLOADS, msg.image_key).catch(() => {});
        }

        await db.query('DELETE FROM chats WHERE id = $1', [req.params.id]);
        res.json({ message: 'Chat deleted' });
    } catch (err) {
        next(err);
    }
});

router.post('/:id/messages', messageLimiter, async (req, res, next) => {
    try {
        const chatId = req.params.id;
        const { content, image_key } = req.body;

        if (!content && !image_key) {
            return res.status(400).json({ error: 'Message content or image required' });
        }

        if (content && content.length > 2000) {
            return res.status(400).json({ error: 'Message too long (max 2000 characters)' });
        }

        const chat = await db.query('SELECT id FROM chats WHERE id = $1', [chatId]);
        if (!chat.rows.length) return res.status(404).json({ error: 'Chat not found' });

        await db.query(
            `INSERT INTO messages (chat_id, role, content, image_key)
             VALUES ($1, 'user', $2, $3)`,
            [chatId, content || '', image_key || null]
        );

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const userId = req.user?.id || null;

        const result = await streamResponse(chatId, content || 'Describe this image', userId, image_key, (data) => {
            res.write('data: ' + JSON.stringify(data) + '\n\n');
        });

        const msgResult = await db.query(
            `INSERT INTO messages (chat_id, role, content, tokens_used, sources, confidence_score)
             VALUES ($1, 'assistant', $2, $3, $4, $5) RETURNING id`,
            [chatId, result.content, result.tokensUsed, JSON.stringify(result.sources), result.confidenceScore]
        );

        if (result.sources.length) {
            res.write('data: ' + JSON.stringify({ type: 'sources', sources: result.sources }) + '\n\n');
        }

        res.write('data: ' + JSON.stringify({ type: 'done', message_id: msgResult.rows[0].id }) + '\n\n');
        res.end();

        await db.query('UPDATE chats SET updated_at = NOW() WHERE id = $1', [chatId]);

        const messageCount = await db.query('SELECT COUNT(*) FROM messages WHERE chat_id = $1', [chatId]);
        if (parseInt(messageCount.rows[0].count) === 2) {
            const title = await generateTitle(content);
            await db.query('UPDATE chats SET title = $1 WHERE id = $2', [title, chatId]);
        }

        if (userId) {
            extractMemories(userId, content, result.content).catch(() => {});
        }
    } catch (err) {
        console.error('[Chat Error]', err.stack || err.message || err);
        if (!res.headersSent) return next(err);
        res.write('data: ' + JSON.stringify({ type: 'error', message: 'Something went wrong' }) + '\n\n');
        res.end();
    }
});

module.exports = router;
