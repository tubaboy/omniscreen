async function settingsRoutes(fastify) {
    // 取得全部設定 (Public, 因為 player 也需要讀取)
    fastify.get('/settings', async (request, reply) => {
        const settings = await fastify.prisma.systemSetting.findMany();
        // 轉成 key-value map 方便前端使用
        // default fallbacks if empty
        const defaultSettings = {
            player_poll_interval: '10',
            offline_timeout_min: '2',
            player_hud: 'true'
        };

        const settingsMap = { ...defaultSettings };
        settings.forEach(s => {
            settingsMap[s.key] = s.value;
        });

        return settingsMap;
    });

    // 更新設定 (需 Auth)
    fastify.patch('/settings', {
        preHandler: fastify.authenticate,
    }, async (request, reply) => {
        const data = request.body || {};

        // 批量 upsert
        const upserts = Object.keys(data).map(key =>
            fastify.prisma.systemSetting.upsert({
                where: { key },
                update: { value: String(data[key]) },
                create: { key, value: String(data[key]) }
            })
        );

        await Promise.all(upserts);

        return { success: true };
    });
}

module.exports = settingsRoutes;
