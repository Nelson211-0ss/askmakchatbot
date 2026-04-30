function errorHandler(err, req, res, _next) {
    const status = err.status || err.statusCode || 500;
    const dev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';

    if (
        err.code === '22000' &&
        String(err.message || '').toLowerCase().includes('dimension')
    ) {
        return res.status(400).json({
            error:
                'Embedding size does not match the database (expected 1536 dimensions). ' +
                'Use text-embedding-3-small, or set EMBEDDING_DIMENSIONS=1536 in .env if you use another v3 embedding model.'
        });
    }

    const expose =
        err.expose === true || status < 500 || (dev && status >= 500);

    const message = expose
        ? (err.message || 'Something went wrong')
        : 'Internal server error';

    if (status >= 500) {
        console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, err.stack || err.message);
    }

    res.status(status).json({
        error: message,
        ...(dev && status >= 500 && err.stack ? { stack: err.stack } : {})
    });
}

module.exports = errorHandler;
