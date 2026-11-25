import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ESTIMATE_STATUSES, serializeEstimateFile, cleanSteps, toNullableString } from '@/lib/estimateFiles';

function parseId(id: string) {
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

// 정보 수정 / 상태 변경 / 발주 연결
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await params).id);
    if (id === null) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.projectName !== undefined) {
      const name = String(body.projectName).trim();
      if (!name) return NextResponse.json({ error: '공사명을 입력해주세요.' }, { status: 400 });
      data.projectName = name;
    }
    if (body.partnerName !== undefined) data.partnerName = toNullableString(body.partnerName);
    if (body.quantity !== undefined) {
      const q = parseInt(String(body.quantity), 10);
      data.quantity = q > 0 ? q : 1;
    }
    if (body.amount !== undefined) {
      const a = Number(body.amount);
      data.amount = a > 0 ? a : null;
    }
    if (body.estimateDate !== undefined) data.estimateDate = toNullableString(body.estimateDate);
    if (body.deliveryTerm !== undefined) data.deliveryTerm = toNullableString(body.deliveryTerm);
    if (body.processSteps !== undefined) data.processSteps = JSON.stringify(cleanSteps(body.processSteps));
    if (body.memo !== undefined) data.memo = toNullableString(body.memo);
    if (body.status !== undefined) {
      if (!ESTIMATE_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: '알 수 없는 상태입니다.' }, { status: 400 });
      }
      data.status = body.status;
    }
    if (body.orderId !== undefined) {
      const o = parseInt(String(body.orderId), 10);
      data.orderId = isNaN(o) ? null : o;
    }
    if (body.projectNo !== undefined) data.projectNo = toNullableString(body.projectNo);

    const updated = await prisma.estimateFile.update({ where: { id }, data });
    return NextResponse.json({ file: serializeEstimateFile(updated) });
  } catch (error) {
    console.error('Update estimate file error:', error);
    return NextResponse.json({ error: '견적서 정보 저장 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await params).id);
    if (id === null) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    await prisma.estimateFile.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete estimate file error:', error);
    return NextResponse.json({ error: '견적서 파일 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
