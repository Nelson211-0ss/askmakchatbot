const dbMock = require('../mocks/db');
const request = require('supertest');
const express = require('express');

jest.mock('../../config/db', () => require('../mocks/db'));
jest.mock('../../services/storage', () => require('../mocks/storage'));
jest.mock('../../middleware/auth', () => require('../mocks/auth'));
jest.mock('../../middleware/rateLimit', () => ({
    adminLimiter: (req, res, next) => next()
}));
jest.mock('../../services/mcp/registry', () => ({
    getToolSchemas: jest.fn().mockReturnValue([
        { function: { name: 'toolA', description: 'desc A' } }
    ])
}));

const adminRouter = require('../../routes/admin/index');
const app = express();
app.use(express.json());
app.use('/admin', adminRouter);

describe('Admin Settings Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /admin/tools', () => {
        it('should return MCP registered tools', async () => {
            const res = await request(app).get('/admin/tools');
            expect(res.status).toBe(200);
            expect(res.body.tools).toEqual([{ name: 'toolA', description: 'desc A' }]);
        });
    });

    describe('GET /admin/tools/log', () => {
        it('should return tool execution calls log', async () => {
            const res = await request(app).get('/admin/tools/log');
            expect(res.status).toBe(200);
            expect(res.body.calls).toBeDefined();
        });
    });

    describe('GET /admin/settings', () => {
        it('should return admin settings rows and env models', async () => {
            dbMock.query.mockResolvedValueOnce({ rows: [{ key: 'my_setting', value: 'my_value' }] });
            const res = await request(app).get('/admin/settings');
            expect(res.status).toBe(200);
            expect(res.body.settings.my_setting).toBe('my_value');
        });

        it('should return graceful mock response when table does not exist', async () => {
            const err = new Error('relation does not exist');
            err.code = '42P01';
            dbMock.query.mockRejectedValueOnce(err);

            const res = await request(app).get('/admin/settings');
            expect(res.status).toBe(200);
            expect(res.body.settings).toEqual({});
            expect(res.body.note).toContain('Run db/admin_schema.sql');
        });
    });

    describe('PUT /admin/settings', () => {
        it('should return 400 if body is invalid', async () => {
            const res = await request(app).put('/admin/settings').send(null);
            expect(res.status).toBe(400);
        });

        it('should update valid keys and skip read-only model config keys', async () => {
            dbMock.query.mockResolvedValue({ rowCount: 1 });
            const res = await request(app)
                .put('/admin/settings')
                .send({
                    settings: {
                        welcome_message: 'hello',
                        openai_model: 'should-be-ignored'
                    }
                });

            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(dbMock.query).toHaveBeenCalledTimes(1);
            expect(dbMock.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO admin_settings'),
                ['welcome_message', '"hello"']
            );
        });
    });
});
