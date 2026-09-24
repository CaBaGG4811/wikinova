import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function isRemoteUrl(url: string): boolean {
  return url.startsWith('libsql://') || url.startsWith('https://') || url.startsWith('http://');
}

function createDb(): PrismaClient {
  const url = process.env.DATABASE_URL ?? '';
  if (isRemoteUrl(url)) {
    const client = createClient({ url, authToken: process.env.DB_AUTH_TOKEN });
    return new PrismaClient({ adapter: new PrismaLibSQL(client) });
  }
  return new PrismaClient();
}

export const db = globalForPrisma.prisma ?? createDb();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
