const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand,
    ListObjectsV2Command, HeadObjectCommand, CreateBucketCommand,
    HeadBucketCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({
    endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
    region: 'us-east-1',
    credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || 'askmak_minio',
        secretAccessKey: process.env.MINIO_SECRET_KEY || 'askmak_minio_secret'
    },
    forcePathStyle: true
});

async function ensureBucket(bucket) {
    try {
        await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (err) {
        if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
            await s3.send(new CreateBucketCommand({ Bucket: bucket }));
        }
    }
}

async function uploadFile(bucket, key, buffer, contentType) {
    await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType
    }));
    return key;
}

async function getPresignedUrl(bucket, key, expiresIn = 3600) {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(s3, command, { expiresIn });
}

async function deleteFile(bucket, key) {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

async function listFiles(bucket, prefix) {
    const result = await s3.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined
    }));
    return (result.Contents || []).map(obj => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified
    }));
}

async function fileExists(bucket, key) {
    try {
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
    } catch {
        return false;
    }
}

async function getFileStream(bucket, key) {
    const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return result.Body;
}

module.exports = {
    s3, ensureBucket, uploadFile, getPresignedUrl,
    deleteFile, listFiles, fileExists, getFileStream
};
