const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const logs = await prisma.playbackLog.groupBy({
        by: ['assetId', 'status'],
        _count: { _all: true },
        _sum: { duration: true },
        where: { assetId: { not: null } }
    });

    const assetIds = [...new Set(logs.map(l => l.assetId))];
    const assets = await prisma.asset.findMany({
        where: { id: { in: assetIds } },
        select: { id: true, name: true, type: true }
    });

    const metricsMap = {};
    assets.forEach(a => {
        metricsMap[a.id] = {
            ...a,
            totalImpressions: 0,
            totalDuration: 0,
            errorCount: 0,
        };
    });

    logs.forEach(log => {
        if (!metricsMap[log.assetId]) return;
        if (log.status === 'SUCCESS') {
            metricsMap[log.assetId].totalImpressions += log._count._all;
            metricsMap[log.assetId].totalDuration += (log._sum.duration || 0);
        } else {
            metricsMap[log.assetId].errorCount += log._count._all;
        }
    });

    console.log(JSON.stringify(Object.values(metricsMap), null, 2));
    await prisma.$disconnect();
}

check().catch(e => {
    console.error(e);
    process.exit(1);
});
