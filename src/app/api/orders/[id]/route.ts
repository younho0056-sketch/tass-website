import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ProcessStep {
  name: string;
  status: string;
  active: boolean;
  date?: string | null;
  memo?: string | null;
}

function sanitizeDateString(dateVal: any): string | null {
  if (dateVal === null || dateVal === undefined) return null;
  const str = String(dateVal).trim();
  if (!str) return null;

  // Match YYYY-MM-DD or YYYY.MM.DD or YYYY/MM/DD
  const match = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Fallback to ISO / JavaScript Date parsing
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return str;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: '유효하지 않은 수주 ID입니다.' }, { status: 400 });
    }

    const data = await request.json();

    const existing = await prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) {
      return NextResponse.json({ error: '해당 수주 건을 찾을 수 없습니다.' }, { status: 404 });
    }

    // Process Steps parsing & normalization
    let processStepsStr = existing.processSteps;
    if (data.processSteps !== undefined) {
      processStepsStr = Array.isArray(data.processSteps)
        ? JSON.stringify(data.processSteps)
        : String(data.processSteps);
    }

    let rawSteps: any[] = [];
    try {
      rawSteps = JSON.parse(processStepsStr);
    } catch {
      rawSteps = [];
    }

    const steps: ProcessStep[] = Array.isArray(rawSteps)
      ? rawSteps.map((s) => ({
          name: s.name || '',
          status: s.status || '대기',
          active: s.active !== undefined ? Boolean(s.active) : true,
          date: sanitizeDateString(s.date),
          memo: s.memo || null,
        }))
      : [];

    const activeSteps = steps.filter((s) => s.active);
    const completedSteps = activeSteps.filter((s) => s.status === '완료');

    let updatedStatus = data.status || existing.status;
    if (activeSteps.length > 0 && completedSteps.length === activeSteps.length) {
      updatedStatus = '완료';
    } else if (updatedStatus === '완료' && completedSteps.length < activeSteps.length) {
      updatedStatus = '진행중';
    }

    // Support flexible client key names (orderDate/order_date, dueDate/due_date/delivery_date)
    const rawOrderDate = data.orderDate !== undefined ? data.orderDate : data.order_date;
    const rawDueDate = data.dueDate !== undefined ? data.dueDate : (data.due_date !== undefined ? data.due_date : data.delivery_date);

    const sanitizedOrderDate = rawOrderDate !== undefined
      ? sanitizeDateString(rawOrderDate)
      : existing.orderDate;

    const sanitizedDueDate = rawDueDate !== undefined
      ? sanitizeDateString(rawDueDate)
      : existing.dueDate;

    const updateData: any = {
      partnerName: data.partnerName !== undefined ? String(data.partnerName).trim() : existing.partnerName,
      partnerId: data.partnerId !== undefined ? (data.partnerId ? parseInt(data.partnerId) : null) : existing.partnerId,
      itemName: data.itemName !== undefined ? String(data.itemName).trim() : existing.itemName,
      quantity: data.quantity !== undefined ? (parseInt(data.quantity) || 1) : existing.quantity,
      orderDate: sanitizedOrderDate,
      dueDate: sanitizedDueDate,
      status: updatedStatus,
      processSteps: processStepsStr,
      memo: data.memo !== undefined ? (data.memo ? String(data.memo).trim() : null) : existing.memo,
      projectNo: data.projectNo !== undefined ? (data.projectNo ? String(data.projectNo).trim() : null) : existing.projectNo,
      drawingUrl: data.drawingUrl !== undefined ? (data.drawingUrl ? String(data.drawingUrl).trim() : null) : existing.drawingUrl,
    };

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    return NextResponse.json({
      ...updated,
      steps,
    });
  } catch (error: any) {
    console.error('Update order error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update order',
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: '유효하지 않은 수주 ID입니다.' }, { status: 400 });
    }

    await prisma.order.delete({
      where: { id: orderId },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete order error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete order',
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
