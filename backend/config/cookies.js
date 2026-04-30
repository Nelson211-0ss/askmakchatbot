/** Secure cookies require HTTPS. Set COOKIE_SECURE=false when serving over http:// (e.g. VPS IP only). */
function useSecureCookies() {
    if (process.env.COOKIE_SECURE === 'true') return true;
    if (process.env.COOKIE_SECURE === 'false') return false;
    return process.env.NODE_ENV === 'production';
}

module.exports = { useSecureCookies };
