const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const screens = await prisma.screen.findMany({ select: { id: true, name: true, systemInfo: true, lastSeen: true } });
  console.log(JSON.stringify(screens, null, 2));
}
main().then(() => prisma.$disconnect());
