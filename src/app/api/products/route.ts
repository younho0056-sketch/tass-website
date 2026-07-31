import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const dbProducts = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(dbProducts);
  } catch (error) {
    console.error('Fetch products error:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    if (!data.name || !data.name.trim()) {
      return NextResponse.json({ error: '제품명을 입력해주세요.' }, { status: 400 });
    }
    if (!data.imageUrl || !data.imageUrl.trim()) {
      return NextResponse.json({ error: '제품 이미지 URL이 필요합니다.' }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        name: data.name.trim(),
        category: data.category?.trim() || '기타',
        desc: data.desc?.trim() || 'TASS 정품 스마트 산업 설비',
        imageUrl: data.imageUrl.trim()
      }
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
