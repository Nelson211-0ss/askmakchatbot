const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const nodemailer = require('nodemailer');
const db = require('../config/db');
const { authLimiter } = require('../middleware/rateLimit');
const { requireAuth } = require('../middleware/auth');
const { useSecureCookies } = require('../config/cookies');

function getMailTransport() {
    if (!process.env.SMTP_HOST) return null;
    const opts = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true'
    };
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        opts.auth = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
    }
    return nodemailer.createTransport(opts);
}

async function sendVerificationMail(to, subject, html) {
    const transport = getMailTransport();
    if (!transport) return false;
    try {
        await transport.sendMail({
            from: process.env.SMTP_FROM || '"AskMak" <noreply@localhost>',
            to,
            subject,
            html
        });
        return true;
    } catch (err) {
        console.warn('Email send failed:', err.message);
        return false;
    }
}

const signupSchema = Joi.object({
    full_name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(128).required()
});

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function signToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function setAuthCookie(res, token) {
    res.cookie('token', token, {
        httpOnly: true,
        secure: useSecureCookies(),
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
}

router.post('/signup', authLimiter, async (req, res, next) => {
    try {
        const { error, value } = signupSchema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const existing = await db.query('SELECT id FROM users WHERE email = $1', [value.email]);
        if (existing.rows.length) return res.status(409).json({ error: 'Email already registered' });

        const passwordHash = await bcrypt.hash(value.password, 12);
        const code = generateCode();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await db.query(
            `INSERT INTO users (full_name, email, password_hash, verification_code, verification_expires_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [value.full_name, value.email, passwordHash, code, expiresAt]
        );

        const html = `<p>Hi ${value.full_name},</p><p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p>`;
        let emailSent = false;
        if (process.env.VERIFICATION_EMAIL === 'true') {
            emailSent = await sendVerificationMail(value.email, 'Verify your AskMak account', html);
        }
        if (!emailSent) {
            console.log(`[AskMak] Verification code for ${value.email}: ${code}`);
        }

        const message = emailSent
            ? 'Account created. Check your email for the verification code.'
                + (process.env.SMTP_INBOX_URL ? ' Open ' + process.env.SMTP_INBOX_URL + ' to read it locally.' : '')
            : 'Account created. Your verification code is printed in the server console (the terminal where AskMak is running). Enter it on the next screen.';

        res.status(201).json({ message });
    } catch (err) {
        next(err);
    }
});

router.post('/verify', authLimiter, async (req, res, next) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) return res.status(400).json({ error: 'Email and code required' });

        const result = await db.query(
            `SELECT id, full_name, email, role, verification_code, verification_expires_at
             FROM users WHERE email = $1`,
            [email]
        );

        if (!result.rows.length) return res.status(404).json({ error: 'User not found' });

        const user = result.rows[0];

        if (user.verification_code !== code) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        if (new Date() > new Date(user.verification_expires_at)) {
            return res.status(400).json({ error: 'Verification code has expired' });
        }

        await db.query(
            `UPDATE users SET email_verified = TRUE, verification_code = NULL, verification_expires_at = NULL
             WHERE id = $1`,
            [user.id]
        );

        const token = signToken(user);
        setAuthCookie(res, token);

        res.json({ user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role } });
    } catch (err) {
        next(err);
    }
});

router.post('/resend-verification', authLimiter, async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email required' });

        const result = await db.query('SELECT id, full_name, email_verified FROM users WHERE email = $1', [email]);
        if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
        if (result.rows[0].email_verified) return res.status(400).json({ error: 'Email already verified' });

        const code = generateCode();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await db.query(
            'UPDATE users SET verification_code = $1, verification_expires_at = $2 WHERE id = $3',
            [code, expiresAt, result.rows[0].id]
        );

        const html = `<p>Hi ${result.rows[0].full_name},</p><p>Your new verification code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p>`;
        let emailSent = false;
        if (process.env.VERIFICATION_EMAIL === 'true') {
            emailSent = await sendVerificationMail(email, 'Verify your AskMak account', html);
        }
        if (!emailSent) {
            console.log(`[AskMak] New verification code for ${email}: ${code}`);
        }

        const message = emailSent
            ? 'Verification code sent' + (process.env.SMTP_INBOX_URL ? ' Open ' + process.env.SMTP_INBOX_URL + ' to read it locally.' : '')
            : 'A new verification code is printed in the server console.';

        res.json({ message });
    } catch (err) {
        next(err);
    }
});

router.post('/login', authLimiter, async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        const result = await db.query(
            'SELECT id, full_name, email, password_hash, role, email_verified FROM users WHERE email = $1',
            [email]
        );

        if (!result.rows.length) return res.status(401).json({ error: 'Invalid email or password' });

        const user = result.rows[0];

        if (!user.email_verified) return res.status(403).json({ error: 'Please verify your email first' });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

        const token = signToken(user);
        setAuthCookie(res, token);

        res.json({ user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role } });
    } catch (err) {
        next(err);
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out' });
});

router.get('/me', requireAuth, async (req, res, next) => {
    try {
        const result = await db.query(
            'SELECT id, full_name, email, role, created_at FROM users WHERE id = $1',
            [req.user.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
        res.json({ user: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
