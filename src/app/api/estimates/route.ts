import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const estimates = await prisma.estimate.findMany({
      orderBy: { createdAt: 'desc' }
    });

    let inProgressCount = 0;
    let completedCount = 0;
    let successCount = 0;
    let cancelledCount = 0;
    let totalAmountSum = 0;

    const validStatuses = ['견적중', '견적완료', '수주성공', '수주취소'];

    const parsedEstimates = estimates.map(est => {
      let items = [];
      try {
        items = JSON.parse(est.items || '[]');
      } catch {
        items = [];
      }

      let displayStatus = est.status;
      if (!validStatuses.includes(displayStatus)) {
        displayStatus = '견적중';
      }

      if (displayStatus === '견적완료') completedCount++;
      else if (displayStatus === '수주성공') successCount++;
      else if (displayStatus === '수주취소') cancelledCount++;
      else inProgressCount++;

      totalAmountSum += est.totalAmount || 0;

      return {
        ...est,
        quantity: est.quantity || 1,
        status: displayStatus,
        items
      };
    });

    return NextResponse.json({
      estimates: parsedEstimates,
      metrics: {
        totalCount: estimates.length,
        inProgressCount,
        completedCount,
        successCount,
        cancelledCount,
        totalAmountSum
      }
    });
  } catch (error) {
    console.error('Fetch estimates error:', error);
    return NextResponse.json({ error: 'Failed to fetch estimates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    if (!data.partnerName || !data.partnerName.trim()) {
      return NextResponse.json({ error: '거래처명을 입력해주세요.' }, { status: 400 });
    }
    if (!data.projectName || !data.projectName.trim()) {
      return NextResponse.json({ error: '공사/프로젝트명을 입력해주세요.' }, { status: 400 });
    }

    const todayStr = (data.date || new Date().toISOString().split('T')[0]).replace(/-/g, '');
    const docNo = data.docNo ? data.docNo.trim() : `EST-${todayStr}-${Math.floor(100 + Math.random() * 900)}`;

    const items = data.items || [];
    const subtotal = data.subtotal !== undefined ? parseFloat(data.subtotal) : 0;
    const vat = data.vat !== undefined ? parseFloat(data.vat) : 0;
    const totalAmount = data.totalAmount !== undefined ? parseFloat(data.totalAmount) : (subtotal + vat);

    const validStatuses = ['견적중', '견적완료', '수주성공', '수주취소'];
    const initialStatus = validStatuses.includes(data.status) ? data.status : '견적중';
    const quantity = data.quantity !== undefined ? parseInt(data.quantity) || 1 : 1;

    const created = await prisma.estimate.create({
      data: {
        docNo,
        partnerName: data.partnerName.trim(),
        partnerId: data.partnerId ? parseInt(data.partnerId) : null,
        projectName: data.projectName.trim(),
        quantity,
        date: data.date || new Date().toISOString().split('T')[0],
        deliveryTerm: data.deliveryTerm || '발주 후 협의',
        paymentTerm: data.paymentTerm || '납품 후 30일 이내 현금',
        validity: data.validity || '견적 제출 후 30일간',
        items: JSON.stringify(items),
        subtotal,
        vat,
        totalAmount,
        amountInKorean: data.amountInKorean || '',
        status: initialStatus,
        memo: data.memo || '1. 부가가치세 별도\n2. 납품 및 시공 조건 상호 협의'
      }
    });

    return NextResponse.json({ ...created, quantity, status: initialStatus }, { status: 201 });
  } catch (error) {
    console.error('Create estimate error:', error);
    return NextResponse.json({ error: 'Failed to create estimate' }, { status: 500 });
  }
}
