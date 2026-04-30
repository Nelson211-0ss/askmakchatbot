const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.clearCookie('token');
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function optionalAuth(req, res, next) {
    const token = req.cookies.token;
    if (!token) return next();

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        // ignore invalid tokens for optional auth
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

/** HTML admin shell: redirect non-admins and unauthenticated users (not JSON 401). */
function requireAdminPage(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.redirect(302, '/login.html?next=/admin.html');
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.redirect(302, '/chat.html');
        }
        next();
    } catch (err) {
        res.clearCookie('token');
        return res.redirect(302, '/login.html?next=/admin.html');
    }
}

module.exports = { requireAuth, optionalAuth, requireAdmin, requireAdminPage };
