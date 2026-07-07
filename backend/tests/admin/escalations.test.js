const dbMock = require('../mocks/db');
const request = require('supertest');
const express = require('express');

jest.mock('../../config/db', () => require('../mocks/db'));
jest.mock('../../services/storage', () => require('../mocks/storage'));
jest.mock('../../middleware/auth', () => require('../mocks/auth'));
jest.mock('../../middleware/rateLimit', () => ({
    adminLimiter: (req, res, next) => next()
}));

const adminRouter = require('../../routes/admin/index');
const app = express();
app.use(express.json());
app.use('/admin', adminRouter);

describe('Admin Escalations Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /admin/escalations', () => {
        it('should return paginated list of escalations', async () => {
            dbMock.query
                .mockResolvedValueOnce({ rows: [{ id: 'esc-1', status: 'pending' }] })
                .mockResolvedValueOnce({ rows: [{ c: 1 }] });

            const res = await request(app).get('/admin/escalations?status=pending&page=1&limit=20');
            expect(res.status).toBe(200);
            expect(res.body.escalations).toHaveLength(1);
            expect(res.body.total).toBe(1);
        });
    });

    describe('GET /admin/escalations/:id', () => {
        it('should return 404 if escalation not found', async () => {
            dbMock.query.mockResolvedValueOnce({ rows: [] });
            const res = await request(app).get('/admin/escalations/invalid-id');
            expect(res.status).toBe(404);
        });

        it('should return escalation details and chat messages', async () => {
            dbMock.query
                .mockResolvedValueOnce({ rows: [{ id: 'esc-1', chat_id: 'chat-1' }] })
                .mockResolvedValueOnce({ rows: [{ id: 'msg-1', content: 'escalated message' }] });

            const res = await request(app).get('/admin/escalations/esc-1');
            expect(res.status).toBe(200);
            expect(res.body.escalation.id).toBe('esc-1');
            expect(res.body.messages).toHaveLength(1);
        });
    });

    describe('PATCH /admin/escalations/:id', () => {
        it('should return 400 if status is missing', async () => {
            const res = await request(app).patch('/admin/escalations/esc-1').send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Status required');
        });

        it('should return 404 if escalation not found', async () => {
            dbMock.query.mockResolvedValueOnce({ rows: [] });
            const res = await request(app).patch('/admin/escalations/esc-1').send({ status: 'resolved' });
            expect(res.status).toBe(404);
        });

        it('should update status and insert staff response message if provided', async () => {
            dbMock.query
                .mockResolvedValueOnce({ rows: [{ id: 'esc-1', chat_id: 'chat-1' }] }) // UPDATE query
                .mockResolvedValueOnce({ rowCount: 1 }); // INSERT system message

            const res = await request(app)
                .patch('/admin/escalations/esc-1')
                .send({ status: 'resolved', admin_response: 'Resolved.' });

            expect(res.status).toBe(200);
            expect(res.body.id).toBe('esc-1');
            expect(dbMock.query).toHaveBeenCalledTimes(2);
        });
    });

    describe('GET /admin/unresolved', () => {
        it('should return unresolved queries listing', async () => {
            dbMock.query.mockResolvedValueOnce({ rows: [{ id: 'msg-1', content: 'not sure' }] });
            const res = await request(app).get('/admin/unresolved');
            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(1);
        });

        it('should fallback if unresolved dismissals table does not exist', async () => {
            const err = new Error('relation does not exist');
            err.code = '42P01';
            dbMock.query
                .mockRejectedValueOnce(err)
                .mockResolvedValueOnce({ rows: [{ id: 'msg-1', content: 'could not find' }] });

            const res = await request(app).get('/admin/unresolved');
            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(1);
        });
    });

    describe('PATCH /admin/unresolved/:id', () => {
        it('should return 400 if action is invalid', async () => {
            const res = await request(app).patch('/admin/unresolved/msg-1').send({ action: 'invalid' });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('action must be dismiss or escalate');
        });

        it('should successfully dismiss a message', async () => {
            dbMock.query.mockResolvedValueOnce({ rowCount: 1 });
            const res = await request(app).patch('/admin/unresolved/msg-1').send({ action: 'dismiss' });
            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(dbMock.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO admin_unresolved_dismissals'),
                ['msg-1']
            );
        });

        it('should return service unavailable if dismissals table does not exist', async () => {
            const err = new Error('relation does not exist');
            err.code = '42P01';
            dbMock.query.mockRejectedValueOnce(err);

            const res = await request(app).patch('/admin/unresolved/msg-1').send({ action: 'dismiss' });
            expect(res.status).toBe(503);
            expect(res.body.error).toContain('Run db/admin_schema.sql');
        });

        it('should escalate a message successfully', async () => {
            dbMock.query
                .mockResolvedValueOnce({ rows: [{ id: 'msg-1', chat_id: 'chat-1' }] }) // SELECT message
                .mockResolvedValueOnce({ rows: [] }) // SELECT existing escalation (none)
                .mockResolvedValueOnce({ rows: [{ id: 'new-esc-id' }] }); // INSERT escalation

            const res = await request(app).patch('/admin/unresolved/msg-1').send({ action: 'escalate' });
            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.escalation_id).toBe('new-esc-id');
        });

        it('should return existing escalation if already escalated', async () => {
            dbMock.query
                .mockResolvedValueOnce({ rows: [{ id: 'msg-1', chat_id: 'chat-1' }] })
                .mockResolvedValueOnce({ rows: [{ id: 'existing-esc-id' }] });

            const res = await request(app).patch('/admin/unresolved/msg-1').send({ action: 'escalate' });
            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.escalation_id).toBe('existing-esc-id');
        });
    });
});
