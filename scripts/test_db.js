const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.count();
  const events = await prisma.gitHubEvent.count();
  const rules = await prisma.rule.count();
  console.log('Database connected successfully!');
  console.log(`Counts: Users=${users}, Events=${events}, Rules=${rules}`);
}

main()
  .catch((e) => {
    console.error('Error connecting to database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
