async function screenRoutes(fastify, opts) {
  // GET Screens
  fastify.get('/screens', async (request, reply) => {
    try {
      const screens = await fastify.prisma.screen.findMany({
        orderBy: { name: 'asc' },
      });

      const now = new Date().getTime();
      return screens.map(s => {
        const lastSeenTime = new Date(s.lastSeen).getTime();
        return {
          ...s,
          status: (now - lastSeenTime < 30000) ? 'ONLINE' : 'OFFLINE',
        };
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Database query failed', message: err.message });
    }
  });

  // POST Screen (Create)
  fastify.post('/screens', async (request, reply) => {
    try {
      const { name, orientation, tags, latitude, longitude } = request.body || {};
      if (!name) return reply.code(400).send({ error: 'Name is required' });

      return await fastify.prisma.screen.create({
        data: {
          name,
          orientation: orientation || 'LANDSCAPE',
          ...(tags ? { tags } : {}),
          ...(latitude !== undefined ? { latitude } : {}),
          ...(longitude !== undefined ? { longitude } : {}),
        },
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Failed to create screen' });
    }
  });

  // PATCH Screen (Update)
  fastify.patch('/screens/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const { name, orientation, tags, latitude, longitude, customBgUrl } = request.body || {};

      const data = {};
      if (name !== undefined) data.name = name;
      if (orientation !== undefined) data.orientation = orientation;
      if (tags !== undefined) data.tags = tags;
      if (latitude !== undefined) data.latitude = latitude;
      if (longitude !== undefined) data.longitude = longitude;
      if (customBgUrl !== undefined) data.customBgUrl = customBgUrl;

      const screen = await fastify.prisma.screen.update({
        where: { id },
        data,
      });
      return screen;
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Failed to update screen' });
    }
  });

  // NOTE: Heartbeat is handled in routes/player-heartbeat.js (behind playerAuth)

  // DELETE Screen
  fastify.delete('/screens/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      await fastify.prisma.screen.delete({ where: { id } });
      return { success: true };
    } catch (err) {
      return reply.code(500).send({ error: 'Delete failed' });
    }
  });
}

module.exports = screenRoutes;
