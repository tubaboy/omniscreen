const https = require('https');

/**
 * Send a LINE push message via LINE Messaging API
 */
async function sendLineMessage(message) {
    const token = process.env.LINE_CHANNEL_TOKEN;
    const userId = process.env.LINE_USER_ID;

    if (!token || !userId) {
        console.warn('[OfflineAlert] LINE_CHANNEL_TOKEN or LINE_USER_ID not set, skipping alert.');
        return;
    }

    const body = JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text: message }],
    });

    return new Promise((resolve, reject) => {
        const req = https.request(
            {
                hostname: 'api.line.me',
                path: '/v2/bot/message/push',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => resolve({ status: res.statusCode, body: data }));
            }
        );
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

/**
 * Start the offline alert monitor.
 * @param {import('@prisma/client').PrismaClient} prisma
 */
function startOfflineAlert(prisma) {
    const CHECK_INTERVAL_MS = 60 * 1000; // every 60 seconds

    const check = async () => {
        try {
            // Get offline threshold from settings (default 2 min)
            const setting = await prisma.systemSetting.findUnique({ where: { key: 'offline_timeout_min' } });
            const timeoutMin = parseInt(setting?.value || '2');
            const cutoff = new Date(Date.now() - timeoutMin * 60 * 1000);

            // Find screens that haven't sent heartbeat within cutoff
            const offlineScreens = await prisma.screen.findMany({
                where: { lastSeen: { lt: cutoff } },
            });

            if (offlineScreens.length === 0) return;

            // Throttle: only alert once per screen per configured interval (default 30 mins)
            const intervalSetting = await prisma.systemSetting.findUnique({ where: { key: 'alert_interval_min' } });
            const intervalMin = parseInt(intervalSetting?.value || '30');
            const THROTTLE_MS = intervalMin * 60 * 1000;

            for (const screen of offlineScreens) {
                const alertKey = `alert_sent_${screen.id}`;
                const lastAlertSetting = await prisma.systemSetting.findUnique({ where: { key: alertKey } });
                const lastAlert = lastAlertSetting ? parseInt(lastAlertSetting.value) : 0;

                if (Date.now() - lastAlert < THROTTLE_MS) continue;

                // Check silent hours (00:00-08:00 default)
                const silentStartSetting = await prisma.systemSetting.findUnique({ where: { key: 'alert_silent_start' } });
                const silentEndSetting = await prisma.systemSetting.findUnique({ where: { key: 'alert_silent_end' } });
                const silentStart = parseInt(silentStartSetting?.value || '0');
                const silentEnd = parseInt(silentEndSetting?.value || '8');
                const currentHour = new Date().getHours();
                
                let isSilent = false;
                if (silentStart < silentEnd) {
                    isSilent = currentHour >= silentStart && currentHour < silentEnd;
                } else if (silentStart > silentEnd) {
                    isSilent = currentHour >= silentStart || currentHour < silentEnd;
                }

                if (isSilent) continue;

                const minutesOffline = Math.floor((Date.now() - new Date(screen.lastSeen).getTime()) / 60000);
                const message = `⚠️ [Omniscreen] 螢幕離線警告\n\n螢幕名稱：${screen.name}\n離線時間：${minutesOffline} 分鐘\n\n請確認設備狀態。`;

                const result = await sendLineMessage(message);
                if (result?.status === 200) {
                    await prisma.systemSetting.upsert({
                        where: { key: alertKey },
                        update: { value: String(Date.now()) },
                        create: { key: alertKey, value: String(Date.now()) },
                    });
                    console.log(`[OfflineAlert] Alert sent for screen: ${screen.name}`);
                } else {
                    console.warn(`[OfflineAlert] LINE API returned status ${result?.status}: ${result?.body}`);
                }
            }
        } catch (err) {
            console.error('[OfflineAlert] Check failed:', err);
        }
    };

    console.log('[OfflineAlert] Monitor started (60s interval)');
    setInterval(check, CHECK_INTERVAL_MS);
    // Run once at startup after 10s to avoid race condition during boot
    setTimeout(check, 10000);
}

module.exports = { startOfflineAlert, sendLineMessage };
