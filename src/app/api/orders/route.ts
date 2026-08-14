import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ProcessStep {
  name: string;
  status: string;
  active: boolean;
  date?: string | null;
}

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Compute metrics
    const totalCount = orders.length;
    let inProgressCount = 0;
    let nearingDueCount = 0;
    let completedCount = 0;

    // Create map for retroactive PRJ-001... assignment by chronological ID order
    const sortedOrders = [...orders].sort((a, b) => a.id - b.id);
    const projectNoMap = new Map<number, string>();
    sortedOrders.forEach((o, index) => {
      projectNoMap.set(o.id, `PRJ-${String(index + 1).padStart(3, '0')}`);
    });

    const parsedOrders = orders.map(order => {
      let rawSteps: any[] = [];
      try {
        rawSteps = JSON.parse(order.processSteps || '[]');
      } catch {
        rawSteps = [];
      }

      const steps: ProcessStep[] = Array.isArray(rawSteps)
        ? rawSteps.map(s => ({
            name: s.name || '',
            status: s.status || '대기',
            active: s.active !== undefined ? s.active : true,
            date: s.date || null
          }))
        : [];

      // Calculate progress percentage
      const activeSteps = steps.filter(s => s.active);
      const completedSteps = activeSteps.filter(s => s.status === '완료');
      const progressPercent = activeSteps.length > 0 
        ? Math.round((completedSteps.length / activeSteps.length) * 100)
        : 0;

      // Status check
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

      const assignedProjectNo = (order as any).projectNo || projectNoMap.get(order.id) || `PRJ-${String(order.id).padStart(3, '0')}`;

      return {
        ...order,
        projectNo: assignedProjectNo,
        drawingUrl: (order as any).drawingUrl || null,
        status: currentStatus,
        steps,
        progressPercent
      };
    });

    return NextResponse.json({
      orders: parsedOrders,
      metrics: {
        totalCount,
        inProgressCount,
        nearingDueCount,
        completedCount
      }
    });
  } catch (error) {
    console.error('Fetch orders error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
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
      { name: '조립/납품', status: '대기', active: true }
    ];

    const activeSteps = steps.filter(s => s.active);
    const completedSteps = activeSteps.filter(s => s.status === '완료');
    let initialStatus = '진행중';
    if (activeSteps.length > 0 && completedSteps.length === activeSteps.length) {
      initialStatus = '완료';
    }

    const orderData: any = {
      partnerName: data.partnerName.trim(),
      partnerId: data.partnerId ? parseInt(data.partnerId) : null,
      itemName: data.itemName.trim(),
      quantity: data.quantity ? parseInt(data.quantity) : 1,
      orderDate: data.orderDate || new Date().toISOString().split('T')[0],
      dueDate: data.dueDate || null,
      status: initialStatus,
      processSteps: JSON.stringify(steps),
      memo: data.memo || null,
    };

    if (data.projectNo && data.projectNo.trim()) {
      orderData.projectNo = data.projectNo.trim();
    }
    if (data.drawingUrl && data.drawingUrl.trim()) {
      orderData.drawingUrl = data.drawingUrl.trim();
    }

    const order = await prisma.order.create({
      data: orderData
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
