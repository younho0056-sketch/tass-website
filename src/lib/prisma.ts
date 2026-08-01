import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import os from 'os';

// In serverless environments (e.g. Vercel), if SQLite is used, copy dev.db to temporary directory
// to ensure write operations (partner creation, blog posts, etc.) succeed on writeable temp filesystem.
const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl || dbUrl.startsWith('file:')) {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    try {
      const tmpDir = os.tmpdir();
      const tmpDbPath = path.join(tmpDir, 'dev.db');
      const sourceDbPath = path.join(process.cwd(), 'dev.db');
      if (!fs.existsSync(tmpDbPath) && fs.existsSync(sourceDbPath)) {
        fs.copyFileSync(sourceDbPath, tmpDbPath);
      }
      if (fs.existsSync(tmpDbPath)) {
        process.env.DATABASE_URL = `file:${tmpDbPath}`;
      }
    } catch (e) {
      console.warn('Could not copy SQLite database to temp dir:', e);
    }
  }
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;


