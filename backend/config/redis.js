const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let redisClient = null;

try {
    redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            if (times > 5) {
                console.warn('[AskMak] Redis retry limit reached. Caching may be temporarily disabled.');
                return null;
            }
            return Math.min(times * 50, 2000);
        }
    });

    redisClient.on('error', (err) => {
        console.warn('[AskMak] Redis connection error:', err.message);
    });

    redisClient.on('connect', () => {
        console.log('[AskMak] Connected to Redis for caching.');
    });
} catch (err) {
    console.warn('[AskMak] Failed to initialize Redis:', err.message);
}

/**
 * Safely sets a cache key if Redis is available
 * @param {string} key 
 * @param {number} ttlSeconds 
 * @param {string} value 
 */
async function setCache(key, ttlSeconds, value) {
    if (!redisClient || redisClient.status !== 'ready') return;
    try {
        await redisClient.setex(key, ttlSeconds, value);
    } catch (err) {
        console.warn(`[AskMak] Redis set error for key ${key}:`, err.message);
    }
}

/**
 * Safely gets a cache key if Redis is available
 * @param {string} key 
 * @returns {string|null}
 */
async function getCache(key) {
    if (!redisClient || redisClient.status !== 'ready') return null;
    try {
        return await redisClient.get(key);
    } catch (err) {
        console.warn(`[AskMak] Redis get error for key ${key}:`, err.message);
        return null;
    }
}

/**
 * Scans and deletes all keys matching 'kb:*'
 */
async function clearKBCache() {
    if (!redisClient || redisClient.status !== 'ready') return;
    try {
        const stream = redisClient.scanStream({ match: 'kb:*', count: 100 });
        const keysToDelete = [];
        
        for await (const keys of stream) {
            if (keys.length) {
                keysToDelete.push(...keys);
            }
        }
        
        if (keysToDelete.length > 0) {
            await redisClient.del(...keysToDelete);
            console.log(`[AskMak] Cleared ${keysToDelete.length} KB cache keys.`);
        }
    } catch (err) {
        console.warn('[AskMak] Failed to clear KB cache:', err.message);
    }
}

module.exports = {
    client: redisClient,
    setCache,
    getCache,
    clearKBCache
};
