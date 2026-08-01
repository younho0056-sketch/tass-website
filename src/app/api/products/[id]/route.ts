import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);

    // If ID is non-numeric (e.g. dummy frontend ID 'prod-xxx'), return success
    if (isNaN(numId)) {
      return NextResponse.json({ success: true, message: 'Dummy item removed' });
    }

    try {
      await prisma.product.delete({
        where: { id: numId }
      });
    } catch (dbErr: unknown) {
      // Prisma P2025: Record to delete does not exist
      const isRecordNotFound = typeof dbErr === 'object' && dbErr !== null && 'code' in dbErr && (dbErr as { code?: string }).code === 'P2025';
      if (isRecordNotFound) {
        return NextResponse.json({ success: true, message: 'Item already removed from DB' });
      }
      throw dbErr;
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error('Delete product error:', errMessage);
    return NextResponse.json({ error: 'Failed to delete product', details: errMessage }, { status: 500 });
  }
}
