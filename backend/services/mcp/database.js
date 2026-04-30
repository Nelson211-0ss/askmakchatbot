const db = require('../../config/db');

function register(reg) {
    reg('get_user_context', {
        description: 'Get personalization data about the current user including their saved memories and preferences. Only available for authenticated users.',
        parameters: {
            type: 'object',
            properties: {
                user_id: { type: 'string', description: 'The user ID' }
            },
            required: ['user_id']
        }
    }, async (args, userId) => {
        if (!userId || args.user_id !== userId) {
            return { error: 'Not authorized to access this user data' };
        }

        const userResult = await db.query(
            'SELECT full_name, email, created_at FROM users WHERE id = $1',
            [userId]
        );

        if (!userResult.rows.length) return { error: 'User not found' };

        const memoriesResult = await db.query(
            'SELECT memory_key, memory_value FROM user_memories WHERE user_id = $1',
            [userId]
        );

        const user = userResult.rows[0];
        const memories = {};
        memoriesResult.rows.forEach(m => { memories[m.memory_key] = m.memory_value; });

        return {
            name: user.full_name,
            email: user.email,
            member_since: user.created_at,
            program: memories.program || null,
            year: memories.year || null,
            hall: memories.hall || null,
            college: memories.college || null,
            preferences: Object.entries(memories)
                .filter(([k]) => !['program', 'year', 'hall', 'college'].includes(k))
                .map(([k, v]) => ({ key: k, value: v }))
        };
    });

    reg('get_escalation_status', {
        description: 'Check if there are any pending escalations for a user or chat',
        parameters: {
            type: 'object',
            properties: {
                chat_id: { type: 'string', description: 'The chat ID to check' }
            },
            required: ['chat_id']
        }
    }, async (args) => {
        const result = await db.query(
            `SELECT id, status, created_at FROM escalations
             WHERE chat_id = $1 AND status IN ('pending', 'in_progress')
             ORDER BY created_at DESC LIMIT 1`,
            [args.chat_id]
        );

        if (!result.rows.length) {
            return { has_pending: false };
        }

        const esc = result.rows[0];
        return {
            has_pending: true,
            escalation_id: esc.id,
            status: esc.status,
            created_at: esc.created_at
        };
    });

    reg('search_faq', {
        description: 'Search frequently asked questions in the knowledge base. Use for common questions about registration, fees, accommodation, etc.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'The search query' }
            },
            required: ['query']
        }
    }, async (args) => {
        const result = await db.query(
            `SELECT title, content, category, source_url
             FROM documents
             WHERE category = 'faq' AND tsv @@ plainto_tsquery('english', $1)
             ORDER BY ts_rank(tsv, plainto_tsquery('english', $1)) DESC
             LIMIT 5`,
            [args.query]
        );

        return {
            results: result.rows.map(r => ({
                question: r.title,
                answer: r.content,
                category: r.category,
                source: r.source_url
            }))
        };
    });
}

module.exports = { register };
