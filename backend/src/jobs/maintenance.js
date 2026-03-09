/**
 * Log Maintenance Job
 * Responsible for aggregating raw PlaybackLog entries into DailyPlaybackStats
 * and pruning old raw logs to keep the database slim.
 */

/**
 * Start the maintenance job.
 * @param {import('@prisma/client').PrismaClient} prisma
 */
function startMaintenanceJob(prisma) {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const RETENTION_DAYS = 90;

    const runMaintenance = async () => {
        console.log('[Maintenance] Starting log aggregation and pruning...');
        try {
            // 1. Aggregation Logic
            // We aggregate logs from "yesterday" (to ensure all logs for that day wrap up)
            const yesterday = new Date();
            yesterday.setHours(0, 0, 0, 0);
            yesterday.setDate(yesterday.getDate() - 1);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Fetch grouped data for yesterday
            const aggregations = await prisma.playbackLog.groupBy({
                by: ['screenId', 'assetId', 'scheduleId', 'status'],
                where: {
                    playedAt: {
                        gte: yesterday,
                        lt: today
                    }
                },
                _count: { _all: true },
                _sum: { duration: true }
            });

            if (aggregations.length > 0) {
                console.log(`[Maintenance] Aggregating ${aggregations.length} groups for ${yesterday.toISOString().split('T')[0]}`);

                // Process each group and upsert into DailyPlaybackStats
                // Note: In high volume, it's better to use raw SQL or batching.
                // For Prisma, we'll combine SUCCESS and ERROR counts into the same stat record.
                const statsMap = new Map();

                for (const agg of aggregations) {
                    const key = `${agg.screenId}_${agg.assetId}_${agg.scheduleId || 'none'}`;
                    if (!statsMap.has(key)) {
                        statsMap.set(key, {
                            date: yesterday,
                            screenId: agg.screenId,
                            assetId: agg.assetId,
                            scheduleId: agg.scheduleId,
                            totalPlays: 0,
                            totalDuration: 0,
                            errorCount: 0
                        });
                    }

                    const stat = statsMap.get(key);
                    if (agg.status === 'SUCCESS') {
                        stat.totalPlays += agg._count._all;
                        stat.totalDuration += (agg._sum.duration || 0);
                    } else {
                        stat.errorCount += agg._count._all;
                    }
                }

                // Batch Upsert (or sequential if batch not easily supported for unique constraints in Prisma without raw)
                for (const stat of statsMap.values()) {
                    await prisma.dailyPlaybackStats.upsert({
                        where: {
                            date_screenId_assetId_scheduleId: {
                                date: stat.date,
                                screenId: stat.screenId,
                                assetId: stat.assetId,
                                scheduleId: stat.scheduleId
                            }
                        },
                        update: {
                            totalPlays: stat.totalPlays,
                            totalDuration: stat.totalDuration,
                            errorCount: stat.errorCount
                        },
                        create: stat
                    });
                }
            }

            // 2. Pruning Logic
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

            const deleteResult = await prisma.playbackLog.deleteMany({
                where: {
                    playedAt: {
                        lt: cutoffDate
                    }
                }
            });

            console.log(`[Maintenance] Pruned ${deleteResult.count} logs older than ${RETENTION_DAYS} days.`);
            console.log('[Maintenance] Job completed successfully.');

        } catch (error) {
            console.error('[Maintenance] Job failed:', error);
        }
    };

    // Run daily at 02:00 AM
    const scheduleNextRun = () => {
        const now = new Date();
        const nextRun = new Date();
        nextRun.setHours(2, 0, 0, 0);
        if (nextRun <= now) {
            nextRun.setDate(nextRun.getDate() + 1);
        }
        const delay = nextRun.getTime() - now.getTime();
        console.log(`[Maintenance] Next run scheduled in ${Math.round(delay / 3600000 * 10) / 10} hours.`);
        setTimeout(() => {
            runMaintenance().then(scheduleNextRun);
        }, delay);
    };

    scheduleNextRun();

    // Optional: Run once at startup for missing past days aggregation if needed
    // setTimeout(runMaintenance, 30000); 
}

module.exports = { startMaintenanceJob };
