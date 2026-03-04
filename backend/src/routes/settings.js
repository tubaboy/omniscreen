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

    // POST /settings/test-alert (需 Auth) - 發送測試 LINE 通知
    fastify.post('/settings/test-alert', {
        preHandler: fastify.authenticate,
    }, async (request, reply) => {
        const { sendLineMessage } = require('../jobs/offlineAlert');
        const result = await sendLineMessage('✅ [Omniscreen] 測試告警通知\n\n此訊息確認您的 LINE 通知設定正常運作！');
        if (result?.status === 200) {
            return { success: true, message: 'LINE 測試通知已發送' };
        } else {
            return reply.code(500).send({ error: `LINE API 回傳 ${result?.status}：${result?.body}` });
        }
    });
}

module.exports = settingsRoutes;
