const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const fs = require('fs');
const db = require('../config/db');
const { generateEmbeddings } = require('../services/embedding');
const { scrapeAnswersMak, scrapeMakMainSite, chunkText, categorize } = require('../services/scraper');

const MIN_WORDS = Math.max(4, parseInt(process.env.INGEST_MIN_CHUNK_WORDS || '10', 10));
const INGEST_VERSION = 1;

function wordCount(s) {
    return (s || '').split(/\s+/).filter(Boolean).length;
}

async function recordIngestionRun(stats) {
    try {
        await db.query(
            `INSERT INTO ingestion_runs (source, status, stats, finished_at)
             VALUES ($1, 'completed', $2::jsonb, NOW())`,
            ['ingest.js', JSON.stringify({ ...stats, version: INGEST_VERSION })]
        );
    } catch (err) {
        if (process.env.DEBUG) console.warn('ingestion_runs not recorded:', err.message);
    }
}

async function ingestArticles(articles) {
    let chunksCreated = 0;
    let errors = 0;
    let chunksSkipped = 0;

    for (const article of articles) {
        try {
            const rawChunks = chunkText(article.content);
            let usedFallback = false;
            let chunks = rawChunks.filter(c => wordCount(c) >= MIN_WORDS);
            if (!chunks.length && (article.content || '').trim().length > 20) {
                const fallback = article.content.replace(/\s+/g, ' ').trim().substring(0, 8000);
                if (wordCount(fallback) >= 4) {
                    chunks = [fallback];
                    usedFallback = true;
                }
            }
            if (usedFallback) {
                chunksSkipped += rawChunks.length;
            } else {
                chunksSkipped += Math.max(0, rawChunks.length - chunks.length);
            }

            if (!chunks.length) {
                console.warn(`  No ingestable chunks for: ${article.title || article.source_url}`);
                continue;
            }

            const texts = chunks.map(c => (article.title ? article.title + '\n\n' : '') + c);

            let embeddings;
            try {
                embeddings = await generateEmbeddings(texts);
            } catch (err) {
                console.warn(`Embedding failed for ${article.title}: ${err.message}`);
                errors++;
                continue;
            }

            for (let i = 0; i < chunks.length; i++) {
                const embeddingStr = '[' + embeddings[i].join(',') + ']';
                const imageKeys = i === 0 ? article.image_keys : null;
                const meta = {
                    ...((article.metadata && typeof article.metadata === 'object' && article.metadata) || {}),
                    chunk_word_count: wordCount(chunks[i]),
                    chunk_of: chunks.length,
                    min_words_applied: MIN_WORDS,
                    ingest_version: INGEST_VERSION
                };

                await db.query(
                    `INSERT INTO documents (source_url, title, content, chunk_index, embedding, category, image_keys, metadata)
                     VALUES ($1, $2, $3, $4, $5::vector, $6, $7, $8)
                     ON CONFLICT (source_url, chunk_index)
                     DO UPDATE SET title = $2, content = $3, embedding = $5::vector, category = $6,
                                   image_keys = $7, metadata = $8, indexed_at = NOW()`,
                    [
                        article.source_url,
                        article.title,
                        chunks[i],
                        i,
                        embeddingStr,
                        article.category,
                        imageKeys ? JSON.stringify(imageKeys) : null,
                        JSON.stringify(meta)
                    ]
                );

                chunksCreated++;
            }
        } catch (err) {
            console.error(`Failed to ingest "${article.title}":`, err.message);
            errors++;
        }
    }

    return { chunksCreated, errors, chunksSkipped, minChunkWords: MIN_WORDS };
}

async function ingestLocalContent() {
    const contentDir = path.join(__dirname, '..', 'content');
    if (!fs.existsSync(contentDir)) return [];

    const articles = [];
    const files = fs.readdirSync(contentDir);

    for (const file of files) {
        const filePath = path.join(contentDir, file);
        const ext = path.extname(file).toLowerCase();

        if (ext === '.md' || ext === '.txt') {
            const content = fs.readFileSync(filePath, 'utf8');
            const title = content.split('\n')[0].replace(/^#+\s*/, '').trim() || file;
            articles.push({
                title,
                content,
                source_url: 'local://' + file,
                category: categorize(title + ' ' + content.substring(0, 500)),
                image_keys: []
            });
        }

        if (ext === '.pdf') {
            try {
                const pdfParse = require('pdf-parse');
                const buffer = fs.readFileSync(filePath);
                const data = await pdfParse(buffer);
                articles.push({
                    title: data.info?.Title || file,
                    content: data.text,
                    source_url: 'local://' + file,
                    category: categorize((data.info?.Title || '') + ' ' + data.text.substring(0, 500)),
                    image_keys: []
                });
            } catch (err) {
                console.warn(`PDF parse failed for ${file}:`, err.message);
            }
        }
    }

    return articles;
}

async function run() {
    console.log('=== AskMak Knowledge Base Ingestion ===\n');
    const startTime = Date.now();

    let allArticles = [];

    console.log('[1/3] Scraping web sources...');
    try {
        const answersArticles = await scrapeAnswersMak();
        console.log(`  Found ${answersArticles.length} articles from answers.mak.ac.ug`);
        allArticles.push(...answersArticles);
    } catch (err) {
        console.error('  Scraping answers.mak.ac.ug failed:', err.message);
    }

    try {
        const mainArticles = await scrapeMakMainSite();
        console.log(`  Found ${mainArticles.length} pages from www.mak.ac.ug`);
        allArticles.push(...mainArticles);
    } catch (err) {
        console.error('  Scraping www.mak.ac.ug failed:', err.message);
    }

    console.log('\n[2/3] Loading local content...');
    try {
        const localArticles = await ingestLocalContent();
        console.log(`  Found ${localArticles.length} local files`);
        allArticles.push(...localArticles);
    } catch (err) {
        console.error('  Local content loading failed:', err.message);
    }

    console.log(`\n[3/3] Generating embeddings and storing ${allArticles.length} articles...`);
    const stats = await ingestArticles(allArticles);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n=== Ingestion Complete ===`);
    console.log(`  Articles processed: ${allArticles.length}`);
    console.log(`  Chunks created: ${stats.chunksCreated}`);
    if (stats.chunksSkipped) console.log(`  Chunks dropped (below ${MIN_WORDS} words): ${stats.chunksSkipped}`);
    console.log(`  Errors: ${stats.errors}`);
    console.log(`  Time: ${elapsed}s`);

    await recordIngestionRun({
        articles: allArticles.length,
        chunksCreated: stats.chunksCreated,
        chunksSkipped: stats.chunksSkipped,
        errors: stats.errors,
        seconds: parseFloat(elapsed),
        min_chunk_words: stats.minChunkWords
    });

    process.exit(0);
}

run().catch(err => {
    console.error('Ingestion failed:', err);
    process.exit(1);
});
