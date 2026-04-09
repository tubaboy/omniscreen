const { fixAssetUrls } = require('../utils/url');

async function playlistRoutes(fastify, opts) {
  // GET Playlist for a Screen (Core Engine)
  fastify.get('/playlists/:screenId', async (request, reply) => {
    const { screenId } = request.params;

    // If playerAuth verified a screenId, ensure it matches path param (cross-screen protection)
    if (request.playerScreenId && request.playerScreenId !== screenId) {
      return reply.code(403).send({ error: 'Screen ID mismatch' });
    }

    // Force Asia/Taipei timezone for all time comparisons
    const now = new Date();
    // Taipei is UTC+8. No DST in Taiwan.
    const taipeiNow = new Date(now.getTime() + (8 * 60 * 60 * 1000));

    const currentDay = taipeiNow.getUTCDay(); // 0-6
    const currentTime = `${taipeiNow.getUTCHours().toString().padStart(2, '0')}:${taipeiNow.getUTCMinutes().toString().padStart(2, '0')}`;

    // Use the start of today (midnight) in Taipei for date range comparison
    const year = taipeiNow.getUTCFullYear();
    const month = taipeiNow.getUTCMonth();
    const day = taipeiNow.getUTCDate();

    const today = new Date(Date.UTC(year, month, day));
    const tomorrow = new Date(today.getTime() + 86400000);

    // 1. Find all active schedules for this screen and day
    const schedules = await fastify.prisma.schedule.findMany({
      where: {
        screenId,
        isActive: true,
        daysOfWeek: { has: currentDay },
        startTime: { lte: currentTime },
        endTime: { gte: currentTime },
        // Date range filter:
        // startDate must be <= today (or null = no start limit)
        // endDate must be >= today (or null = no end limit)
        AND: [
          {
            OR: [
              { startDate: null },
              { startDate: { lte: tomorrow } },
            ],
          },
          {
            OR: [
              { endDate: null },
              { endDate: { gte: today } },
            ],
          },
        ],
      },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: { asset: true },
        },
      },
      orderBy: { priority: 'desc' },
    });

    if (schedules.length === 0) {
      return []; // No schedule currently active
    }

    // 2. Priority Override: take only the highest priority schedule's items
    const winningSchedule = schedules[0];

    return winningSchedule.items
      .filter(item => {
        const now = new Date();
        const { validFrom, validUntil } = item.asset;
        if (validFrom && now < new Date(validFrom)) return false;
        if (validUntil && now > new Date(validUntil)) return false;
        return true;
      })
      .map(item => {
        const fixedAsset = fixAssetUrls(item.asset, request);
        const isWidget = fixedAsset.type === 'WIDGET';
        let widgetConfig = null;
        if (isWidget) {
          try {
            // Because fixAssetUrls uses a global regex on the string, 
            // the nested bgImageUrl inside the JSON string is already fixed!
            widgetConfig = JSON.parse(fixedAsset.url);
          } catch (e) {
            fastify.log.error('Failed to parse widget config:', e);
          }
        }
        return {
          id: item.id, // Use unique PlaylistItem id for React keys
          assetId: fixedAsset.id,
          scheduleId: item.scheduleId,
          name: fixedAsset.name,
          type: fixedAsset.type,
          url: isWidget ? null : fixedAsset.url,
          duration: item.duration || fixedAsset.duration || 10,
          orientation: fixedAsset.orientation,
          widgetConfig,
        };
      });
  });

  // POST Schedule (Create - single screen)
  fastify.post('/schedules', async (request, reply) => {
    const {
      name, screenId, startTime, endTime, daysOfWeek,
      priority, assetItems = [], startDate, endDate, isActive,
    } = request.body;

    return fastify.prisma.schedule.create({
      data: {
        name,
        screenId,
        startTime,
        endTime,
        daysOfWeek,
        priority: priority ?? 1,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: isActive !== undefined ? isActive : true,
        items: {
          create: assetItems.map((item, index) => ({
            assetId: item.id || item.assetId || item,
            order: index,
            duration: item.duration || undefined,
          })),
        },
      },
      include: { items: true },
    });
  });

  // POST /schedules/batch (Create for multiple screens at once)
  fastify.post('/schedules/batch', async (request, reply) => {
    const {
      name, screenIds, startTime, endTime, daysOfWeek,
      priority, assetItems = [], startDate, endDate, isActive,
    } = request.body;

    if (!Array.isArray(screenIds) || screenIds.length === 0) {
      return reply.code(400).send({ error: 'screenIds must be a non-empty array' });
    }

    const created = await fastify.prisma.$transaction(
      screenIds.map((screenId) =>
        fastify.prisma.schedule.create({
          data: {
            name,
            screenId,
            startTime,
            endTime,
            daysOfWeek,
            priority: priority ?? 1,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            isActive: isActive !== undefined ? isActive : true,
            items: {
              create: assetItems.map((item, index) => ({
                assetId: item.id || item.assetId || item,
                order: index,
                duration: item.duration || undefined,
              })),
            },
          },
          include: { items: true },
        })
      )
    );

    return { created: created.length, schedules: created };
  });

  // GET All Schedules
  fastify.get('/schedules', async (request, reply) => {
    const schedules = await fastify.prisma.schedule.findMany({
      include: {
        screen: true,
        items: {
          orderBy: { order: 'asc' },
          include: { asset: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fix asset URLs in every schedule's items
    return schedules.map(schedule => ({
      ...schedule,
      items: schedule.items.map(item => ({
        ...item,
        asset: fixAssetUrls(item.asset, request),
      })),
    }));
  });

  // POST /schedules/:id (Update)
  fastify.post('/schedules/:id', async (request, reply) => {
    const { id } = request.params;
    const {
      name, screenId, startTime, endTime, daysOfWeek,
      priority, assetItems, isActive, startDate, endDate,
    } = request.body;

    return fastify.prisma.$transaction(async (tx) => {
      if (assetItems) {
        await tx.playlistItem.deleteMany({ where: { scheduleId: id } });
      }
      return tx.schedule.update({
        where: { id },
        data: {
          name,
          screenId,
          startTime,
          endTime,
          daysOfWeek,
          priority,
          isActive,
          // undefined means "don't change"; null means "clear the date"
          startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : undefined,
          endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined,
          items: assetItems
            ? {
              create: assetItems.map((item, index) => ({
                assetId: item.id || item.assetId || item,
                order: index,
                duration: item.duration || undefined,
              })),
            }
            : undefined,
        },
        include: { items: true },
      });
    });
  });

  // DELETE Schedule
  fastify.delete('/schedules/:id', async (request, reply) => {
    const { id } = request.params;
    await fastify.prisma.playlistItem.deleteMany({ where: { scheduleId: id } });
    return fastify.prisma.schedule.delete({ where: { id } });
  });

  // GET Schedules for a Screen
  fastify.get('/screens/:screenId/schedules', async (request, reply) => {
    const { screenId } = request.params;
    const schedules = await fastify.prisma.schedule.findMany({
      where: { screenId },
      include: { items: { include: { asset: true } } },
    });

    return schedules.map(schedule => ({
      ...schedule,
      items: schedule.items.map(item => ({
        ...item,
        asset: fixAssetUrls(item.asset, request),
      })),
    }));
  });
}

module.exports = playlistRoutes;
