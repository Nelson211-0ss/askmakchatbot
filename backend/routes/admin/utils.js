const db = require('../../config/db');
const { generateEmbeddings } = require('../../services/embedding');
const { chunkText } = require('../../services/scraper');

const MIN_KB_CHUNK_WORDS = Math.max(4, parseInt(process.env.INGEST_MIN_CHUNK_WORDS || '10', 10));

function wordCountKb(s) {
    return (s || '').split(/\\s+/).filter(Boolean).length;
}

function kbEntryDocumentSourceUrl(entryId) {
    return 'kb-entry://' + String(entryId).trim();
}

async function removeKbSyncedDocuments(entryId) {
    await db.query(`DELETE FROM documents WHERE source_url = $1`, [kbEntryDocumentSourceUrl(entryId)]);
}

/**
 * Keep vector index aligned with a curated kb_entries row (Option A dual-store).
 * Published → replace all chunks for kb-entry://id; draft → remove chunks.
 */
async function syncKbEntryDocuments(entry) {
    const id = entry.id;
    await removeKbSyncedDocuments(id);
    if (!entry.is_published) {
        return { ok: true, chunks: 0, mode: 'cleared_draft' };
    }
    const category = String(entry.category || 'faq').trim() || 'faq';
    const title = String(entry.title || '').trim();
    const body = String(entry.content || '').trim();
    if (!title || !body) {
        return { ok: false, chunks: 0, error: 'missing_title_or_content' };
    }
    const full = title + '\\n\\n' + body;
    let chunks = chunkText(full).filter((c) => wordCountKb(c) >= MIN_KB_CHUNK_WORDS);
    if (!chunks.length && full.length > 30) {
        const fallback = full.substring(0, 8000);
        if (wordCountKb(fallback) >= 4) chunks = [fallback];
    }
    if (!chunks.length) {
        return { ok: false, chunks: 0, error: 'no_indexable_chunks' };
    }
    const baseSrc = kbEntryDocumentSourceUrl(id);
    const chunkTitles = chunks.map((_, i) =>
        chunks.length > 1 ? `${title} (part ${i + 1}/${chunks.length})` : title
    );
    const embedInputs = chunkTitles.map((t, i) => t + '\\n\\n' + chunks[i]);
    const embeddings = await generateEmbeddings(embedInputs);
    for (let i = 0; i < chunks.length; i++) {
        const embeddingStr = '[' + embeddings[i].join(',') + ']';
        const meta = { manual: true, kb_synced: true, kb_entry_id: String(id) };
        await db.query(
            `INSERT INTO documents (source_url, title, content, chunk_index, embedding, category, metadata)
             VALUES ($1, $2, $3, $4, $5::vector, $6, $7::jsonb)
             ON CONFLICT (source_url, chunk_index) DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content,
               embedding = EXCLUDED.embedding, category = EXCLUDED.category, metadata = EXCLUDED.metadata, indexed_at = NOW()`,
            [baseSrc, chunkTitles[i], chunks[i], i, embeddingStr, category, JSON.stringify(meta)]
        );
    }
    return { ok: true, chunks: chunks.length, mode: 'indexed' };
}

module.exports = {
    MIN_KB_CHUNK_WORDS,
    wordCountKb,
    kbEntryDocumentSourceUrl,
    removeKbSyncedDocuments,
    syncKbEntryDocuments
};
