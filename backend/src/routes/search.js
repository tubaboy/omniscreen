async function searchRoutes(fastify, opts) {
    // GET /search - 全域搜尋 API
    fastify.get('/search', async (request, reply) => {
        const { q } = request.query;
        if (!q || q.trim() === '') {
            return { screens: [], assets: [], schedules: [] };
        }

        try {
            // Parallel DB queries for best performance
            const [screens, assets, schedules] = await Promise.all([
                fastify.prisma.screen.findMany({
                    where: { name: { contains: q, mode: 'insensitive' } },
                    take: 5,
                }),
                fastify.prisma.asset.findMany({
                    where: { name: { contains: q, mode: 'insensitive' } },
                    take: 5,
                }),
                fastify.prisma.schedule.findMany({
                    where: { name: { contains: q, mode: 'insensitive' } },
                    take: 5,
                })
            ]);

            return {
                screens,
                assets: assets.map(a => ({ ...a, size: a.size.toString() })),
                schedules
            };
        } catch (err) {
            fastify.log.error('Search error:', err);
            return reply.code(500).send({ error: 'Search failed' });
        }
    });
}

module.exports = searchRoutes;
