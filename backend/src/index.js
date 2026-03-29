require('dotenv').config();
BigInt.prototype.toJSON = function () { return this.toString() }
const fastify = require('fastify')({
  logger: true,
  bodyLimit: 10 * 1024 * 1024, // 10MB for base64 image uploads
});

const { serializerCompiler, validatorCompiler } = require('fastify-type-provider-zod');
const cors = require('@fastify/cors');
const multipart = require('@fastify/multipart');

// Set Zod as validator and serializer
fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

// Register base plugins
fastify.register(cors, {
  origin: true, // Allow all origins in development
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
});
fastify.register(multipart, {
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max
  },
});

// Register custom plugins
fastify.register(require('./plugins/prisma'));
fastify.register(require('./plugins/s3'));
fastify.register(require('./plugins/auth')); // JWT authenticate decorator

const { buildPlayerAuth } = require('./plugins/playerAuth');

// Auth routes - public (no token required)
fastify.register(require('./routes/auth'), { prefix: '/api' });

// Protected routes - require Bearer JWT
const authPreHandler = async (request, reply) => {
  // Skip auth for OPTIONS preflight
  if (request.method === 'OPTIONS') return;
  return fastify.authenticate(request, reply);
};
fastify.register(require('./routes/assets'), { prefix: '/api', preHandler: authPreHandler });
fastify.register(require('./routes/screens'), { prefix: '/api', preHandler: authPreHandler });
fastify.register(require('./routes/settings'), { prefix: '/api' }); // GET is public, PATCH is protected internal
fastify.register(require('./routes/search'), { prefix: '/api', preHandler: authPreHandler }); // 搜尋功能需 Auth
fastify.register(require('./routes/analytics'), { prefix: '/api', preHandler: authPreHandler }); // 報表需 Auth
fastify.register(require('./routes/commands'), { prefix: '/api', preHandler: authPreHandler }); // 遠端指令需 Auth

// Player-facing routes: authenticated by X-Screen-Id header
// Uses graceful mode (non-breaking). Set STRICT_PLAYER_AUTH=true in .env to enforce.
fastify.register((playerApp, opts, done) => {
  const playerAuth = buildPlayerAuth();
  playerApp.addHook('preHandler', playerAuth);
  playerApp.register(require('./routes/playlists'), { prefix: '/api' });
  playerApp.register(require('./routes/logs'), { prefix: '/api' });
  playerApp.register(require('./routes/player-heartbeat'), { prefix: '/api' });
  playerApp.register(require('./routes/snapshots'), { prefix: '/api' }); // 截圖上傳 (Player Auth)
  done();
});

// Public proxy for snapshot images (CMS needs to read these without playerAuth)
fastify.get('/api/snapshots/file/:screenId/:filename', async (request, reply) => {
  const { screenId, filename } = request.params;
  const key = `snapshots/${screenId}/${filename}`;
  try {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const response = await fastify.s3.send(new GetObjectCommand({
      Bucket: fastify.bucketName,
      Key: key,
    }));
    reply.header('Content-Type', response.ContentType || 'image/png');
    reply.header('Cache-Control', 'public, max-age=3600');
    if (response.ContentLength) reply.header('Content-Length', response.ContentLength);
    return reply.send(response.Body);
  } catch (err) {
    fastify.log.error('Snapshot proxy failed: %s', err.message);
    return reply.code(404).send({ error: 'Snapshot not found' });
  }
});

fastify.get('/ping', async () => ({ status: 'ok' }));

const { startOfflineAlert } = require('./jobs/offlineAlert');
const { startMaintenanceJob } = require('./jobs/maintenance');

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3001, host: '0.0.0.0' });
    fastify.log.info(`Server listening on ${fastify.server.address().port}`);
    // Start background jobs after server is ready
    startOfflineAlert(fastify.prisma);
    startMaintenanceJob(fastify.prisma);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
