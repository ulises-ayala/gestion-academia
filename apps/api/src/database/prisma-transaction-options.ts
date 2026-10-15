import { Prisma } from '@academy/database';

export const prismaTransactionOptions = {
  maxWait: 10_000,
  timeout: 20_000,
} satisfies NonNullable<Prisma.PrismaClientOptions['transactionOptions']>;

export const integrationTestTimeoutMs = 60_000;
