import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MAX_ESTIMATE_FILE_BYTES, serializeEstimateFile, cleanSteps, toNullableString } from '@/lib/estimateFiles';

// 목록 (파일 내용은 빼고)
export async function GET() {
  try {
    const files = await prisma.estimateFile.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ files: files.map(serializeEstimateFile) });
  } catch (error) {
    console.error('Fetch estimate files error:', error);
    return NextResponse.json({ error: '견적서 파일 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}

// 파일 올리기: multipart/form-data (file + 확인 창에서 고친 정보)
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: '올릴 파일이 없습니다.' }, { status: 400 });
    }
    if (file.size > MAX_ESTIMATE_FILE_BYTES) {
      return NextResponse.json({ error: '파일이 너무 큽니다. 4MB 이하 파일만 올릴 수 있습니다.' }, { status: 413 });
    }

    const projectName = String(form.get('projectName') || '').trim();
    if (!projectName) {
      return NextResponse.json({ error: '공사명을 입력해주세요.' }, { status: 400 });
    }

    let steps: unknown = [];
    try {
      steps = JSON.parse(String(form.get('processSteps') || '[]'));
    } catch {
      steps = [];
    }
    const amountRaw = Number(form.get('amount'));
    const quantityRaw = parseInt(String(form.get('quantity') || '1'), 10);

    const created = await prisma.estimateFile.create({
      data: {
        fileName: file.name,
        mimeType: file.type || null,
        fileSize: file.size,
        projectName,
        partnerName: toNullableString(form.get('partnerName')),
        quantity: quantityRaw > 0 ? quantityRaw : 1,
        amount: amountRaw > 0 ? amountRaw : null,
        estimateDate: toNullableString(form.get('estimateDate')),
        deliveryTerm: toNullableString(form.get('deliveryTerm')),
        processSteps: JSON.stringify(cleanSteps(steps)),
        memo: toNullableString(form.get('memo')),
        content: { create: { data: Buffer.from(await file.arrayBuffer()) } },
      },
    });

    return NextResponse.json({ file: serializeEstimateFile(created) }, { status: 201 });
  } catch (error) {
    console.error('Upload estimate file error:', error);
    return NextResponse.json({ error: '견적서 파일 저장 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
