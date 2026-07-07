const router = require('express').Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { spawn } = require('child_process');
const db = require('../../config/db');
const storage = require('../../services/storage');
const { generateEmbedding, generateEmbeddings } = require('../../services/embedding');
const { chunkText } = require('../../services/scraper');
const { wordCountKb, MIN_KB_CHUNK_WORDS } = require('./utils');

const DOC_BUCKET = process.env.MINIO_BUCKET_DOCUMENTS || 'documents';
const REF_BUCKET = process.env.MINIO_BUCKET_REFERENCE || 'reference';
const UP_BUCKET = process.env.MINIO_BUCKET_UPLOADS || 'uploads';

async function extractTextFromPdfBuffer(buffer) {
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    try {
        const textResult = await parser.getText();
        const infoResult = await parser.getInfo();
        const text = (textResult.text || '').replace(/\s+/g, ' ').trim();
        const dict = infoResult.info || {};
        const docTitle = dict.Title || dict.title || null;
        return { text, docTitle };
    } finally {
        await parser.destroy();
    }
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
        cb(null, ok);
    }
});

const uploadKbPdf = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const name = (file.originalname || '').toLowerCase();
        const ok = file.mimetype === 'application/pdf' || name.endsWith('.pdf');
        cb(null, ok);
    }
});

router.get('/documents', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = Math.min(parseInt(req.query.limit, 10) || 30, 200);
        const offset = (page - 1) * limit;
        const cat = req.query.category;
        const q = req.query.q || '';
        const params = [];
        let where = [];
        let i = 1;
        if (cat) {
            where.push(`category = $${i++}`);
            params.push(cat);
        }
        if (q) {
            where.push(`(title ILIKE $${i} OR content ILIKE $${i})`);
            params.push('%' + q + '%');
            i++;
        }
        const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
        params.push(limit, offset);
        const sql = `SELECT id, source_url, title, chunk_index, category, image_keys, indexed_at, metadata,
            LEFT(content, 200) AS content_preview
            FROM documents ${w} ORDER BY indexed_at DESC LIMIT $${i} OFFSET $${i + 1}`;
        const result = await db.query(sql, params);
        const count = await db.query(`SELECT COUNT(*)::int AS c FROM documents ${w}`, params.slice(0, params.length - 2));
        res.json({ documents: result.rows, total: count.rows[0].c, page, limit });
    } catch (err) {
        next(err);
    }
});

router.post('/documents/upload-pdf', (req, res, next) => {
    uploadKbPdf.single('file')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'PDF too large (max 25MB)' });
            }
            return next(err);
        }
        next();
    });
}, async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'PDF file required (field name: file)' });
        }
        const category = (req.body.category || 'faq').trim() || 'faq';
        let title = (req.body.title || '').trim();
        const buffer = req.file.buffer;

        let text;
        let docTitleFromPdf = null;
        try {
            const extracted = await extractTextFromPdfBuffer(buffer);
            text = extracted.text;
            docTitleFromPdf = extracted.docTitle;
        } catch (e) {
            return res.status(400).json({ error: 'Could not read PDF: ' + (e && e.message ? e.message : String(e)) });
        }

        if (!text || text.length < 20) {
            return res.status(400).json({ error: 'No extractable text in this PDF (scanned PDFs may need OCR).' });
        }

        if (!title) {
            title =
                (docTitleFromPdf && String(docTitleFromPdf).trim()) ||
                path.parse(req.file.originalname || 'upload').name ||
                'Uploaded PDF';
        }
        const maxTitle = 500;
        if (title.length > maxTitle) title = title.slice(0, maxTitle - 1) + '…';

        const rawChunks = chunkText(text);
        let chunks = rawChunks.filter((c) => wordCountKb(c) >= MIN_KB_CHUNK_WORDS);
        if (!chunks.length && text.length > 20) {
            const fallback = text.substring(0, 8000);
            if (wordCountKb(fallback) >= 4) chunks = [fallback];
        }
        if (!chunks.length) {
            return res.status(400).json({ error: 'Could not produce searchable segments from this PDF.' });
        }

        const baseSrc = 'manual-pdf://' + uuidv4();
        const chunkTitles = chunks.map((_, i) =>
            chunks.length > 1 ? `${title} (part ${i + 1}/${chunks.length})` : title
        );
        const embedInputs = chunkTitles.map((t, i) => t + '\\n\\n' + chunks[i]);
        const embeddings = await generateEmbeddings(embedInputs);

        const ids = [];
        for (let i = 0; i < chunks.length; i++) {
            const embeddingStr = '[' + embeddings[i].join(',') + ']';
            const meta = {
                manual: true,
                pdf_upload: true,
                original_filename: req.file.originalname || null,
                chunk_index_display: i,
                chunk_of: chunks.length
            };
            const result = await db.query(
                `INSERT INTO documents (source_url, title, content, chunk_index, embedding, category, metadata)
                 VALUES ($1, $2, $3, $4, $5::vector, $6, $7::jsonb)
                 ON CONFLICT (source_url, chunk_index) DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content,
                   embedding = EXCLUDED.embedding, category = EXCLUDED.category, metadata = EXCLUDED.metadata, indexed_at = NOW()
                 RETURNING id`,
                [baseSrc, chunkTitles[i], chunks[i], i, embeddingStr, category, JSON.stringify(meta)]
            );
            ids.push(result.rows[0].id);
        }

        res.status(201).json({ inserted: ids.length, ids, title });
    } catch (err) {
        next(err);
    }
});

router.get('/documents/:id', async (req, res, next) => {
    try {
        const r = await db.query(
            `SELECT id, title, content, category, source_url, chunk_index, metadata, image_keys, indexed_at
             FROM documents WHERE id = $1`,
            [req.params.id]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ document: r.rows[0] });
    } catch (err) {
        next(err);
    }
});

router.post('/documents', async (req, res, next) => {
    try {
        const { title, content, category, source_url } = req.body;
        if (!title || !content) return res.status(400).json({ error: 'title and content required' });
        const emb = await generateEmbedding(title + '\\n\\n' + content);
        const embStr = '[' + emb.join(',') + ']';
        const src = source_url || 'manual://' + uuidv4();
        const result = await db.query(
            `INSERT INTO documents (source_url, title, content, chunk_index, embedding, category, metadata)
             VALUES ($1, $2, $3, 0, $4::vector, $5, $6::jsonb)
             ON CONFLICT (source_url, chunk_index) DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content,
               embedding = EXCLUDED.embedding, category = EXCLUDED.category, metadata = EXCLUDED.metadata, indexed_at = NOW()
             RETURNING id`,
            [src, title, content, embStr, category || 'faq', JSON.stringify({ manual: true })]
        );
        res.status(201).json({ id: result.rows[0].id });
    } catch (err) {
        next(err);
    }
});

router.put('/documents/:id', async (req, res, next) => {
    try {
        const { title, content, category, source_url } = req.body;
        const cur = await db.query(
            `SELECT id, title, content, category, source_url, metadata FROM documents WHERE id = $1`,
            [req.params.id]
        );
        if (!cur.rows.length) return res.status(404).json({ error: 'Not found' });
        const doc = cur.rows[0];
        let meta = doc.metadata;
        if (typeof meta === 'string') {
            try {
                meta = JSON.parse(meta);
            } catch {
                meta = {};
            }
        }
        const isKbEntrySync =
            doc.source_url && String(doc.source_url).startsWith('kb-entry://');
        if (isKbEntrySync) {
            return res.status(403).json({
                error:
                    'This chunk is synced from Knowledge Base — edit the FAQ entry there so the browse view and assistant index stay in sync.'
            });
        }
        const isManual =
            (meta && meta.manual === true) ||
            (doc.source_url &&
                (String(doc.source_url).startsWith('manual://') || String(doc.source_url).startsWith('manual-pdf://')));
        if (!isManual) return res.status(403).json({ error: 'Only manual knowledge entries can be edited here' });
        const newTitle = title != null ? title : doc.title;
        const newContent = content != null ? content : doc.content;
        const newCat = category != null ? category : doc.category;
        const newSrc = source_url != null ? source_url : doc.source_url;
        if (!newTitle || !newContent) return res.status(400).json({ error: 'title and content required' });
        const emb = await generateEmbedding(newTitle + '\\n\\n' + newContent);
        const embStr = '[' + emb.join(',') + ']';
        await db.query(
            `UPDATE documents SET title = $1, content = $2, category = $3, source_url = $4, embedding = $5::vector, indexed_at = NOW() WHERE id = $6`,
            [newTitle, newContent, newCat, newSrc, embStr, req.params.id]
        );
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

router.delete('/documents/:id', async (req, res, next) => {
    try {
        const sel = await db.query('SELECT id, source_url, image_keys FROM documents WHERE id = $1', [req.params.id]);
        if (!sel.rows.length) return res.status(404).json({ error: 'Not found' });
        const anchor = sel.rows[0];

        let toDelete = sel.rows;
        if (anchor.source_url && String(anchor.source_url).startsWith('kb-entry://')) {
            const siblings = await db.query(
                'SELECT id, image_keys FROM documents WHERE source_url = $1 ORDER BY chunk_index ASC',
                [anchor.source_url]
            );
            toDelete = siblings.rows;
        }

        for (const doc of toDelete) {
            let keys = doc.image_keys;
            if (typeof keys === 'string') {
                try {
                    keys = JSON.parse(keys);
                } catch {
                    keys = null;
                }
            }
            if (Array.isArray(keys)) {
                for (const k of keys) {
                    await storage.deleteFile(DOC_BUCKET, k).catch(() => {});
                }
            }
            await db.query('DELETE FROM documents WHERE id = $1', [doc.id]);
        }

        const removedKb = !!(anchor.source_url && String(anchor.source_url).startsWith('kb-entry://'));
        res.json({
            ok: true,
            deleted: toDelete.length,
            ...(removedKb
                ? {
                      warning:
                          'Removed assistant index chunks linked to a Knowledge Base entry; the curated FAQ row is unchanged.'
                  }
                : {})
        });
    } catch (err) {
        next(err);
    }
});

router.post('/ingest', async (req, res, next) => {
    try {
        const source = req.body.source || 'all';
        await db.query(
            `INSERT INTO ingestion_runs (source, status, stats) VALUES ($1, 'started', '{}')`,
            [source]
        );
        const child = spawn(process.execPath, [path.join(__dirname, '..', '..', 'scripts', 'ingest.js')], {
            cwd: path.join(__dirname, '..', '..'),
            detached: true,
            stdio: 'ignore',
            env: { ...process.env }
        });
        child.unref();
        res.status(202).json({ message: 'Ingestion started in background', source });
    } catch (err) {
        next(err);
    }
});

router.get('/ingest/status', async (req, res, next) => {
    try {
        const result = await db.query(
            `SELECT id, source, status, stats, started_at, finished_at FROM ingestion_runs ORDER BY started_at DESC LIMIT 20`
        );
        const docCount = await db.query('SELECT COUNT(*)::int AS c FROM documents');
        res.json({ runs: result.rows, document_chunks: docCount.rows[0].c });
    } catch (err) {
        next(err);
    }
});

router.get('/reference-images', async (req, res, next) => {
    try {
        const files = await storage.listFiles(REF_BUCKET, '');
        const slice = files.slice(0, 500);
        const keys = slice.map(f => f.key);
        let metaByKey = {};
        if (keys.length) {
            try {
                const metaRows = await db.query(
                    'SELECT object_key, display_name, category, description, tags FROM admin_reference_image_meta WHERE object_key = ANY($1::text[])',
                    [keys]
                );
                metaByKey = Object.fromEntries(metaRows.rows.map(r => [r.object_key, r]));
            } catch (e) {
                if (e.code !== '42P01') throw e;
            }
        }
        const items = [];
        for (const f of slice) {
            const url = await storage.getPresignedUrl(REF_BUCKET, f.key).catch(() => null);
            const meta = metaByKey[f.key];
            items.push({
                key: f.key,
                size: f.size,
                url,
                display_name: meta ? meta.display_name : null,
                category: meta ? meta.category : null,
                description: meta ? meta.description : null,
                tags: meta ? meta.tags : null
            });
        }
        res.json({ images: items });
    } catch (err) {
        next(err);
    }
});

router.post('/reference-images', upload.single('image'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'image required' });
        const category = (req.body.category || 'maps').replace(/[^a-z0-9_-]/gi, '_');
        const name = (req.body.name || 'image').replace(/[^a-z0-9_-]/gi, '_');
        const ext = path.extname(req.file.originalname) || '.jpg';
        const key = `${category}/${name}_${uuidv4()}${ext}`;
        await storage.uploadFile(REF_BUCKET, key, req.file.buffer, req.file.mimetype);
        res.status(201).json({ key });
    } catch (err) {
        next(err);
    }
});

router.put('/reference-images/*key', async (req, res, next) => {
    try {
        const key = req.params.key;
        const { display_name, category, description, tags } = req.body;
        const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);
        try {
            await db.query(
                `INSERT INTO admin_reference_image_meta (object_key, display_name, category, description, tags, updated_at)
                 VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
                 ON CONFLICT (object_key) DO UPDATE SET
                   display_name = EXCLUDED.display_name,
                   category = EXCLUDED.category,
                   description = EXCLUDED.description,
                   tags = EXCLUDED.tags,
                   updated_at = NOW()`,
                [key, display_name ?? null, category ?? null, description ?? null, tagsJson]
            );
        } catch (e) {
            if (e.code === '42P01') {
                return res.status(503).json({ error: 'Run db/admin_schema.sql (admin_reference_image_meta missing)' });
            }
            throw e;
        }
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

router.delete('/reference-images/*key', async (req, res, next) => {
    try {
        const key = req.params.key;
        await storage.deleteFile(REF_BUCKET, key);
        await db.query('DELETE FROM admin_reference_image_meta WHERE object_key = $1', [key]).catch(() => {});
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

router.get('/storage/uploads', async (req, res, next) => {
    try {
        const files = await storage.listFiles(UP_BUCKET, '');
        const items = [];
        for (const f of files.slice(0, 500)) {
            const url = await storage.getPresignedUrl(UP_BUCKET, f.key, 600).catch(() => null);
            items.push({ key: f.key, size: f.size, url });
        }
        res.json({ files: items });
    } catch (err) {
        next(err);
    }
});

router.delete('/storage/uploads/*key', async (req, res, next) => {
    try {
        await storage.deleteFile(UP_BUCKET, req.params.key);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
