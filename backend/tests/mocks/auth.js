function requireAuth(req, res, next) {
    req.user = { id: 'mock-admin-id', role: 'admin', email: 'admin@mak.ac.ug' };
    next();
}

function requireAdmin(req, res, next) {
    next();
}

function optionalAuth(req, res, next) {
    req.user = { id: 'mock-admin-id', role: 'admin', email: 'admin@mak.ac.ug' };
    next();
}

function requireAdminPage(req, res, next) {
    next();
}

module.exports = {
    requireAuth,
    requireAdmin,
    optionalAuth,
    requireAdminPage
};
