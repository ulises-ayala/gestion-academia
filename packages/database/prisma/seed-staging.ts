import { PrismaClient } from '@prisma/client';
import { applySeedData } from './seed/seed-data';
import { assertStagingSeedEnvironment } from './seed/safety';

const prisma = new PrismaClient();

const main = async () => {
  const password = assertStagingSeedEnvironment(process.env);
  const summary = await applySeedData(prisma, { mode: 'staging', password });
  console.log('Seed ficticio de staging aplicado y verificado.');
  console.table(summary);
  console.log('Usuarios: demo-admision, demo-administracion, demo-direccion');
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
