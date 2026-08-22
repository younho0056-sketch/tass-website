import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    let whereClause: any = {};

    if (startParam && endParam) {
      const startDate = new Date(startParam);
      const endDate = new Date(endParam);
      whereClause = {
        AND: [
          { startDate: { lte: endDate } },
          { endDate: { gte: startDate } }
        ]
      };
    }

    const schedules = await prisma.schedule.findMany({
      where: whereClause,
      orderBy: { startDate: 'asc' },
    });

    return NextResponse.json({ schedules });
  } catch (error: any) {
    console.error('Fetch schedules error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedules', details: error.message || String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    if (!data.title || !String(data.title).trim()) {
      return NextResponse.json({ error: '일정 제목을 입력해 주세요.' }, { status: 400 });
    }
    if (!data.startDate || !data.endDate) {
      return NextResponse.json({ error: '시작 및 종료 일시를 입력해 주세요.' }, { status: 400 });
    }

    const newSchedule = await prisma.schedule.create({
      data: {
        title: String(data.title).trim(),
        description: data.description ? String(data.description).trim() : null,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isAllDay: Boolean(data.isAllDay),
        colorTag: data.colorTag ? String(data.colorTag).trim() : 'blue',
        category: data.category ? String(data.category).trim() : '일반',
        authorName: data.authorName ? String(data.authorName).trim() : '익명',
      },
    });

    return NextResponse.json({ schedule: newSchedule }, { status: 201 });
  } catch (error: any) {
    console.error('Create schedule error:', error);
    return NextResponse.json(
      { error: 'Failed to create schedule', details: error.message || String(error) },
      { status: 500 }
    );
  }
}
