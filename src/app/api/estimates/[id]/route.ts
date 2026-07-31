import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const estId = parseInt(id);
    const data = await request.json();

    const existing = await prisma.estimate.findUnique({ where: { id: estId } });
    if (!existing) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
    }

    let itemsStr = existing.items;
    if (data.items) {
      itemsStr = Array.isArray(data.items) ? JSON.stringify(data.items) : data.items;
    }

    const updated = await prisma.estimate.update({
      where: { id: estId },
      data: {
        docNo: data.docNo !== undefined ? data.docNo.trim() : existing.docNo,
        partnerName: data.partnerName !== undefined ? data.partnerName.trim() : existing.partnerName,
        partnerId: data.partnerId !== undefined ? (data.partnerId ? parseInt(data.partnerId) : null) : existing.partnerId,
        projectName: data.projectName !== undefined ? data.projectName.trim() : existing.projectName,
        quantity: data.quantity !== undefined ? (parseInt(data.quantity) || 1) : existing.quantity,
        date: data.date !== undefined ? data.date : existing.date,
        deliveryTerm: data.deliveryTerm !== undefined ? data.deliveryTerm : existing.deliveryTerm,
        paymentTerm: data.paymentTerm !== undefined ? data.paymentTerm : existing.paymentTerm,
        validity: data.validity !== undefined ? data.validity : existing.validity,
        items: itemsStr,
        subtotal: data.subtotal !== undefined ? parseFloat(data.subtotal) : existing.subtotal,
        vat: data.vat !== undefined ? parseFloat(data.vat) : existing.vat,
        totalAmount: data.totalAmount !== undefined ? parseFloat(data.totalAmount) : existing.totalAmount,
        amountInKorean: data.amountInKorean !== undefined ? data.amountInKorean : existing.amountInKorean,
        status: data.status !== undefined ? data.status : existing.status,
        memo: data.memo !== undefined ? data.memo : existing.memo,
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update estimate error:', error);
    return NextResponse.json({ error: 'Failed to update estimate' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.estimate.delete({
      where: { id: parseInt(id) }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete estimate error:', error);
    return NextResponse.json({ error: 'Failed to delete estimate' }, { status: 500 });
  }
}
