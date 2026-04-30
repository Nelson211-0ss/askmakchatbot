const storage = require('../storage');

const REFERENCE_BUCKET = process.env.MINIO_BUCKET_REFERENCE || 'reference';
const DOCUMENTS_BUCKET = process.env.MINIO_BUCKET_DOCUMENTS || 'documents';

function register(reg) {
    reg('get_reference_image', {
        description: 'Get a reference image such as a campus map, building photo, organizational chart, or process diagram. Use when a visual would help answer the question.',
        parameters: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Name or keyword for the image (e.g., "campus map", "main building", "org chart")' }
            },
            required: ['name']
        }
    }, async (args) => {
        const files = await storage.listFiles(REFERENCE_BUCKET, '');
        const searchTerm = args.name.toLowerCase();

        const match = files.find(f =>
            f.key.toLowerCase().includes(searchTerm.replace(/\s+/g, '_')) ||
            f.key.toLowerCase().includes(searchTerm.replace(/\s+/g, '-'))
        );

        if (!match) {
            const partial = files.find(f => {
                const keyLower = f.key.toLowerCase();
                return searchTerm.split(/\s+/).some(word => keyLower.includes(word));
            });
            if (!partial) return { error: 'No matching reference image found' };
            const url = await storage.getPresignedUrl(REFERENCE_BUCKET, partial.key);
            return { name: partial.key, url, description: 'Reference image: ' + partial.key };
        }

        const url = await storage.getPresignedUrl(REFERENCE_BUCKET, match.key);
        return { name: match.key, url, description: 'Reference image: ' + match.key };
    });

    reg('list_reference_images', {
        description: 'List all available reference images (campus maps, building photos, diagrams)',
        parameters: {
            type: 'object',
            properties: {
                category: { type: 'string', description: 'Optional category filter (maps, buildings, diagrams, org-charts)' }
            }
        }
    }, async (args) => {
        const prefix = args.category ? args.category + '/' : '';
        const files = await storage.listFiles(REFERENCE_BUCKET, prefix);

        const images = await Promise.all(files.map(async (f) => {
            const url = await storage.getPresignedUrl(REFERENCE_BUCKET, f.key);
            return { name: f.key, url, size: f.size };
        }));

        return { images };
    });

    reg('get_document_file', {
        description: 'Get a stored document file (PDF, etc.) by its ID or source URL',
        parameters: {
            type: 'object',
            properties: {
                source_url: { type: 'string', description: 'The source URL of the document' }
            },
            required: ['source_url']
        }
    }, async (args) => {
        const db = require('../../config/db');
        const result = await db.query(
            `SELECT id, title, source_url, metadata FROM documents
             WHERE source_url = $1 LIMIT 1`,
            [args.source_url]
        );

        if (!result.rows.length) return { error: 'Document not found' };

        const doc = result.rows[0];
        const fileKey = doc.metadata?.file_key;
        if (!fileKey) return { title: doc.title, source_url: doc.source_url, note: 'No file attachment for this document' };

        const url = await storage.getPresignedUrl(DOCUMENTS_BUCKET, fileKey);
        return { title: doc.title, url, source_url: doc.source_url };
    });
}

module.exports = { register };
