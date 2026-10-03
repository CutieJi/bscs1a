const app = require('../server');

module.exports = (req, res) => {
    const requestUrl = req.url || '/';
    if (requestUrl !== '/api' && !requestUrl.startsWith('/api/')) {
        req.url = `/api${requestUrl.startsWith('/') ? '' : '/'}${requestUrl}`;
    }
    return app(req, res);
};
