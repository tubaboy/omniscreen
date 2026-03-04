const jwt = require('jsonwebtoken');
const fp = require('fastify-plugin');

async function authPlugin(fastify) {
    // Decorate with authenticate preHandler
    fastify.decorate('authenticate', async function (request, reply) {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.code(401).send({ message: '未授權：請先登入' });
        }
        const token = authHeader.slice(7);
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
            request.user = payload;
        } catch {
            return reply.code(401).send({ message: 'Token 無效或已過期，請重新登入' });
        }
    });
}

module.exports = fp(authPlugin);
