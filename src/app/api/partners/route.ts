import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  
  try {
    const partners = await prisma.partner.findMany({
      where: search ? {
        OR: [
          { name: { contains: search } },
          { specialty: { contains: search } }
        ]
      } : undefined,
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(partners);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    if (!data.name || !data.name.trim()) {
      return NextResponse.json({ error: '업체명을 입력해주세요.' }, { status: 400 });
    }

    const existing = await prisma.partner.findUnique({
      where: { name: data.name.trim() }
    });

    if (existing) {
      return NextResponse.json({ error: '이미 존재하는 업체명입니다.' }, { status: 400 });
    }

    const partner = await prisma.partner.create({
      data: {
        type: data.type || '매출처',
        name: data.name.trim(),
        manager: data.manager || null,
        email: data.email || null,
        phone: data.phone || null,
        tel: data.tel || null,
        fax: data.fax || null,
        specialty: data.specialty || '',
        address: data.address || null,
        memo: data.memo || null,
      }
    });
    return NextResponse.json(partner, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create partner' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: '삭제할 항목을 선택해주세요.' }, { status: 400 });
    }

    await prisma.partner.deleteMany({
      where: { id: { in: ids } }
    });

    return NextResponse.json({ success: true, deletedCount: ids.length });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete partners' }, { status: 500 });
  }
}
