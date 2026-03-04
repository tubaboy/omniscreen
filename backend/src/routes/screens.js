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
      const { name, orientation } = request.body || {};
      if (!name) return reply.code(400).send({ error: 'Name is required' });

      return await fastify.prisma.screen.create({
        data: {
          name,
          orientation: orientation || 'LANDSCAPE',
        },
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Failed to create screen' });
    }
  });

  // Heartbeat (Update lastSeen)
  fastify.post('/screens/:id/heartbeat', async (request, reply) => {
    try {
      const { id } = request.params;
      await fastify.prisma.screen.update({
        where: { id },
        data: { lastSeen: new Date() },
      });
      return { status: 'ok' };
    } catch (err) {
      return reply.code(500).send({ error: 'Heartbeat failed' });
    }
  });

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
