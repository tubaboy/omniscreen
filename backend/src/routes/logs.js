const { z } = require('zod');

async function logsRoutes(fastify, options) {
    // POST /api/logs/playback - Record a playback event (Called by frontend player)
    fastify.post('/logs/playback', {
        schema: {
            tags: ['Analytics'],
            summary: 'Log a playback event',
            body: z.object({
                screenId: z.string().min(1),
                assetId: z.string().optional(),
                scheduleId: z.string().optional(),
                duration: z.number().int().min(0),
                status: z.enum(['SUCCESS', 'ERROR']).default('SUCCESS'),
                errorMessage: z.string().optional(),
            })
        }
    }, async (request, reply) => {
        const data = request.body;

        // Anti-spoofing: if playerAuth set a screenId, body must match
        if (request.playerScreenId && request.playerScreenId !== data.screenId) {
            return reply.code(403).send({ error: 'Screen ID mismatch' });
        }

        try {
            const log = await fastify.prisma.playbackLog.create({
                data: {
                    screenId: data.screenId,
                    assetId: data.assetId,
                    scheduleId: data.scheduleId,
                    duration: data.duration,
                    status: data.status,
                    errorMessage: data.errorMessage,
                }
            });
            return { success: true, logId: log.id };
        } catch (error) {
            request.log.error('Failed to save playback log', error);
            return reply.code(500).send({ error: 'Internal Server Error' });
        }
    });
}

module.exports = logsRoutes;
