import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ProcessStep {
  name: string;
  status: string;
  active: boolean;
  date?: string | null;
  memo?: string | null;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    const data = await request.json();

    const existing = await prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    let processStepsStr = existing.processSteps;
    if (data.processSteps) {
      processStepsStr = Array.isArray(data.processSteps) ? JSON.stringify(data.processSteps) : data.processSteps;
    }

    let rawSteps: any[] = [];
    try {
      rawSteps = JSON.parse(processStepsStr);
    } catch {
      rawSteps = [];
    }

    const steps: ProcessStep[] = Array.isArray(rawSteps)
      ? rawSteps.map(s => ({
          name: s.name || '',
          status: s.status || '대기',
          active: s.active !== undefined ? s.active : true,
          date: s.date || null,
          memo: s.memo || null,
        }))
      : [];

    const activeSteps = steps.filter(s => s.active);
    const completedSteps = activeSteps.filter(s => s.status === '완료');
    
    let updatedStatus = data.status || existing.status;
    if (activeSteps.length > 0 && completedSteps.length === activeSteps.length) {
      updatedStatus = '완료';
    } else if (updatedStatus === '완료' && completedSteps.length < activeSteps.length) {
      updatedStatus = '진행중';
    }

    const updateData: any = {
      partnerName: data.partnerName !== undefined ? data.partnerName.trim() : existing.partnerName,
      partnerId: data.partnerId !== undefined ? (data.partnerId ? parseInt(data.partnerId) : null) : existing.partnerId,
      itemName: data.itemName !== undefined ? data.itemName.trim() : existing.itemName,
      quantity: data.quantity !== undefined ? parseInt(data.quantity) : existing.quantity,
      orderDate: data.orderDate !== undefined ? data.orderDate : existing.orderDate,
      dueDate: data.dueDate !== undefined ? data.dueDate : existing.dueDate,
      status: updatedStatus,
      processSteps: processStepsStr,
      memo: data.memo !== undefined ? data.memo : existing.memo,
    };

    if (data.projectNo !== undefined) {
      updateData.projectNo = data.projectNo ? data.projectNo.trim() : null;
    }
    if (data.drawingUrl !== undefined) {
      updateData.drawingUrl = data.drawingUrl ? data.drawingUrl.trim() : null;
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: updateData
    });

    return NextResponse.json({
      ...updated,
      steps
    });
  } catch (error) {
    console.error('Update order error:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.order.delete({
      where: { id: parseInt(id) }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete order error:', error);
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 });
  }
}
