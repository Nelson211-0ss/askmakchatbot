const { v4: uuidv4 } = require('uuid');
const { useSecureCookies } = require('../config/cookies');

function guestMiddleware(req, res, next) {
    if (req.cookies.token) return next();

    let guestToken = req.signedCookies.guest_token;
    if (!guestToken) {
        guestToken = uuidv4();
        res.cookie('guest_token', guestToken, {
            signed: true,
            httpOnly: true,
            secure: useSecureCookies(),
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });
    }
    req.guestToken = guestToken;
    next();
}

module.exports = { guestMiddleware };
