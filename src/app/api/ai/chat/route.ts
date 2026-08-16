import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

interface ProcessStep {
  name: string;
  status: string;
  active: boolean;
  date?: string | null;
}

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: '메시지를 입력해주세요.' }, { status: 400 });
    }

    const lastUserMessage = messages[messages.length - 1]?.content || '';

    // 1. Fetch real-time DB context
    const [partners, orders, estimates] = await Promise.all([
      prisma.partner.findMany({
        orderBy: { name: 'asc' },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      prisma.estimate.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);

    const todayStr = new Date().toISOString().split('T')[0];
    const currentYearMonth = todayStr.substring(0, 7); // e.g. '2026-08'

    // Sort orders chronologically to assign PRJ-xxx numbers accurately
    const sortedOrders = [...orders].sort((a, b) => a.id - b.id);
    const prjMap = new Map<number, string>();
    sortedOrders.forEach((o, index) => {
      prjMap.set(o.id, `PRJ-${String(index + 1).padStart(3, '0')}`);
    });

    const parsedOrders = orders.map((o) => {
      let steps: ProcessStep[] = [];
      try {
        steps = JSON.parse(o.processSteps || '[]');
      } catch {
        steps = [];
      }
      const activeSteps = steps.filter((s) => s.active !== false);
      const completedSteps = activeSteps.filter((s) => s.status === '완료');
      const progressPercent =
        activeSteps.length > 0
          ? Math.round((completedSteps.length / activeSteps.length) * 100)
          : 0;

      // Status check
      let currentStatus = o.status;
      if (activeSteps.length > 0 && completedSteps.length === activeSteps.length) {
        currentStatus = '완료';
      } else if (o.dueDate && currentStatus !== '완료') {
        const due = new Date(o.dueDate).getTime();
        const now = new Date().getTime();
        const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
        if (diffDays <= 3 && diffDays >= 0) {
          currentStatus = '납기임박';
        }
      }

      return {
        id: o.id,
        projectNo: (o as any).projectNo || prjMap.get(o.id) || `PRJ-${String(o.id).padStart(3, '0')}`,
        partnerName: o.partnerName,
        itemName: o.itemName,
        quantity: o.quantity,
        orderDate: o.orderDate,
        dueDate: o.dueDate,
        status: currentStatus,
        progressPercent,
        memo: o.memo,
        createdAt: o.createdAt,
      };
    });

    // Compute metric statistics
    const totalOrders = parsedOrders.length;
    const completedOrders = parsedOrders.filter((o) => o.status === '완료');
    const inProgressOrders = parsedOrders.filter((o) => o.status === '진행중');
    const nearingDueOrders = parsedOrders.filter(
      (o) => o.status === '납기임박' || (o.dueDate && o.status !== '완료' && new Date(o.dueDate).getTime() - new Date().getTime() <= 3 * 86400000)
    );

    const completedThisMonth = completedOrders.filter(
      (o) => (o.dueDate && o.dueDate.startsWith(currentYearMonth)) || (o.orderDate && o.orderDate.startsWith(currentYearMonth))
    );

    // 2. Build AI Context String
    const contextPrompt = `
[시스템 역할]
당신은 TASS(주식회사 타스 - 스마트 산업 안전 및 수주/공정 관리 전문 기업)의 실시간 AI 데이터 비서입니다.
사용자의 질문에 친절하고 명확하며 정중하게 한국어로 답변하세요.
항상 제공된 실시간 DB 데이터에 기반하여 사실에 입각한 정확한 정보만 제공하세요.

[현재 시각 및 요약 현황]
- 오늘 날짜: ${todayStr} (당월: ${currentYearMonth})
- 전체 등록 거래처: ${partners.length}개
- 전체 수주/공정 건수: ${totalOrders}건 (진행중: ${inProgressOrders.length}건, 납기임박: ${nearingDueOrders.length}건, 완료: ${completedOrders.length}건 / 당월 완료: ${completedThisMonth.length}건)

[1. 실시간 거래처 DB 목록]
${partners
  .map(
    (p) =>
      `- [${p.name}] 구분: ${p.type} | 담당자: ${p.manager || '미지정'} | 전화: ${p.phone || '없음'} | 직통/대표: ${p.tel || '없음'} | 이메일: ${p.email || '없음'} | 주소: ${p.address || '없음'} | 메모/특이사항: ${p.specialty || ''} ${p.memo || ''}`
  )
  .join('\n')}

[2. 실시간 수주/공정 현황 목록]
${parsedOrders
  .map(
    (o) =>
      `- [${o.projectNo}] 거래처: ${o.partnerName} | 품목: ${o.itemName} (${o.quantity}개) | 발주일: ${o.orderDate || '미정'} | 납기일: ${o.dueDate || '미정'} | 상태: ${o.status} (진행률 ${o.progressPercent}%) | 메모: ${o.memo || '없음'}`
  )
  .join('\n')}

[3. 최근 견적 목록]
${estimates
  .map(
    (e) =>
      `- [${e.docNo}] 거래처: ${e.partnerName} | 프로젝트: ${e.projectName} | 금액: ${e.totalAmount?.toLocaleString()}원 | 상태: ${e.status} | 견적일: ${e.date}`
  )
  .join('\n')}
`;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;

    // Check external AI model availability
    if (apiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: `${contextPrompt}\n\n[사용자 질문]: ${lastUserMessage}` }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1000,
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || '답변을 생성하지 못했습니다.';
          return createStreamResponse(replyText);
        }
      } catch (err) {
        console.error('Gemini API call failed, falling back to smart DB engine:', err);
      }
    } else if (openAiKey) {
      try {
        const openAiUrl = 'https://api.openai.com/v1/chat/completions';
        const response = await fetch(openAiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openAiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: contextPrompt },

              ...messages.map((m: any) => ({ role: m.role, content: m.content }))
            ],
            temperature: 0.2,
          })
        });

        if (response.ok) {
          const data = await response.json();
          const replyText = data.choices?.[0]?.message?.content || '답변을 생성하지 못했습니다.';
          return createStreamResponse(replyText);
        }
      } catch (err) {
        console.error('OpenAI API call failed, falling back to smart DB engine:', err);
      }
    }

    // 3. Smart DB RAG fallback Engine (Deterministic high-speed precision query handling)
    const replyText = generateSmartDbReply(lastUserMessage, partners, parsedOrders, estimates, {
      totalOrders,
      inProgressCount: inProgressOrders.length,
      nearingDueCount: nearingDueOrders.length,
      completedCount: completedOrders.length,
      completedThisMonthCount: completedThisMonth.length,
      currentYearMonth,
    });

    return createStreamResponse(replyText);
  } catch (error: any) {
    console.error('AI Chat API error:', error);
    return NextResponse.json(
      { error: 'AI 응답 생성 실패', details: error.message },
      { status: 500 }
    );
  }
}

// Helper: Stream response generator for real-time typing effect
function createStreamResponse(text: string) {
  const encoder = new TextEncoder();
  const chunks = text.match(/.{1,4}/g) || [text];

  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}

// Helper: Smart DB RAG Answer Generator
function generateSmartDbReply(
  query: string,
  partners: any[],
  orders: any[],
  estimates: any[],
  metrics: {
    totalOrders: number;
    inProgressCount: number;
    nearingDueCount: number;
    completedCount: number;
    completedThisMonthCount: number;
    currentYearMonth: string;
  }
): string {
  const q = query.trim().toLowerCase();

  // 1. Partner query (e.g., "아크 담당자 연락처", "거래처 연락처", "OOO 전화번호")
  if (q.includes('담당자') || q.includes('연락처') || q.includes('전화번호') || q.includes('이메일') || q.includes('주소') || q.includes('거래처')) {
    // Try matching specific partner name
    const matchedPartner = partners.find((p) => q.includes(p.name.toLowerCase()));
    if (matchedPartner) {
      return `📋 **[${matchedPartner.name}] 거래처 정보**\n\n` +
        `• **구분**: ${matchedPartner.type}\n` +
        `• **담당자**: ${matchedPartner.manager || '미지정'}\n` +
        `• **휴대전화**: ${matchedPartner.phone || '등록 안됨'}\n` +
        `• **직통/대표전화**: ${matchedPartner.tel || '등록 안됨'}\n` +
        `• **이메일**: ${matchedPartner.email || '등록 안됨'}\n` +
        `• **주소**: ${matchedPartner.address || '등록 안됨'}\n` +
        (matchedPartner.specialty ? `• **주요 품목/특기**: ${matchedPartner.specialty}\n` : '') +
        (matchedPartner.memo ? `• **메모**: ${matchedPartner.memo}\n` : '');
    }

    if (q.includes('목록') || q.includes('전체') || q.includes('몇')) {
      const list = partners.slice(0, 10).map((p) => `• **${p.name}** (${p.type}): 담당 ${p.manager || '미지정'} / ${p.phone || p.tel || '연락처 미등록'}`).join('\n');
      return `🏢 **등록된 거래처 목록 (총 ${partners.length}개사 중 상위 10개)**\n\n${list}\n\n💡 특정 거래처명을 검색하시면 상세 연락처를 바로 확인하실 수 있습니다.`;
    }
  }

  // 2. Order completion query (e.g., "이번 달 납품 완료된 건 몇 개야?", "완료 건수")
  if (q.includes('완료') || q.includes('납품 완료') || q.includes('이번달') || q.includes('이번 달')) {
    const completedOrders = orders.filter((o) => o.status === '완료');
    if (completedOrders.length === 0) {
      return `📦 **납품 완료 현황**\n\n현재 완료 상태로 등록된 수주/공정 데이터가 없습니다.`;
    }

    const itemsSummary = completedOrders.slice(0, 5).map((o) => `• **[${o.projectNo}] ${o.partnerName}**: ${o.itemName} (${o.quantity}개) - 납기: ${o.dueDate || '미정'}`).join('\n');
    return `📦 **납품 완료 현황 요약**\n\n` +
      `• **전체 누적 완료 건수**: **${metrics.completedCount}건**\n` +
      `• **이번 달(${metrics.currentYearMonth}) 완료 건수**: **${metrics.completedThisMonthCount}건**\n\n` +
      `[최근 완료 프로젝트 목록]\n${itemsSummary}`;
  }

  // 3. Nearing due date query (e.g., "납기 임박한 수주 목록 알려줘", "임박", "d-day")
  if (q.includes('임박') || q.includes('납기') || q.includes('d-day') || q.includes('급한')) {
    const urgentOrders = orders.filter(
      (o) => o.status === '납기임박' || (o.dueDate && o.status !== '완료')
    );

    if (urgentOrders.length === 0) {
      return `⚡ **납기 임박 수주 현황**\n\n현재 납기 임박(D-3 이내) 상태인 긴급 수주는 없습니다. 모든 공정이 원활하게 진행 중입니다!`;
    }

    const list = urgentOrders.map((o) => `• **[${o.projectNo}] ${o.partnerName}**: ${o.itemName} (${o.quantity}개)\n  - 납기일: **${o.dueDate || '미정'}** | 진행률: **${o.progressPercent}%** (${o.status})`).join('\n\n');
    return `⚠️ **납기 임박 / 주요 수주 현황 (${urgentOrders.length}건)**\n\n${list}`;
  }

  // 4. General metrics summary query
  if (q.includes('요약') || q.includes('현황') || q.includes('전체') || q.includes('상태') || q.includes('안녕') || q.includes('도움')) {
    return `🤖 **TASS 스마트 관리 시스템 실시간 요약 리포트**\n\n` +
      `📊 **수주/공정 현황 (총 ${metrics.totalOrders}건)**\n` +
      `• ⚙️ 진행중: **${metrics.inProgressCount}건**\n` +
      `• ⚠️ 납기임박: **${metrics.nearingDueCount}건**\n` +
      `• ✅ 완료: **${metrics.completedCount}건** (이번 달 ${metrics.completedThisMonthCount}건)\n\n` +
      `🏢 **거래처 현황**: 총 **${partners.length}개사** 등록\n` +
      `📑 **최근 견적서**: **${estimates.length}건** 보관 중\n\n` +
      `💬 궁금하신 거래처 담당자 연락처, 공정 현황, 납기일 등을 언제든지 질문해 주세요!`;
  }

  // 5. Fallback search matching across partners & orders
  const matchedPartners = partners.filter((p) => q.includes(p.name.toLowerCase()));
  const matchedOrders = orders.filter((o) => q.includes(o.itemName.toLowerCase()) || q.includes(o.partnerName.toLowerCase()) || q.includes(o.projectNo.toLowerCase()));

  if (matchedPartners.length > 0 || matchedOrders.length > 0) {
    let resultText = `🔎 **검색 결과**\n\n`;
    if (matchedPartners.length > 0) {
      resultText += `🏢 **관련 거래처**: ${matchedPartners.map((p) => `${p.name} (담당: ${p.manager || '미지정'}, Tel: ${p.phone || p.tel || '없음'})`).join(', ')}\n\n`;
    }
    if (matchedOrders.length > 0) {
      resultText += `📦 **관련 공정**: ${matchedOrders.map((o) => `[${o.projectNo}] ${o.partnerName} - ${o.itemName} (${o.status}, ${o.progressPercent}%)`).join('\n')}\n\n`;
    }
    return resultText;
  }

  // Default response
  return `💡 **TASS AI 데이터 비서 응답**\n\n` +
    `질문하신 내용: **"${query}"**\n\n` +
    `실시간 DB 조회 결과:\n` +
    `• 전체 등록 거래처: ${partners.length}개사\n` +
    `• 전체 수주/공정: ${metrics.totalOrders}건 (진행중 ${metrics.inProgressCount}건, 완료 ${metrics.completedCount}건)\n\n` +
    `도움이 필요하시면 예시와 같이 질문해 보세요:\n` +
    `1. *"아크 담당자 연락처 알려줘"* (거래처 조회)\n` +
    `2. *"이번 달 납품 완료 건수 알려줘"* (실적 집계)\n` +
    `3. *"납기 임박 수주 목록 알려줘"* (긴급 공정 요약)`;
}
