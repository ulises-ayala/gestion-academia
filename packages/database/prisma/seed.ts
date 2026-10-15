import { PrismaClient } from '@prisma/client';
import { applySeedData } from './seed/seed-data';
import { assertDevelopmentSeedEnvironment } from './seed/safety';

const prisma = new PrismaClient();

const main = async () => {
  assertDevelopmentSeedEnvironment(process.env);
  const summary = await applySeedData(prisma, {
    mode: 'development',
    password: process.env.DEV_SEED_PASSWORD ?? 'AcademiaDev2026!',
  });
  console.log('Seed de desarrollo aplicado y verificado.');
  console.table(summary);
  console.log('Usuarios: admision, administracion, direccion');
  console.log('Contraseña: DEV_SEED_PASSWORD (o el valor local documentado por defecto).');
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
