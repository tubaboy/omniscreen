const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const commands = await prisma.screenCommand.findMany({});
  console.log(JSON.stringify(commands, null, 2));
}
main().then(() => prisma.$disconnect());
