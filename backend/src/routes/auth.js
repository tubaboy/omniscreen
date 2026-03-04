const jwt = require('jsonwebtoken');

async function authRoutes(fastify) {
    // POST /api/auth/login
    fastify.post('/auth/login', async (request, reply) => {
        const { username, password } = request.body || {};
        const validUser = process.env.CMS_USER || 'admin';
        const validPass = process.env.CMS_PASS || 'omniscreen2024';

        if (username !== validUser || password !== validPass) {
            return reply.code(401).send({ message: '帳號或密碼錯誤' });
        }

        const token = jwt.sign(
            { username },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '7d' }
        );

        return { token, username };
    });

    // POST /api/auth/change-password
    fastify.post('/auth/change-password', {
        preHandler: fastify.authenticate,
    }, async (request, reply) => {
        const { currentPassword, newPassword } = request.body || {};
        const validPass = process.env.CMS_PASS || 'omniscreen2024';

        if (currentPassword !== validPass) {
            return reply.code(401).send({ message: '目前密碼錯誤' });
        }

        // In a real system, you'd update a DB record.
        // Here we update the in-memory env (persists until server restart).
        // For persistent change, user should update .env manually.
        process.env.CMS_PASS = newPassword;

        return { success: true, message: '密碼已更新（重啟後端後需在 .env 更新才能永久生效）' };
    });

    // GET /api/auth/me  — verify token and return current user info
    fastify.get('/auth/me', {
        preHandler: fastify.authenticate,
    }, async (request) => {
        return { username: request.user.username };
    });
}

module.exports = authRoutes;
