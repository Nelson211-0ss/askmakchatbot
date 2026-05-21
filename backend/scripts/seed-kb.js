const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const fs = require('fs');
const db = require('../config/db');
const { generateEmbeddings } = require('../services/embedding');
const { chunkText, categorize } = require('../services/scraper');

const MIN_KB_CHUNK_WORDS = Math.max(4, parseInt(process.env.INGEST_MIN_CHUNK_WORDS || '10', 10));

function wordCountKb(s) {
    return (s || '').split(/\s+/).filter(Boolean).length;
}

async function run() {
    const { hasOpenAIApiKey } = require('../services/openaiClient');
    if (!hasOpenAIApiKey()) {
        console.warn('⚠️ Warning: OPENAI_API_KEY is not set. Skipping Knowledge Base seeding.');
        console.warn('  Add it to your .env file and run `npm run seed-kb` manually when ready.');
        process.exit(0);
    }

    console.log('=== Seeding Knowledge Base and Syncing to Vector Store ===');
    const contentDir = path.join(__dirname, '..', 'content', 'quick-topics');
    if (!fs.existsSync(contentDir)) {
        console.error(`Quick-topics content directory does not exist: ${contentDir}`);
        process.exit(1);
    }

    const files = fs.readdirSync(contentDir).filter(f => !f.startsWith('.'));
    let seededCount = 0;

    const clearRes = await db.query("DELETE FROM documents WHERE source_url LIKE 'local://%' OR source_url LIKE 'quick-topics://%'");
    console.log(`Cleared ${clearRes.rowCount} legacy non-synced quick-topic document chunk(s).`);

    for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (ext !== '.md' && ext !== '.txt') continue;

        const filePath = path.join(contentDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const title = content.split('\n')[0].replace(/^#+\s*/, '').trim() || file;
        const category = categorize(title + ' ' + content.substring(0, 500));

        console.log(`Processing: "${title}" (Category: ${category})`);

        // 1. Seed kb_entries table
        const existing = await db.query('SELECT id FROM kb_entries WHERE title = $1', [title]);
        let entryId;
        if (existing.rows.length) {
            entryId = existing.rows[0].id;
            await db.query(
                `UPDATE kb_entries 
                 SET category = $1, content = $2, is_published = TRUE, updated_at = NOW() 
                 WHERE id = $3`,
                [category, content, entryId]
            );
            console.log(`  Updated existing KB entry: ${entryId}`);
        } else {
            const insertRes = await db.query(
                `INSERT INTO kb_entries (category, title, content, is_published) 
                 VALUES ($1, $2, $3, TRUE) RETURNING id`,
                [category, title, content]
            );
            entryId = insertRes.rows[0].id;
            console.log(`  Created new KB entry: ${entryId}`);
        }

        // 2. Sync to documents table (vector database)
        const baseSrc = 'kb-entry://' + String(entryId).trim();
        await db.query(`DELETE FROM documents WHERE source_url = $1`, [baseSrc]);

        const full = title + '\n\n' + content;
        let chunks = chunkText(full).filter((c) => wordCountKb(c) >= MIN_KB_CHUNK_WORDS);
        if (!chunks.length && full.length > 30) {
            const fallback = full.substring(0, 8000);
            if (wordCountKb(fallback) >= 4) chunks = [fallback];
        }

        if (!chunks.length) {
            console.warn(`  No indexable chunks for: ${title}`);
            continue;
        }

        const chunkTitles = chunks.map((_, i) =>
            chunks.length > 1 ? `${title} (part ${i + 1}/${chunks.length})` : title
        );
        const embedInputs = chunkTitles.map((t, i) => t + '\n\n' + chunks[i]);
        
        let embeddings;
        try {
            embeddings = await generateEmbeddings(embedInputs);
        } catch (err) {
            console.error(`  Embedding failed for ${title}: ${err.message}`);
            continue;
        }

        for (let i = 0; i < chunks.length; i++) {
            const embeddingStr = '[' + embeddings[i].join(',') + ']';
            const meta = { manual: true, kb_synced: true, kb_entry_id: String(entryId) };
            await db.query(
                `INSERT INTO documents (source_url, title, content, chunk_index, embedding, category, metadata)
                 VALUES ($1, $2, $3, $4, $5::vector, $6, $7::jsonb)
                 ON CONFLICT (source_url, chunk_index) DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content,
                   embedding = EXCLUDED.embedding, category = EXCLUDED.category, metadata = EXCLUDED.metadata, indexed_at = NOW()`,
                [baseSrc, chunkTitles[i], chunks[i], i, embeddingStr, category, JSON.stringify(meta)]
            );
        }

        console.log(`  Synced ${chunks.length} chunk(s) to vector store.`);
        seededCount++;
    }

    console.log(`\nSuccessfully seeded and synced ${seededCount} entries into Knowledge Base.`);
    process.exit(0);
}

run().catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
});
