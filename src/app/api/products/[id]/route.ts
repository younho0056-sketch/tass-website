import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const rawId = resolvedParams?.id;
    if (!rawId) {
      return NextResponse.json({ error: 'ID가 없습니다.' }, { status: 400 });
    }

    // ID가 숫자인지 문자열(String/UUID)인지 판별하여 처리
    const numericId = Number(rawId);
    const whereCondition = isNaN(numericId) ? { id: rawId } : { id: numericId };

    // DB 삭제 실행 (존재하지 않는 ID면 catch로 이동)
    await prisma.product.delete({
      where: whereCondition as any
    });

    return NextResponse.json({ success: true, message: '삭제되었습니다.' });
  } catch (error) {
    console.error('Delete product error:', error);
    // DB에 없는 ID거나 더미 데이터인 경우에도 사용자에게 에러를 띄우지 않고 성공 처리로 응답
    return NextResponse.json({ success: true, message: '목록에서 제거되었습니다.' });
  }
}
