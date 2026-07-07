const dbMock = require('../mocks/db');
const request = require('supertest');
const express = require('express');

jest.mock('../../config/db', () => require('../mocks/db'));
jest.mock('../../services/storage', () => require('../mocks/storage'));
jest.mock('../../services/embedding', () => require('../mocks/embedding'));
jest.mock('../../middleware/auth', () => require('../mocks/auth'));
jest.mock('../../middleware/rateLimit', () => ({
    adminLimiter: (req, res, next) => next()
}));
jest.mock('pdf-parse', () => {
    return {
        PDFParse: jest.fn().mockImplementation(() => {
            return {
                getText: jest.fn().mockResolvedValue({ text: 'This is some extracted text from pdf document.' }),
                getInfo: jest.fn().mockResolvedValue({ info: { Title: 'Mock PDF Title' } }),
                destroy: jest.fn().mockResolvedValue(true)
            };
        })
    };
}, { virtual: true });

const adminRouter = require('../../routes/admin/index');
const app = express();
app.use(express.json());
app.use('/admin', adminRouter);

describe('Admin Documents Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /admin/documents', () => {
        it('should return documents listing', async () => {
            dbMock.query
                .mockResolvedValueOnce({ rows: [{ id: 'doc-1', title: 'Doc 1' }] })
                .mockResolvedValueOnce({ rows: [{ c: 1 }] });

            const res = await request(app).get('/admin/documents?category=faq&q=test');
            expect(res.status).toBe(200);
            expect(res.body.documents).toHaveLength(1);
            expect(res.body.total).toBe(1);
        });
    });

    describe('POST /admin/documents/upload-pdf', () => {
        it('should upload and ingest a pdf document', async () => {
            dbMock.query.mockResolvedValue({ rows: [{ id: 'new-doc-id' }] });
            
            const res = await request(app)
                .post('/admin/documents/upload-pdf')
                .attach('file', Buffer.from('mock pdf content'), 'test.pdf')
                .field('category', 'faq')
                .field('title', 'My Custom Title');

            expect(res.status).toBe(201);
            expect(res.body.inserted).toBeGreaterThan(0);
            expect(res.body.title).toBe('My Custom Title');
        });
    });

    describe('GET /admin/documents/:id', () => {
        it('should return a single document', async () => {
            dbMock.query.mockResolvedValueOnce({ rows: [{ id: 'doc-1', title: 'Doc 1' }] });
            const res = await request(app).get('/admin/documents/doc-1');
            expect(res.status).toBe(200);
            expect(res.body.document.title).toBe('Doc 1');
        });
    });

    describe('POST /admin/documents', () => {
        it('should create document and call generateEmbedding', async () => {
            dbMock.query.mockResolvedValueOnce({ rows: [{ id: 'doc-1' }] });
            const res = await request(app)
                .post('/admin/documents')
                .send({ title: 'Man title', content: 'Man content', category: 'faq' });

            expect(res.status).toBe(201);
            expect(res.body.id).toBe('doc-1');
        });
    });

    describe('PUT /admin/documents/:id', () => {
        it('should forbid editing synced kb entries', async () => {
            dbMock.query.mockResolvedValueOnce({ rows: [{ id: 'doc-1', source_url: 'kb-entry://123', metadata: { manual: false } }] });
            const res = await request(app)
                .put('/admin/documents/doc-1')
                .send({ title: 'New Title' });

            expect(res.status).toBe(403);
        });

        it('should successfully update a manual entry', async () => {
            dbMock.query
                .mockResolvedValueOnce({ rows: [{ id: 'doc-1', source_url: 'manual://123', metadata: { manual: true } }] })
                .mockResolvedValueOnce({ rowCount: 1 });

            const res = await request(app)
                .put('/admin/documents/doc-1')
                .send({ title: 'Updated manual title', content: 'Updated content' });

            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
        });
    });

    describe('DELETE /admin/documents/:id', () => {
        it('should delete a document and clean up from bucket', async () => {
            dbMock.query
                .mockResolvedValueOnce({ rows: [{ id: 'doc-1', source_url: 'manual://123', image_keys: ['img-1'] }] })
                .mockResolvedValueOnce({ rowCount: 1 });

            const storageMock = require('../mocks/storage');

            const res = await request(app).delete('/admin/documents/doc-1');
            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(storageMock.deleteFile).toHaveBeenCalledWith('documents', 'img-1');
        });
    });

    describe('POST /admin/ingest', () => {
        it('should start ingestion in background', async () => {
            dbMock.query.mockResolvedValueOnce({ rowCount: 1 });
            const res = await request(app).post('/admin/ingest').send({ source: 'all' });
            expect(res.status).toBe(202);
            expect(res.body.message).toBe('Ingestion started in background');
        });
    });

    describe('GET /admin/ingest/status', () => {
        it('should get ingestion status list', async () => {
            dbMock.query
                .mockResolvedValueOnce({ rows: [{ id: 1, source: 'all', status: 'started' }] })
                .mockResolvedValueOnce({ rows: [{ c: 120 }] });

            const res = await request(app).get('/admin/ingest/status');
            expect(res.status).toBe(200);
            expect(res.body.runs).toHaveLength(1);
            expect(res.body.document_chunks).toBe(120);
        });
    });

    describe('GET /admin/reference-images', () => {
        it('should list reference images', async () => {
            const storageMock = require('../mocks/storage');
            storageMock.listFiles.mockResolvedValueOnce([{ key: 'ref-1', size: 100 }]);
            dbMock.query.mockResolvedValueOnce({ rows: [{ object_key: 'ref-1', display_name: 'Map' }] });

            const res = await request(app).get('/admin/reference-images');
            expect(res.status).toBe(200);
            expect(res.body.images).toHaveLength(1);
        });
    });

    describe('POST /admin/reference-images', () => {
        it('should upload a reference image', async () => {
            const res = await request(app)
                .post('/admin/reference-images')
                .attach('image', Buffer.from('mock img data'), 'test.png')
                .field('category', 'maps')
                .field('name', 'main_campus');

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('key');
        });
    });
});
