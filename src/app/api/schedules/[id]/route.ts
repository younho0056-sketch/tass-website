import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();

    if (!data.title || !String(data.title).trim()) {
      return NextResponse.json({ error: '일정 제목을 입력해 주세요.' }, { status: 400 });
    }

    const updatedSchedule = await prisma.schedule.update({
      where: { id },
      data: {
        title: String(data.title).trim(),
        description: data.description !== undefined ? (data.description ? String(data.description).trim() : null) : undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        isAllDay: data.isAllDay !== undefined ? Boolean(data.isAllDay) : undefined,
        colorTag: data.colorTag ? String(data.colorTag).trim() : undefined,
        category: data.category ? String(data.category).trim() : undefined,
        authorName: data.authorName !== undefined ? (data.authorName ? String(data.authorName).trim() : null) : undefined,
      },
    });

    return NextResponse.json({ schedule: updatedSchedule });
  } catch (error: any) {
    console.error('Update schedule error:', error);
    return NextResponse.json(
      { error: 'Failed to update schedule', details: error.message || String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.schedule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('Delete schedule error:', error);
    return NextResponse.json(
      { error: 'Failed to delete schedule', details: error.message || String(error) },
      { status: 500 }
    );
  }
}
