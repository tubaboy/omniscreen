/**
 * playerAuth - Graceful mode preHandler for player-facing routes.
 *
 * Validates that the X-Screen-Id header matches a real Screen in the DB.
 *
 * GRACEFUL MODE: if no header is present → warn and allow through (for backward
 * compat with old players). Once all players are updated, set STRICT_PLAYER_AUTH=true
 * in .env to make missing headers a hard 401.
 *
 * If header is present but the screenId does NOT exist in DB → 403.
 */
function buildPlayerAuth() {
  const strict = process.env.STRICT_PLAYER_AUTH === 'true';

  return async function playerAuth(request, reply) {
    // Always skip preflight
    if (request.method === 'OPTIONS') return;

    const screenId = request.headers['x-screen-id'];

    if (!screenId) {
      if (strict) {
        return reply.code(401).send({ error: 'Missing X-Screen-Id header' });
      }
      // Graceful: let it through but warn
      request.log.warn('[playerAuth] Request missing X-Screen-Id header, allowing in graceful mode');
      return;
    }

    // Verify screen exists
    const screen = await request.server.prisma.screen.findUnique({
      where: { id: screenId },
      select: { id: true },
    });

    if (!screen) {
      return reply.code(403).send({ error: 'Invalid Screen ID' });
    }

    // Attach to request for use in route handlers
    request.playerScreenId = screenId;
  };
}

module.exports = { buildPlayerAuth };
