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

describe('Admin Stats Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /admin/stats', () => {
        it('should return aggregated stats successfully', async () => {
            dbMock.query
                .mockResolvedValueOnce({ rows: [{ c: 5 }] }) // today
                .mockResolvedValueOnce({ rows: [{ c: 20 }] }) // week
                .mockResolvedValueOnce({ rows: [{ c: 15 }] }) // weekPrev
                .mockResolvedValueOnce({ rows: [{ c: 50 }] }) // month
                .mockResolvedValueOnce({ rows: [{ c: 200 }] }) // totalChats
                .mockResolvedValueOnce({ rows: [{ c: 8 }] }) // activeUsers
                .mockResolvedValueOnce({ rows: [{ c: 6 }] }) // activeUsersPrev
                .mockResolvedValueOnce({ rows: [{ c: 12 }] }) // guestWeek
                .mockResolvedValueOnce({ rows: [{ c: 2 }] }) // pendingEsc
                .mockResolvedValueOnce({ rows: [{ a: 0.85 }] }) // avgConf
                .mockResolvedValueOnce({ rows: [{ s: 50000 }] }) // tokensMonth
                .mockResolvedValueOnce({ rows: [{ c: 100 }] }) // docRows
                .mockResolvedValueOnce({ rows: [{ c: 10 }] }) // docSources
                .mockResolvedValueOnce({ rows: [{ c: 15 }] }) // docsIndexedWeek
                .mockResolvedValueOnce({ rows: [{ c: 10 }] }) // docsIndexedPrev
                .mockResolvedValueOnce({ rows: [{
                    recent_n: 10,
                    recent_pos: 8,
                    prev_n: 8,
                    prev_pos: 6,
                    feedback_total: 18
                }] }) // feedbackRoll
                .mockResolvedValueOnce({ rows: [{ p: 14, n: 18 }] }); // satisfaction total

            const res = await request(app).get('/admin/stats');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('conversations_today', 5);
            expect(res.body).toHaveProperty('active_users_7d', 8);
            expect(res.body.trends).toEqual({
                conversations_week_pct: 33.3,
                active_users_7d_pct: 33.3,
                documents_indexed_week_pct: 50,
                satisfaction_pts_delta: 5
            });
        });
    });

    describe('GET /admin/stats/timeseries', () => {
        it('should return timeseries points', async () => {
            dbMock.query.mockResolvedValueOnce({ rows: [{ d: '2026-07-07', c: 10 }] });
            const res = await request(app).get('/admin/stats/timeseries?days=15');
            expect(res.status).toBe(200);
            expect(res.body.points).toHaveLength(1);
            expect(dbMock.query).toHaveBeenCalledWith(expect.any(String), [15]);
        });
    });

    describe('GET /admin/stats/categories', () => {
        it('should return categories count', async () => {
            dbMock.query.mockResolvedValueOnce({ rows: [{ category: 'faq', count: 42 }] });
            const res = await request(app).get('/admin/stats/categories');
            expect(res.status).toBe(200);
            expect(res.body.categories).toEqual([{ category: 'faq', count: 42 }]);
        });
    });

    describe('GET /admin/stats/topics', () => {
        it('should return topic mixes', async () => {
            dbMock.query.mockResolvedValueOnce({ rows: [
                { topic: 'Admissions', count: 10 },
                { topic: 'Fees & payments', count: 5 }
            ] });
            const res = await request(app).get('/admin/stats/topics?days=10');
            expect(res.status).toBe(200);
            expect(res.body.segments).toEqual([
                { label: 'Admissions', value: 10 },
                { label: 'Fees & payments', value: 5 }
            ]);
        });
    });

    describe('GET /admin/stats/performance-overview', () => {
        it('should return performance mix segments', async () => {
            dbMock.query
                .mockResolvedValueOnce({ rows: [{ reg_chats: 10, guest_chats: 5 }] })
                .mockResolvedValueOnce({ rows: [{ user_msgs: 40, asst_msgs: 40 }] });

            const res = await request(app).get('/admin/stats/performance-overview');
            expect(res.status).toBe(200);
            expect(res.body.segments).toEqual([
                { label: 'Signed-in chats', value: 10 },
                { label: 'Guest chats', value: 5 },
                { label: 'User messages', value: 40 },
                { label: 'Assistant replies', value: 40 }
            ]);
        });
    });

    describe('GET /admin/stats/tools', () => {
        it('should list configured tools', async () => {
            const res = await request(app).get('/admin/stats/tools');
            expect(res.status).toBe(200);
            expect(res.body.tools[0].name).toBe('toolA');
        });
    });

    describe('GET /admin/stats/storage', () => {
        it('should return storage usage lists', async () => {
            const storageMock = require('../mocks/storage');
            storageMock.listFiles.mockResolvedValue([{ size: 1024 }, { size: 2048 }]);
            const res = await request(app).get('/admin/stats/storage');
            expect(res.status).toBe(200);
            expect(res.body.buckets[0].files).toBe(2);
            expect(res.body.buckets[0].bytes).toBe(3072);
        });
    });
});
