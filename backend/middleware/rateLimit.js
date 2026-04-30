const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many attempts, please try again in 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { default: true, ip: false, trustProxy: false }
});

const messageLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: (req) => req.user ? 100 : 20,
    message: { error: 'Message limit reached, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user ? req.user.id : req.guestToken || 'anon',
    validate: false
});

const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: (req) => req.user ? 30 : 10,
    message: { error: 'Upload limit reached, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user ? req.user.id : req.guestToken || 'anon',
    validate: false
});

const adminLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { default: true, ip: false, trustProxy: false }
});

module.exports = { authLimiter, messageLimiter, uploadLimiter, adminLimiter };
