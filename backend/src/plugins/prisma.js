const fp = require('fastify-plugin');
const { PrismaClient } = require('@prisma/client');

async function prismaPlugin(fastify, opts) {
  // Prisma 6 會自動從環境變數讀取 DATABASE_URL
  const prisma = new PrismaClient();

  await prisma.$connect();

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (server) => {
    await server.prisma.$disconnect();
  });
}

module.exports = fp(prismaPlugin);
