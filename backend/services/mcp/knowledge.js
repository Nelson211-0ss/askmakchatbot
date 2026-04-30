const { hybridSearch } = require('../embedding');
const db = require('../../config/db');
const storage = require('../storage');

function register(reg) {
    reg('search_knowledge_base', {
        description: 'Search the Makerere University knowledge base for articles, FAQs, and documents. Use this for questions about admissions, programs, fees, policies, campus services, etc.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'The search query' },
                category: { type: 'string', description: 'Optional category filter (admissions, programs, fees, academic, campus, IT, general)' },
                limit: { type: 'integer', description: 'Number of results (default 5)' }
            },
            required: ['query']
        }
    }, async (args) => {
        const { documents, retrieval } = await hybridSearch(args.query, {
            category: args.category,
            limit: args.limit || 5
        });

        return {
            results: documents.map(r => ({
                title: r.title,
                content: r.content,
                source_url: r.source_url,
                category: r.category,
                similarity: r.score,
                retrieval_strength: r.vectorSimilarity != null
                    ? r.vectorSimilarity
                    : r.ftsRank != null
                        ? Math.min(1, r.ftsRank * 5)
                        : r.score,
                best_match_score: retrieval.bestStrength,
                met_confidence_threshold: retrieval.passedThreshold,
                images: r.image_urls || []
            })),
            sources: documents.filter(r => r.source_url).map(r => ({
                title: r.title,
                url: r.source_url
            }))
        };
    });

    reg('get_article', {
        description: 'Fetch the full content of a specific knowledge base article by its source URL',
        parameters: {
            type: 'object',
            properties: {
                source_url: { type: 'string', description: 'The source URL of the article' }
            },
            required: ['source_url']
        }
    }, async (args) => {
        const result = await db.query(
            `SELECT title, content, image_keys FROM documents
             WHERE source_url = $1 ORDER BY chunk_index`,
            [args.source_url]
        );

        if (!result.rows.length) return { error: 'Article not found' };

        const fullContent = result.rows.map(r => r.content).join('\n\n');
        const allImageKeys = result.rows.flatMap(r => r.image_keys || []);
        const imageUrls = await Promise.all(
            allImageKeys.map(key => storage.getPresignedUrl(process.env.MINIO_BUCKET_DOCUMENTS, key).catch(() => null))
        );

        return {
            title: result.rows[0].title,
            content: fullContent,
            source_url: args.source_url,
            images: imageUrls.filter(Boolean)
        };
    });

    reg('list_categories', {
        description: 'List available knowledge base categories with document counts',
        parameters: { type: 'object', properties: {} }
    }, async () => {
        const result = await db.query(
            `SELECT category, COUNT(DISTINCT source_url) as count
             FROM documents WHERE category IS NOT NULL
             GROUP BY category ORDER BY count DESC`
        );
        return { categories: result.rows };
    });

    reg('get_recent_articles', {
        description: 'Get the most recently indexed knowledge base articles',
        parameters: {
            type: 'object',
            properties: {
                limit: { type: 'integer', description: 'Number of articles (default 5)' }
            }
        }
    }, async (args) => {
        const result = await db.query(
            `SELECT DISTINCT ON (source_url) title, source_url, indexed_at, category
             FROM documents ORDER BY source_url, indexed_at DESC
             LIMIT $1`,
            [args.limit || 5]
        );
        return { articles: result.rows };
    });
}

module.exports = { register };
