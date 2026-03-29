async function commandRoutes(fastify, opts) {
  // POST /screens/:id/commands - Send a single command to a screen
  fastify.post('/screens/:id/commands', async (request, reply) => {
    const { id } = request.params;
    const { type } = request.body || {};

    const validTypes = ['RELOAD', 'SNAPSHOT', 'CLEAR_CACHE'];
    if (!type || !validTypes.includes(type)) {
      return reply.code(400).send({ error: `Invalid command type. Must be one of: ${validTypes.join(', ')}` });
    }

    // Verify screen exists
    const screen = await fastify.prisma.screen.findUnique({ where: { id } });
    if (!screen) return reply.code(404).send({ error: 'Screen not found' });

    const command = await fastify.prisma.screenCommand.create({
      data: { screenId: id, type },
    });

    return command;
  });

  // POST /commands/batch - Send commands to multiple screens or by tag
  fastify.post('/commands/batch', async (request, reply) => {
    const { type, screenIds, tag } = request.body || {};

    const validTypes = ['RELOAD', 'SNAPSHOT', 'CLEAR_CACHE'];
    if (!type || !validTypes.includes(type)) {
      return reply.code(400).send({ error: `Invalid command type. Must be one of: ${validTypes.join(', ')}` });
    }

    let targetIds = screenIds || [];

    // If tag is provided, find all screens with that tag
    if (tag) {
      const screens = await fastify.prisma.screen.findMany({
        where: { tags: { has: tag } },
        select: { id: true },
      });
      targetIds = [...new Set([...targetIds, ...screens.map(s => s.id)])];
    }

    if (targetIds.length === 0) {
      return reply.code(400).send({ error: 'No target screens specified' });
    }

    // Create commands for all target screens
    const commands = await fastify.prisma.screenCommand.createMany({
      data: targetIds.map(screenId => ({ screenId, type })),
    });

    return { success: true, count: commands.count };
  });

  // GET /screens/:id/commands - List commands for a screen (admin view)
  fastify.get('/screens/:id/commands', async (request, reply) => {
    const { id } = request.params;
    const commands = await fastify.prisma.screenCommand.findMany({
      where: { screenId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return commands;
  });
}

module.exports = commandRoutes;
