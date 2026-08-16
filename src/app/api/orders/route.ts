import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ProcessStep {
  name: string;
  status: string;
  active: boolean;
  date?: string | null;
}

function sanitizeDateString(dateVal: any): string | null {
  if (dateVal === null || dateVal === undefined) return null;
  const str = String(dateVal).trim();
  if (!str) return null;

  const match = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return str;
}

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const totalCount = orders.length;
    let inProgressCount = 0;
    let nearingDueCount = 0;
    let completedCount = 0;

    const sortedOrders = [...orders].sort((a, b) => a.id - b.id);
    const projectNoMap = new Map<number, string>();
    sortedOrders.forEach((o, index) => {
      projectNoMap.set(o.id, `PRJ-${String(index + 1).padStart(3, '0')}`);
    });

    const parsedOrders = orders.map((order) => {
      let rawSteps: any[] = [];
      try {
        rawSteps = JSON.parse(order.processSteps || '[]');
      } catch {
        rawSteps = [];
      }

      const steps: ProcessStep[] = Array.isArray(rawSteps)
        ? rawSteps.map((s) => ({
            name: s.name || '',
            status: s.status || '대기',
            active: s.active !== undefined ? Boolean(s.active) : true,
            date: sanitizeDateString(s.date),
          }))
        : [];

      const activeSteps = steps.filter((s) => s.active);
      const completedSteps = activeSteps.filter((s) => s.status === '완료');
      const progressPercent =
        activeSteps.length > 0
          ? Math.round((completedSteps.length / activeSteps.length) * 100)
          : 0;

      let currentStatus = order.status;
      if (activeSteps.length > 0 && completedSteps.length === activeSteps.length) {
        currentStatus = '완료';
      } else if (order.dueDate && currentStatus !== '완료') {
        const due = new Date(order.dueDate).getTime();
        const now = new Date().getTime();
        const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
        if (diffDays <= 3 && diffDays >= 0) {
          currentStatus = '납기임박';
        }
      }

      if (currentStatus === '완료') completedCount++;
      else if (currentStatus === '납기임박') nearingDueCount++;
      else inProgressCount++;

      const assignedProjectNo =
        order.projectNo || projectNoMap.get(order.id) || `PRJ-${String(order.id).padStart(3, '0')}`;

      return {
        ...order,
        orderDate: sanitizeDateString(order.orderDate),
        dueDate: sanitizeDateString(order.dueDate),
        projectNo: assignedProjectNo,
        drawingUrl: order.drawingUrl || null,
        status: currentStatus,
        steps,
        progressPercent,
      };
    });

    return NextResponse.json({
      orders: parsedOrders,
      metrics: {
        totalCount,
        inProgressCount,
        nearingDueCount,
        completedCount,
      },
    });
  } catch (error: any) {
    console.error('Fetch orders error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders', details: error.message || String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    if (!data.partnerName || !data.partnerName.trim()) {
      return NextResponse.json({ error: '거래처명을 입력해주세요.' }, { status: 400 });
    }
    if (!data.itemName || !data.itemName.trim()) {
      return NextResponse.json({ error: '품목명을 입력해주세요.' }, { status: 400 });
    }

    const steps: ProcessStep[] = data.processSteps || [
      { name: '설계', status: '대기', active: true },
      { name: '절단', status: '대기', active: true },
      { name: '가공', status: '대기', active: true },
      { name: '용접', status: '대기', active: true },
      { name: '도장', status: '대기', active: true },
      { name: '조립/납품', status: '대기', active: true },
    ];

    const activeSteps = steps.filter((s) => s.active);
    const completedSteps = activeSteps.filter((s) => s.status === '완료');
    let initialStatus = '진행중';
    if (activeSteps.length > 0 && completedSteps.length === activeSteps.length) {
      initialStatus = '완료';
    }

    const rawOrderDate = data.orderDate !== undefined ? data.orderDate : data.order_date;
    const rawDueDate = data.dueDate !== undefined ? data.dueDate : (data.due_date !== undefined ? data.due_date : data.delivery_date);

    const sanitizedOrderDate = sanitizeDateString(rawOrderDate) || new Date().toISOString().split('T')[0];
    const sanitizedDueDate = sanitizeDateString(rawDueDate);

    const orderData: any = {
      partnerName: String(data.partnerName).trim(),
      partnerId: data.partnerId ? parseInt(data.partnerId) : null,
      itemName: String(data.itemName).trim(),
      quantity: data.quantity ? (parseInt(data.quantity) || 1) : 1,
      orderDate: sanitizedOrderDate,
      dueDate: sanitizedDueDate,
      status: initialStatus,
      processSteps: JSON.stringify(steps),
      memo: data.memo ? String(data.memo).trim() : null,
      projectNo: data.projectNo ? String(data.projectNo).trim() : null,
      drawingUrl: data.drawingUrl ? String(data.drawingUrl).trim() : null,
    };

    const order = await prisma.order.create({
      data: orderData,
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error: any) {
    console.error('Create order error:', error);
    return NextResponse.json(
      { error: 'Failed to create order', details: error.message || String(error) },
      { status: 500 }
    );
  }
}
