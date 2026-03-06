const { z } = require('zod');

async function analyticsRoutes(fastify, options) {

    // GET /api/analytics/assets - Get asset performance metrics
    fastify.get('/analytics/assets', {
        schema: {
            tags: ['Analytics'],
            summary: 'Get asset performance metrics',
            querystring: z.object({
                startDate: z.string().optional(),
                endDate: z.string().optional(),
            })
        }
    }, async (request, reply) => {
        // In a real high-volume app, you'd use raw SQL for group by queries or Prisma's groupBy
        const { startDate, endDate } = request.query;

        const whereClause = {};
        if (startDate || endDate) {
            whereClause.playedAt = {};
            if (startDate) whereClause.playedAt.gte = new Date(startDate);
            if (endDate) whereClause.playedAt.lte = new Date(endDate);
        }

        // Get basic stats per asset
        const logs = await fastify.prisma.playbackLog.groupBy({
            by: ['assetId', 'status'],
            _count: {
                _all: true
            },
            _sum: {
                duration: true
            },
            where: {
                ...whereClause,
                assetId: { not: null }
            }
        });

        // Fetch asset details to join with grouped data
        const assetIds = [...new Set(logs.map(l => l.assetId))];
        const assets = await fastify.prisma.asset.findMany({
            where: { id: { in: assetIds } },
            select: { id: true, name: true, type: true }
        });

        // Format the response
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

        return Object.values(metricsMap);
    });

    // GET /api/analytics/screens - Get screen uptime/playback metrics
    fastify.get('/analytics/screens', {
        schema: {
            tags: ['Analytics'],
            summary: 'Get screen performance metrics',
            querystring: z.object({
                startDate: z.string().optional(),
                endDate: z.string().optional(),
            })
        }
    }, async (request, reply) => {
        const { startDate, endDate } = request.query;

        const playedAtClause = {};
        if (startDate || endDate) {
            if (startDate) playedAtClause.gte = new Date(startDate);
            if (endDate) playedAtClause.lte = new Date(endDate);
        } else {
            // Default to last 30 days if no range provided
            playedAtClause.gte = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        }

        // Similar to above, but grouped by screenId
        const logs = await fastify.prisma.playbackLog.groupBy({
            by: ['screenId', 'status'],
            _count: { _all: true },
            _sum: { duration: true },
            where: {
                playedAt: playedAtClause
            }
        });

        const screenIds = [...new Set(logs.map(l => l.screenId))];
        const screens = await fastify.prisma.screen.findMany({
            where: { id: { in: screenIds } },
            select: { id: true, name: true, status: true, lastSeen: true }
        });

        const screenMap = {};
        screens.forEach(s => {
            screenMap[s.id] = {
                ...s,
                totalPlays: 0,
                totalDuration: 0,
                errorCount: 0,
            };
        });

        logs.forEach(log => {
            if (!screenMap[log.screenId]) return;
            if (log.status === 'SUCCESS') {
                screenMap[log.screenId].totalPlays += log._count._all;
                screenMap[log.screenId].totalDuration += (log._sum.duration || 0);
            } else {
                screenMap[log.screenId].errorCount += log._count._all;
            }
        });

        return Object.values(screenMap);
    });

    // GET /api/analytics/assets/:id - Get detailed metrics for a single asset
    fastify.get('/analytics/assets/:id', {
        schema: {
            tags: ['Analytics'],
            summary: 'Get detailed performance metrics for a specific asset',
            params: z.object({
                id: z.string()
            }),
            querystring: z.object({
                startDate: z.string().optional(),
                endDate: z.string().optional(),
            })
        }
    }, async (request, reply) => {
        const { id } = request.params;
        const { startDate, endDate } = request.query;

        // 1. Get the asset basics
        const asset = await fastify.prisma.asset.findUnique({
            where: { id }
        });

        if (!asset) {
            return reply.status(404).send({ error: 'Asset not found' });
        }

        // 2. Build where clause for logs
        const playedAtClause = {};
        if (startDate || endDate) {
            if (startDate) playedAtClause.gte = new Date(startDate);
            if (endDate) playedAtClause.lte = new Date(endDate);
        } else {
            playedAtClause.gte = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days default
        }

        const logFilter = {
            assetId: id,
            playedAt: playedAtClause,
            status: 'SUCCESS'
        };

        // 3. Fetch all successful logs in range Native Group By might be difficult for daily trunc cast across engines.
        // For general DB agnostic query, fetching recent logs and processing is ok for moderate sizes, or use raw query.
        const logs = await fastify.prisma.playbackLog.findMany({
            where: logFilter,
            select: {
                playedAt: true,
                screenId: true,
                duration: true
            },
            orderBy: {
                playedAt: 'asc'
            }
        });

        // 4. Process Daily Trend
        const dailyTrendMap = {};
        // 5. Process Screen Distribution
        const screenDistributionMap = {};

        let totalImpressions = 0;
        let totalDuration = 0;

        logs.forEach(log => {
            totalImpressions++;
            totalDuration += (log.duration || 0);

            // group by day (YYYY-MM-DD local logic approx)
            const dateKey = log.playedAt.toISOString().split('T')[0];
            if (!dailyTrendMap[dateKey]) {
                dailyTrendMap[dateKey] = { date: dateKey, impressions: 0, duration: 0 };
            }
            dailyTrendMap[dateKey].impressions += 1;
            dailyTrendMap[dateKey].duration += (log.duration || 0);

            // group by screen
            if (!screenDistributionMap[log.screenId]) {
                screenDistributionMap[log.screenId] = { screenId: log.screenId, impressions: 0, duration: 0 };
            }
            screenDistributionMap[log.screenId].impressions += 1;
            screenDistributionMap[log.screenId].duration += (log.duration || 0);
        });

        // 6. Fetch names for the screens
        const screenIds = Object.keys(screenDistributionMap);
        const screens = await fastify.prisma.screen.findMany({
            where: { id: { in: screenIds } },
            select: { id: true, name: true }
        });

        const screenDistribution = Object.values(screenDistributionMap).map(dist => {
            const screenInfo = screens.find(s => s.id === dist.screenId);
            return {
                screenId: dist.screenId,
                name: screenInfo ? screenInfo.name : 'Unknown Screen',
                impressions: dist.impressions,
                duration: dist.duration
            };
        }).sort((a, b) => b.impressions - a.impressions);

        const dailyTrend = Object.values(dailyTrendMap).sort((a, b) => a.date.localeCompare(b.date));

        // 7. Get error count separately
        const errorCount = await fastify.prisma.playbackLog.count({
            where: {
                assetId: id,
                playedAt: playedAtClause,
                status: 'ERROR'
            }
        });

        return {
            asset,
            totalImpressions,
            totalDuration,
            errorCount,
            dailyTrend,
            screenDistribution
        };
    });

    // GET /api/analytics/schedules - Get general performance metrics for all schedules
    fastify.get('/analytics/schedules', {
        schema: {
            tags: ['Analytics'],
            summary: 'Get performance metrics aggregated by schedule',
            querystring: z.object({
                startDate: z.string().optional(),
                endDate: z.string().optional(),
            })
        }
    }, async (request, reply) => {
        const { startDate, endDate } = request.query;

        // Build where clause for logs
        const playedAtClause = {};
        if (startDate || endDate) {
            if (startDate) playedAtClause.gte = new Date(startDate);
            if (endDate) playedAtClause.lte = new Date(endDate);
        } else {
            // Default to last 30 days
            playedAtClause.gte = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        }

        // Fetch all schedules for reference
        const schedules = await fastify.prisma.schedule.findMany({
            select: { id: true, name: true, screenId: true }
        });

        // 1. Group by scheduleId for total plays and duration
        const logs = await fastify.prisma.playbackLog.groupBy({
            by: ['scheduleId', 'status'],
            where: {
                playedAt: playedAtClause
            },
            _count: {
                _all: true
            },
            _sum: {
                duration: true
            }
        });

        const scheduleMap = {};
        schedules.forEach(s => {
            scheduleMap[s.id] = {
                id: s.id,
                name: s.name,
                screenId: s.screenId,
                totalPlays: 0,
                totalDuration: 0,
                errorCount: 0,
            };
        });

        logs.forEach(log => {
            if (!log.scheduleId) return; // Might be logs without schedule context
            if (!scheduleMap[log.scheduleId]) return;

            if (log.status === 'SUCCESS') {
                scheduleMap[log.scheduleId].totalPlays += log._count._all;
                scheduleMap[log.scheduleId].totalDuration += (log._sum.duration || 0);
            } else {
                scheduleMap[log.scheduleId].errorCount += log._count._all;
            }
        });

        return Object.values(scheduleMap);
    });

    // GET /api/analytics/schedules/:id - Get detailed metrics for a single schedule
    fastify.get('/analytics/schedules/:id', {
        schema: {
            tags: ['Analytics'],
            summary: 'Get detailed performance metrics for a specific schedule',
            params: z.object({
                id: z.string()
            }),
            querystring: z.object({
                startDate: z.string().optional(),
                endDate: z.string().optional(),
            })
        }
    }, async (request, reply) => {
        const { id } = request.params;
        const { startDate, endDate } = request.query;

        // 1. Get the schedule basics
        const schedule = await fastify.prisma.schedule.findUnique({
            where: { id },
            include: { screen: true }
        });

        if (!schedule) {
            return reply.status(404).send({ error: 'Schedule not found' });
        }

        // 2. Build where clause
        const playedAtClause = {};
        if (startDate || endDate) {
            if (startDate) playedAtClause.gte = new Date(startDate);
            if (endDate) playedAtClause.lte = new Date(endDate);
        } else {
            playedAtClause.gte = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days default
        }

        const logFilter = {
            scheduleId: id,
            playedAt: playedAtClause,
            status: 'SUCCESS'
        };

        // 3. Fetch logs
        const logs = await fastify.prisma.playbackLog.findMany({
            where: logFilter,
            select: {
                playedAt: true,
                assetId: true,
                duration: true
            },
            orderBy: {
                playedAt: 'asc'
            }
        });

        // 4. Process Daily Trend
        const dailyTrendMap = {};
        // 5. Process Asset Distribution
        const assetDistributionMap = {};

        let totalPlays = 0;
        let totalDuration = 0;

        logs.forEach(log => {
            totalPlays++;
            totalDuration += (log.duration || 0);

            // group by day
            const dateKey = log.playedAt.toISOString().split('T')[0];
            if (!dailyTrendMap[dateKey]) {
                dailyTrendMap[dateKey] = { date: dateKey, plays: 0, duration: 0 };
            }
            dailyTrendMap[dateKey].plays += 1;
            dailyTrendMap[dateKey].duration += (log.duration || 0);

            // group by asset
            if (!assetDistributionMap[log.assetId]) {
                assetDistributionMap[log.assetId] = { assetId: log.assetId, plays: 0, duration: 0 };
            }
            assetDistributionMap[log.assetId].plays += 1;
            assetDistributionMap[log.assetId].duration += (log.duration || 0);
        });

        // 6. Fetch names for the assets
        const assetIds = Object.keys(assetDistributionMap);
        const assets = await fastify.prisma.asset.findMany({
            where: { id: { in: assetIds } },
            select: { id: true, name: true, type: true }
        });

        const assetDistribution = Object.values(assetDistributionMap).map(dist => {
            const assetInfo = assets.find(a => a.id === dist.assetId);
            return {
                assetId: dist.assetId,
                name: assetInfo ? assetInfo.name : 'Unknown Asset',
                type: assetInfo ? assetInfo.type : 'UNKNOWN',
                plays: dist.plays,
                duration: dist.duration
            };
        }).sort((a, b) => b.plays - a.plays);

        const dailyTrend = Object.values(dailyTrendMap).sort((a, b) => a.date.localeCompare(b.date));

        // 7. Get error count separately
        const errorCount = await fastify.prisma.playbackLog.count({
            where: {
                scheduleId: id,
                playedAt: playedAtClause,
                status: 'ERROR'
            }
        });

        return {
            schedule: {
                id: schedule.id,
                name: schedule.name,
                screenName: schedule.screen.name
            },
            totalPlays,
            totalDuration,
            errorCount,
            dailyTrend,
            assetDistribution
        };
    });
}

module.exports = analyticsRoutes;
