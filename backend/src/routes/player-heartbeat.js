// Player-only heartbeat route (authenticated by playerAuth middleware in index.js)
async function playerHeartbeatRoutes(fastify, opts) {
  fastify.post('/screens/:id/heartbeat', async (request, reply) => {
    try {
      const { id } = request.params;

      // If playerAuth set request.playerScreenId, enforce it matches the path param
      if (request.playerScreenId && request.playerScreenId !== id) {
        return reply.code(403).send({ error: 'Screen ID mismatch' });
      }

      await fastify.prisma.screen.update({
        where: { id },
        data: { lastSeen: new Date() },
      });
      return { status: 'ok' };
    } catch (err) {
      return reply.code(500).send({ error: 'Heartbeat failed' });
    }
  });
}

module.exports = playerHeartbeatRoutes;
