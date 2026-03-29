// Player-only heartbeat route (authenticated by playerAuth middleware in index.js)
async function playerHeartbeatRoutes(fastify, opts) {
  fastify.post('/screens/:id/heartbeat', async (request, reply) => {
    try {
      const { id } = request.params;

      // If playerAuth set request.playerScreenId, enforce it matches the path param
      if (request.playerScreenId && request.playerScreenId !== id) {
        return reply.code(403).send({ error: 'Screen ID mismatch' });
      }

      // Accept optional systemInfo from player
      const { systemInfo } = request.body || {};

      const updateData = { lastSeen: new Date() };
      if (systemInfo && typeof systemInfo === 'object') {
        updateData.systemInfo = systemInfo;
      }

      await fastify.prisma.screen.update({
        where: { id },
        data: updateData,
      });

      // Fetch pending commands for this screen
      const pendingCommands = await fastify.prisma.screenCommand.findMany({
        where: { screenId: id, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
      });

      // Mark fetched commands as COMPLETED (fire-and-forget model)
      if (pendingCommands.length > 0) {
        await fastify.prisma.screenCommand.updateMany({
          where: {
            id: { in: pendingCommands.map(c => c.id) },
          },
          data: { status: 'COMPLETED' },
        });
      }

      return {
        status: 'ok',
        commands: pendingCommands.map(c => ({ id: c.id, type: c.type })),
      };
    } catch (err) {
      return reply.code(500).send({ error: 'Heartbeat failed' });
    }
  });
}

module.exports = playerHeartbeatRoutes;
