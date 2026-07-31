import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const partnerId = parseInt(id);
    const data = await request.json();

    if (!data.name || !data.name.trim()) {
      return NextResponse.json({ error: '업체명을 입력해주세요.' }, { status: 400 });
    }

    const existing = await prisma.partner.findFirst({
      where: {
        name: data.name.trim(),
        NOT: { id: partnerId }
      }
    });

    if (existing) {
      return NextResponse.json({ error: '이미 존재하는 업체명입니다.' }, { status: 400 });
    }

    const partner = await prisma.partner.update({
      where: { id: partnerId },
      data: {
        type: data.type,
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
    return NextResponse.json(partner);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update partner' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.partner.delete({
      where: { id: parseInt(id) },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete partner' }, { status: 500 });
  }
}
