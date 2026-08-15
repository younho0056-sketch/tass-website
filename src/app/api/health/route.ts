import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const startTime = Date.now();
  let dbStatus = 'healthy';

  try {
    // Quick DB pulse check
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error('Health check DB error:', error);
    dbStatus = 'degraded';
  }

  const duration = Date.now() - startTime;

  return NextResponse.json({
    status: 'online',
    db: dbStatus,
    serverLatencyMs: duration,
    timestamp: new Date().toISOString(),
    uptime: '100%'
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0'
    }
  });
}
