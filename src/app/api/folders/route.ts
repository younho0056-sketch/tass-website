import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const folders = await prisma.blogFolder.findMany({
      include: { photos: true },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(folders);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: '프로젝트명을 입력하세요.' }, { status: 400 });
    }
    const folder = await prisma.blogFolder.create({
      data: { name: name.trim() }
    });
    return NextResponse.json(folder, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: '삭제할 폴더 항목을 선택해주세요.' }, { status: 400 });
    }

    const result = await prisma.blogFolder.deleteMany({
      where: {
        id: { in: ids }
      }
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error('Bulk delete folders error:', error);
    return NextResponse.json({ error: 'Failed to bulk delete folders' }, { status: 500 });
  }
}
