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

describe('Admin Users Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /admin/activity/recent', () => {
        it('should return recent chats activity list', async () => {
            dbMock.query.mockResolvedValueOnce({ rows: [{ id: 'chat-1', title: 'Chat Title' }] });
            const res = await request(app).get('/admin/activity/recent?limit=10');
            expect(res.status).toBe(200);
            expect(res.body.chats).toHaveLength(1);
            expect(dbMock.query).toHaveBeenCalledWith(expect.any(String), [10]);
        });
    });

    describe('GET /admin/users', () => {
        it('should return paginated and filtered users list', async () => {
            dbMock.query
                .mockResolvedValueOnce({ rows: [{ id: 'user-1', email: 'user@mak.ac.ug' }] }) // list
                .mockResolvedValueOnce({ rows: [{ c: 1 }] }) // count
                .mockResolvedValueOnce({ rows: [{ total_registered: 1, verified: 1 }] }); // summary

            const res = await request(app).get('/admin/users?q=test&page=2&limit=10');
            expect(res.status).toBe(200);
            expect(res.body.users).toHaveLength(1);
            expect(res.body.total).toBe(1);
            expect(dbMock.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $2 OFFSET $3'), ['%test%', 10, 10]);
        });
    });

    describe('GET /admin/users/:id', () => {
        it('should return 404 if user not found', async () => {
            dbMock.query.mockResolvedValueOnce({ rows: [] });
            const res = await request(app).get('/admin/users/invalid-id');
            expect(res.status).toBe(404);
        });

        it('should return user details, memories, chats, and feedback summary', async () => {
            dbMock.query
                .mockResolvedValueOnce({ rows: [{ id: 'user-1', email: 'user@mak.ac.ug' }] }) // user
                .mockResolvedValueOnce({ rows: [{ id: 'mem-1', content: 'remembers x' }] }) // memories
                .mockResolvedValueOnce({ rows: [{ id: 'chat-1', title: 'Hello' }] }) // chats
                .mockResolvedValueOnce({ rows: [{ up: 5, down: 1 }] }); // feedback

            const res = await request(app).get('/admin/users/user-1');
            expect(res.status).toBe(200);
            expect(res.body.user.email).toBe('user@mak.ac.ug');
            expect(res.body.memories).toHaveLength(1);
            expect(res.body.feedback).toEqual({ up: 5, down: 1 });
        });
    });

    describe('DELETE /admin/users/:id', () => {
        it('should block deleting self', async () => {
            const res = await request(app).delete('/admin/users/mock-admin-id');
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Cannot delete self');
        });

        it('should return 404 if user not found', async () => {
            dbMock.query.mockResolvedValueOnce({ rows: [] });
            const res = await request(app).delete('/admin/users/nonexistent');
            expect(res.status).toBe(404);
        });

        it('should block deleting an admin user', async () => {
            dbMock.query.mockResolvedValueOnce({ rows: [{ role: 'admin' }] });
            const res = await request(app).delete('/admin/users/another-admin');
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Cannot delete admin');
        });

        it('should successfully delete a normal user', async () => {
            dbMock.query
                .mockResolvedValueOnce({ rows: [{ role: 'student' }] })
                .mockResolvedValueOnce({ rowCount: 1 }); // DELETE query

            const res = await request(app).delete('/admin/users/student-id');
            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
        });
    });

    describe('GET /admin/conversations', () => {
        it('should list conversations with filters', async () => {
            dbMock.query
                .mockResolvedValueOnce({ rows: [{ id: 'chat-1', title: 'Help' }] })
                .mockResolvedValueOnce({ rows: [{ c: 1 }] });

            const res = await request(app).get('/admin/conversations?guest=1&q=help');
            expect(res.status).toBe(200);
            expect(res.body.conversations).toHaveLength(1);
        });
    });

    describe('GET /admin/conversations/:id', () => {
        it('should return 404 if chat not found', async () => {
            dbMock.query.mockResolvedValueOnce({ rows: [] });
            const res = await request(app).get('/admin/conversations/invalid-id');
            expect(res.status).toBe(404);
        });

        it('should return conversation details and messages', async () => {
            dbMock.query
                .mockResolvedValueOnce({ rows: [{ id: 'chat-1', title: 'Help' }] })
                .mockResolvedValueOnce({ rows: [{ id: 'msg-1', content: 'hi', image_key: 'img-1' }] });

            const storageMock = require('../mocks/storage');
            storageMock.getPresignedUrl.mockResolvedValueOnce('http://image-url');

            const res = await request(app).get('/admin/conversations/chat-1');
            expect(res.status).toBe(200);
            expect(res.body.chat.title).toBe('Help');
            expect(res.body.messages[0].image_url).toBe('http://image-url');
        });
    });

    describe('GET /admin/feedback', () => {
        it('should return feedback listing', async () => {
            dbMock.query
                .mockResolvedValueOnce({ rows: [{ id: 'fb-1', comment: 'good' }] })
                .mockResolvedValueOnce({ rows: [{ c: 1 }] });

            const res = await request(app).get('/admin/feedback?rating=up');
            expect(res.status).toBe(200);
            expect(res.body.feedback).toHaveLength(1);
        });
    });

    describe('GET /admin/feedback/export', () => {
        it('should export feedback as CSV', async () => {
            dbMock.query.mockResolvedValueOnce({ rows: [
                { created_at: '2026-07-07', rating: true, comment: 'Nice "app"', message_content: 'hi', chat_id: 'chat-1', email: 'user@mak.ac.ug', guest_token: null }
            ] });

            const res = await request(app).get('/admin/feedback/export');
            expect(res.status).toBe(200);
            expect(res.header['content-type']).toContain('text/csv');
            expect(res.text).toContain('created_at,rating,comment,message,chat_id,user_email,guest');
            expect(res.text).toContain('"Nice ""app"""');
        });
    });
});
