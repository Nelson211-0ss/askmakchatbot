function errorHandler(err, req, res, _next) {
    const status = err.status || err.statusCode || 500;
    const message = status >= 500 ? 'Internal server error' : (err.message || 'Something went wrong');

    if (status >= 500) {
        console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, err.stack || err.message);
    }

    res.status(status).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && status >= 500 ? { stack: err.stack } : {})
    });
}

module.exports = errorHandler;
