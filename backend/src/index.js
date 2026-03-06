require('dotenv').config();
BigInt.prototype.toJSON = function () { return this.toString() }
const fastify = require('fastify')({
  logger: true,
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
fastify.register(require('./routes/playlists'), { prefix: '/api' }); // playlists stays public (player needs it)
fastify.register(require('./routes/logs'), { prefix: '/api' }); // playback logs are public (player sends them)
fastify.register(require('./routes/settings'), { prefix: '/api' }); // GET is public, PATCH is protected internal
fastify.register(require('./routes/search'), { prefix: '/api', preHandler: authPreHandler }); // 搜尋功能需 Auth
fastify.register(require('./routes/analytics'), { prefix: '/api', preHandler: authPreHandler }); // 報表需 Auth
fastify.get('/ping', async () => ({ status: 'ok' }));

const { startOfflineAlert } = require('./jobs/offlineAlert');

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3001, host: '0.0.0.0' });
    fastify.log.info(`Server listening on ${fastify.server.address().port}`);
    // Start background jobs after server is ready
    startOfflineAlert(fastify.prisma);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
