const storageMock = {
    s3: {},
    ensureBucket: jest.fn().mockResolvedValue(true),
    uploadFile: jest.fn().mockResolvedValue('mock-key'),
    getPresignedUrl: jest.fn().mockResolvedValue('http://mock-presigned-url'),
    deleteFile: jest.fn().mockResolvedValue(true),
    listFiles: jest.fn().mockResolvedValue([{ key: 'mock-key', size: 100, lastModified: new Date() }]),
    fileExists: jest.fn().mockResolvedValue(true),
    getFileStream: jest.fn().mockResolvedValue(null)
};

module.exports = storageMock;
