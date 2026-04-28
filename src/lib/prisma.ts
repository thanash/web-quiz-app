import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  // DATABASE_URL は ?schema=quiz を含む
  const url = process.env.DATABASE_URL!.replace('?schema=quiz', '');
  const pool = new pg.Pool({ connectionString: url });
  const adapter = new PrismaPg(pool, { schema: 'quiz' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter } as any);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
