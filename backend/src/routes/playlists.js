async function playlistRoutes(fastify, opts) {
  // GET Playlist for a Screen (Core Engine)
  fastify.get('/playlists/:screenId', async (request, reply) => {
    const { screenId } = request.params;
    const now = new Date();
    const currentDay = now.getDay(); // 0-6
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    // Use the start of today (midnight) for date range comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

    return winningSchedule.items.map(item => ({
      id: item.asset.id,
      name: item.asset.name,
      type: item.asset.type,
      url: item.asset.url,
      duration: item.duration || item.asset.duration || 10,
      orientation: item.asset.orientation,
    }));
  });

  // POST Schedule (Create)
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

  // GET All Schedules
  fastify.get('/schedules', async (request, reply) => {
    return fastify.prisma.schedule.findMany({
      include: {
        screen: true,
        items: {
          orderBy: { order: 'asc' },
          include: { asset: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
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
    return fastify.prisma.schedule.findMany({
      where: { screenId },
      include: { items: { include: { asset: true } } },
    });
  });
}

module.exports = playlistRoutes;
