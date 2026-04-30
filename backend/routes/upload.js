const router = require('express').Router();
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { optionalAuth } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimit');
const storage = require('../services/storage');

const BUCKET = process.env.MINIO_BUCKET_UPLOADS || 'uploads';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
            return cb(new Error('Only JPG, PNG, GIF, and WebP images are allowed'));
        }
        cb(null, true);
    }
});

router.use(optionalAuth);

router.post('/image', uploadLimiter, upload.single('image'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image provided' });

        const owner = req.user?.id || req.guestToken || 'anonymous';
        const chatId = req.body.chat_id || 'general';
        const ext = path.extname(req.file.originalname) || '.jpg';
        const id = uuidv4();

        let processed = sharp(req.file.buffer).rotate();
        const metadata = await processed.metadata();

        if (metadata.width > 2048 || metadata.height > 2048) {
            processed = processed.resize(2048, 2048, { fit: 'inside', withoutEnlargement: true });
        }

        const buffer = await processed.jpeg({ quality: 80 }).toBuffer();

        const key = `${owner}/${chatId}/${id}.jpg`;
        await storage.uploadFile(BUCKET, key, buffer, 'image/jpeg');

        const thumbBuffer = await sharp(req.file.buffer)
            .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 70 })
            .toBuffer();

        const thumbKey = `${owner}/${chatId}/${id}_thumb.jpg`;
        await storage.uploadFile(BUCKET, thumbKey, thumbBuffer, 'image/jpeg');

        res.json({ image_key: key, thumbnail_key: thumbKey });
    } catch (err) {
        next(err);
    }
});

router.get('/url/*key', async (req, res, next) => {
    try {
        const url = await storage.getPresignedUrl(BUCKET, req.params.key);
        res.json({ url });
    } catch (err) {
        next(err);
    }
});

router.get('/proxy/*key', async (req, res, next) => {
    try {
        const stream = await storage.getFileStream(BUCKET, req.params.key);
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        stream.pipe(res);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
