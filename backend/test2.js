const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log(await prisma.screen.findMany({ select: { id: true, lastSnapshotUrl: true, snapshotAt: true } }));
}
main().then(() => prisma.$disconnect());
