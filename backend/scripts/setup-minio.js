const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { ensureBucket } = require('../services/storage');

const buckets = [
    process.env.MINIO_BUCKET_DOCUMENTS || 'documents',
    process.env.MINIO_BUCKET_UPLOADS || 'uploads',
    process.env.MINIO_BUCKET_EXPORTS || 'exports',
    process.env.MINIO_BUCKET_REFERENCE || 'reference'
];

async function setup() {
    console.log('Setting up MinIO buckets...');

    for (const bucket of buckets) {
        try {
            await ensureBucket(bucket);
            console.log(`  ✓ ${bucket}`);
        } catch (err) {
            console.error(`  ✗ ${bucket}: ${err.message}`);
        }
    }

    console.log('MinIO setup complete');
    process.exit(0);
}

setup().catch(err => {
    console.error('Setup failed:', err.message);
    process.exit(1);
});
