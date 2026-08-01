import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export async function GET() {
  try {
    const dbProducts = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' }
    });
    // Sanitize any existing Base64 strings in DB to prevent payload bloat
    const sanitized = dbProducts.map(p => ({
      ...p,
      imageUrl: p.imageUrl.startsWith('data:') ? '/images/products/product-1.jpg' : p.imageUrl
    }));
    return NextResponse.json(sanitized);
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

    const cleanUrl = data.imageUrl.trim();
    if (cleanUrl.startsWith('data:')) {
      return NextResponse.json({ 
        error: 'Base64 대용량 이미지 텍스트 저장은 금지되어 있습니다. Supabase Storage에 정식 업로드된 Public URL만 사용할 수 있습니다.' 
      }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        name: data.name.trim(),
        category: data.category?.trim() || '기타',
        desc: data.desc?.trim() || 'TASS 정품 스마트 산업 설비',
        imageUrl: cleanUrl
      }
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error('Create product error:', errMessage);
    return NextResponse.json({ error: 'Failed to create product', details: errMessage }, { status: 500 });
  }
}

