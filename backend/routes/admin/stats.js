const router = require('express').Router();
const db = require('../../config/db');
const storage = require('../../services/storage');
const { getToolSchemas } = require('../../services/mcp/registry');

router.get('/stats', async (req, res, next) => {
    try {
        const today = await db.query(`SELECT COUNT(*)::int AS c FROM chats WHERE created_at::date = CURRENT_DATE`);
        const week = await db.query(`SELECT COUNT(*)::int AS c FROM chats WHERE created_at >= NOW() - INTERVAL '7 days'`);
        const weekPrev = await db.query(
            `SELECT COUNT(*)::int AS c FROM chats WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'`
        );
        const month = await db.query(`SELECT COUNT(*)::int AS c FROM chats WHERE created_at >= NOW() - INTERVAL '30 days'`);
        const totalChats = await db.query(`SELECT COUNT(*)::int AS c FROM chats`);
        const activeUsers = await db.query(
            `SELECT COUNT(DISTINCT user_id)::int AS c FROM chats WHERE user_id IS NOT NULL AND updated_at >= NOW() - INTERVAL '7 days'`
        );
        const activeUsersPrev = await db.query(
            `SELECT COUNT(DISTINCT user_id)::int AS c FROM chats WHERE user_id IS NOT NULL AND updated_at >= NOW() - INTERVAL '14 days' AND updated_at < NOW() - INTERVAL '7 days'`
        );
        const guestWeek = await db.query(
            `SELECT COUNT(DISTINCT guest_token)::int AS c FROM chats WHERE guest_token IS NOT NULL AND created_at >= NOW() - INTERVAL '7 days'`
        );
        const pendingEsc = await db.query(`SELECT COUNT(*)::int AS c FROM escalations WHERE status IN ('pending','in_progress')`);
        const avgConf = await db.query(
            `SELECT AVG(confidence_score)::float AS a FROM messages WHERE role = 'assistant' AND created_at::date = CURRENT_DATE AND confidence_score IS NOT NULL`
        );
        const tokensMonth = await db.query(
            `SELECT COALESCE(SUM(tokens_used),0)::bigint AS s FROM messages WHERE role = 'assistant' AND created_at >= date_trunc('month', NOW())`
        );
        const docRows = await db.query(`SELECT COUNT(*)::int AS c FROM documents`);
        const docSources = await db.query(`SELECT COUNT(DISTINCT source_url)::int AS c FROM documents`);
        const docsIndexedWeek = await db.query(
            `SELECT COUNT(*)::int AS c FROM documents WHERE indexed_at >= NOW() - INTERVAL '7 days'`
        );
        const docsIndexedPrev = await db.query(
            `SELECT COUNT(*)::int AS c FROM documents WHERE indexed_at >= NOW() - INTERVAL '14 days' AND indexed_at < NOW() - INTERVAL '7 days'`
        );
        const feedbackRoll = await db.query(`
            SELECT
                COUNT(*) FILTER (
                    WHERE created_at >= NOW() - INTERVAL '7 days'
                )::int AS recent_n,
                COUNT(*) FILTER (
                    WHERE rating IS TRUE AND created_at >= NOW() - INTERVAL '7 days'
                )::int AS recent_pos,
                COUNT(*) FILTER (
                    WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'
                )::int AS prev_n,
                COUNT(*) FILTER (
                    WHERE rating IS TRUE AND created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'
                )::int AS prev_pos,
                COUNT(*)::int AS feedback_total
            FROM feedback
        `);
        const inputCost = 0.0000025;
        const outputCost = 0.00001;
        const estCost = (parseInt(tokensMonth.rows[0].s, 10) || 0) * ((inputCost + outputCost) / 2);

        const fr = feedbackRoll.rows[0] || {};
        const recentN = fr.recent_n || 0;
        const prevN = fr.prev_n || 0;
        const satRecent = recentN > 0 ? fr.recent_pos / recentN : null;
        const satPrev = prevN > 0 ? fr.prev_pos / prevN : null;
        let satisfaction_pct = null;
        let satisfaction_pts_delta = null;
        if ((fr.feedback_total || 0) > 0) {
            const allPos = await db.query(`SELECT COUNT(*) FILTER (WHERE rating IS TRUE)::int AS p, COUNT(*)::int AS n FROM feedback`);
            const n = allPos.rows[0].n || 0;
            if (n > 0) satisfaction_pct = Math.round((allPos.rows[0].p / n) * 1000) / 10;
        }
        if (satRecent != null && satPrev != null) {
            satisfaction_pts_delta = Math.round((satRecent - satPrev) * 1000) / 10;
        }

        const cw = week.rows[0].c || 0;
        const cp = weekPrev.rows[0].c || 0;
        const au = activeUsers.rows[0].c || 0;
        const ap = activeUsersPrev.rows[0].c || 0;
        const diw = docsIndexedWeek.rows[0].c || 0;
        const dip = docsIndexedPrev.rows[0].c || 0;

        const pctDelta = (cur, prev) => {
            if (prev > 0) return Math.round(((cur - prev) / prev) * 1000) / 10;
            if (cur > 0) return null;
            return 0;
        };

        res.json({
            conversations_today: today.rows[0].c,
            conversations_week: cw,
            conversations_month: month.rows[0].c,
            conversations_total: totalChats.rows[0].c,
            active_users_7d: au,
            guest_sessions_week: guestWeek.rows[0].c,
            pending_escalations: pendingEsc.rows[0].c,
            avg_confidence_today: avgConf.rows[0].a,
            estimated_api_cost_month_usd: Math.round(estCost * 10000) / 10000,
            tokens_this_month: parseInt(tokensMonth.rows[0].s, 10) || 0,
            documents_chunks: docRows.rows[0].c,
            documents_sources: docSources.rows[0].c,
            satisfaction_pct,
            trends: {
                conversations_week_pct: pctDelta(cw, cp),
                active_users_7d_pct: pctDelta(au, ap),
                documents_indexed_week_pct: pctDelta(diw, dip),
                satisfaction_pts_delta
            }
        });
    } catch (err) {
        next(err);
    }
});

router.get('/stats/timeseries', async (req, res, next) => {
    try {
        const days = Math.min(parseInt(req.query.days, 10) || 30, 90);
        const result = await db.query(
            `SELECT (created_at AT TIME ZONE 'UTC')::date AS d, COUNT(*)::int AS c
             FROM chats WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
             GROUP BY 1 ORDER BY 1`,
            [days]
        );
        res.json({ points: result.rows });
    } catch (err) {
        next(err);
    }
});

router.get('/stats/categories', async (req, res, next) => {
    try {
        const result = await db.query(
            `SELECT COALESCE(category,'general') AS category, COUNT(*)::int AS count
             FROM documents GROUP BY 1 ORDER BY count DESC`
        );
        res.json({ categories: result.rows });
    } catch (err) {
        next(err);
    }
});

/** Topic mix from user message text (keyword buckets; last N days). */
router.get('/stats/topics', async (req, res, next) => {
    try {
        const days = Math.min(parseInt(req.query.days, 10) || 90, 365);
        const result = await db.query(
            `WITH user_msgs AS (
                SELECT lower(content) AS c
                FROM messages
                WHERE role = 'user'
                  AND created_at >= NOW() - ($1::int * INTERVAL '1 day')
                  AND length(trim(content)) > 0
            ),
            tagged AS (
                SELECT CASE
                    WHEN c ~ 'admission|applicant|apply|intake|entry requirement|enroll' THEN 'Admissions'
                    WHEN c ~ 'fee|tuition|payment|pay fees|billing|invoice|bursar' THEN 'Fees & payments'
                    WHEN c ~ 'exam|test|assessment|quiz|result|grade|mark|gpa' THEN 'Exams & grades'
                    WHEN c ~ 'graduat|degree|certificate|diploma|convocation' THEN 'Graduation'
                    WHEN c ~ 'hostel|accommodation|housing|hall|dorm|residence' THEN 'Accommodation'
                    WHEN c ~ 'library|borrow|book' THEN 'Library'
                    WHEN c ~ 'register|registration|course|module|timetable|curriculum' THEN 'Courses & registration'
                    WHEN c ~ 'scholarship|bursary|financial aid|sponsor' THEN 'Scholarships'
                    WHEN c ~ 'deadline|due date|extension' THEN 'Deadlines'
                    WHEN c ~ 'transcript|portal|student record' THEN 'Records & portal'
                    ELSE 'Other topics'
                END AS topic
                FROM user_msgs
            )
            SELECT topic, COUNT(*)::int AS count
            FROM tagged
            GROUP BY topic
            ORDER BY count DESC`,
            [days]
        );
        const rows = result.rows.filter(r => r.count > 0);
        const maxSlices = 6;
        let segments = [];
        if (rows.length === 0) {
            segments = [];
        } else if (rows.length <= maxSlices) {
            segments = rows.map(r => ({ label: r.topic, value: r.count }));
        } else {
            segments = rows.slice(0, maxSlices - 1).map(r => ({ label: r.topic, value: r.count }));
            const rest = rows.slice(maxSlices - 1).reduce((s, r) => s + r.count, 0);
            if (rest > 0) {
                const other = segments.find(x => x.label === 'Other topics');
                if (other) other.value += rest;
                else segments.push({ label: 'Other topics', value: rest });
            }
        }
        res.json({ segments, days });
    } catch (err) {
        next(err);
    }
});

/** Operational mix for admin dashboard donut (weekly chat/message volume, not KB categories). */
router.get('/stats/performance-overview', async (req, res, next) => {
    try {
        const chatMix = await db.query(
            `SELECT
                 COUNT(*) FILTER (WHERE user_id IS NOT NULL)::int AS reg_chats,
                 COUNT(*) FILTER (WHERE user_id IS NULL)::int AS guest_chats
             FROM chats
             WHERE created_at >= NOW() - INTERVAL '7 days'`
        );
        const msgMix = await db.query(
            `SELECT
                 COUNT(*) FILTER (WHERE role = 'user')::int AS user_msgs,
                 COUNT(*) FILTER (WHERE role = 'assistant')::int AS asst_msgs
             FROM messages
             WHERE created_at >= NOW() - INTERVAL '7 days'
               AND role IN ('user', 'assistant')`
        );

        const r = chatMix.rows[0] || {};
        const m = msgMix.rows[0] || {};

        const segments = [
            { label: 'Signed-in chats', value: r.reg_chats || 0 },
            { label: 'Guest chats', value: r.guest_chats || 0 },
            { label: 'User messages', value: m.user_msgs || 0 },
            { label: 'Assistant replies', value: m.asst_msgs || 0 }
        ];

        res.json({ segments });
    } catch (err) {
        next(err);
    }
});

router.get('/stats/tools', async (req, res, next) => {
    try {
        const tools = getToolSchemas().map(t => ({
            name: t.function.name,
            calls_week: 0,
            calls_month: 0,
            avg_ms: null,
            error_rate: 0
        }));
        res.json({ tools });
    } catch (err) {
        next(err);
    }
});

router.get('/stats/storage', async (req, res, next) => {
    try {
        const buckets = [
            process.env.MINIO_BUCKET_DOCUMENTS || 'documents',
            process.env.MINIO_BUCKET_UPLOADS || 'uploads',
            process.env.MINIO_BUCKET_EXPORTS || 'exports',
            process.env.MINIO_BUCKET_REFERENCE || 'reference'
        ];
        const out = [];
        for (const b of buckets) {
            try {
                const files = await storage.listFiles(b, '');
                const bytes = files.reduce((s, f) => s + (f.size || 0), 0);
                out.push({ bucket: b, files: files.length, bytes });
            } catch {
                out.push({ bucket: b, files: 0, bytes: 0, error: 'unavailable' });
            }
        }
        res.json({ buckets: out, minio_console: process.env.MINIO_CONSOLE_URL || 'http://127.0.0.1:9001' });
    } catch (err) {
        next(err);
    }
});

router.get('/stats/messages-by-hour', async (req, res, next) => {
    try {
        const result = await db.query(
            `SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS h, COUNT(*)::int AS c
             FROM messages WHERE created_at >= NOW() - INTERVAL '30 days'
             GROUP BY 1 ORDER BY 1`
        );
        res.json({ hours: result.rows });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
