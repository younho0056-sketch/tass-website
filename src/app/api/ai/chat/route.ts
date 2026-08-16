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

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const currentYearMonth = todayStr.substring(0, 7);

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

    // 2. Strict Direct System Prompt
    const systemPrompt = `당신은 TASS(주식회사 타스 - 스마트 산업 안전 및 수주/공정 관리 전문 기업)의 유능하고 스마트한 현장 AI 비서입니다.
오늘 날짜: ${todayStr} (당월: ${currentYearMonth})

[핵심 지침 - 반드시 준수]
1. 불필요한 인사말, 서론, 메타 안내문구(예: '조회 결과입니다', '도움말:', '질문하신 내용:', '실시간 DB 조회 결과:', '안녕하세요')를 일체 쓰지 말고, 대표님/사용자가 물어본 핵심 정보에 대해서만 곧바로 간결하고 명확하게 답변하십시오.
2. 아래 제공된 최신 DB 데이터(거래처, 수주/공정 목록, 견적 목록)를 참조하여 질문에 정확히 답변하십시오.
3. DB에 없는 일반 질문(예: 날씨, 인사, 상식, 일반 대화 등)도 친절하고 명확하게 직접 답변하십시오.
4. 답변 시 구체적인 번호, 불릿 포인트, 굵은 글씨를 활용하여 가독성을 높이십시오.

[최신 DB 데이터]
■ 등록 거래처 (${partners.length}개사):
${partners
  .map(
    (p) =>
      `- ${p.name} | 구분: ${p.type} | 담당자: ${p.manager || '미지정'} | 전화: ${p.phone || '없음'} | 직통: ${p.tel || '없음'} | 이메일: ${p.email || '없음'} | 주소: ${p.address || '없음'} | 메모: ${p.specialty || ''} ${p.memo || ''}`
  )
  .join('\n')}

■ 수주 및 공정 현황 (${parsedOrders.length}건):
${parsedOrders
  .map(
    (o) =>
      `- [${o.projectNo}] 거래처: ${o.partnerName} | 품목: ${o.itemName} (${o.quantity}개) | 발주일: ${o.orderDate || '미정'} | 납기일: ${o.dueDate || '미정'} | 상태: ${o.status} (진행률: ${o.progressPercent}%) | 메모: ${o.memo || '없음'}`
  )
  .join('\n')}

■ 최근 견적 목록 (${estimates.length}건):
${estimates
  .map(
    (e) =>
      `- [${e.docNo}] 거래처: ${e.partnerName} | 프로젝트: ${e.projectName} | 금액: ${e.totalAmount?.toLocaleString()}원 | 상태: ${e.status} | 견적일: ${e.date}`
  )
  .join('\n')}
`;

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;

    // Try External LLM APIs if key exists
    if (apiKey) {
      const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
      for (const model of models) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: `${systemPrompt}\n\n[사용자 질문]: ${lastUserMessage}` },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 1000,
              },
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const replyText =
              data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
            if (replyText) {
              return createStreamResponse(replyText);
            }
          }
        } catch (err) {
          console.error(`Gemini API (${model}) call error:`, err);
        }
      }
    }

    if (openAiKey) {
      try {
        const openAiUrl = 'https://api.openai.com/v1/chat/completions';
        const response = await fetch(openAiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openAiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.map((m: any) => ({
                role: m.role,
                content: m.content,
              })),
            ],
            temperature: 0.2,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const replyText =
            data.choices?.[0]?.message?.content?.trim() || '';
          if (replyText) {
            return createStreamResponse(replyText);
          }
        }
      } catch (err) {
        console.error('OpenAI API call error:', err);
      }
    }

    // 3. Direct Dynamic DB RAG Engine (Zero Template / Zero Fixed Header)
    const replyText = generateDirectAnswer(lastUserMessage, partners, parsedOrders, estimates, todayStr);

    return createStreamResponse(replyText);
  } catch (error: any) {
    console.error('AI Chat API error:', error);
    return NextResponse.json(
      { error: 'AI 응답 생성 실패', details: error.message },
      { status: 500 }
    );
  }
}

// Helper: Stream response generator
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

// Helper: Direct Answer Generator (Strictly NO Fixed Header/Template)
function generateDirectAnswer(
  query: string,
  partners: any[],
  orders: any[],
  estimates: any[],
  todayStr: string
): string {
  const q = query.trim().toLowerCase();
  const currentMonth = todayStr.substring(0, 7);

  // 1. Partner query (e.g. "아크 담당자 연락처 알려줘")
  if (
    q.includes('담당자') ||
    q.includes('연락처') ||
    q.includes('전화번호') ||
    q.includes('이메일') ||
    q.includes('주소') ||
    q.includes('거래처')
  ) {
    const matchedPartner = partners.find((p) => q.includes(p.name.toLowerCase()));
    if (matchedPartner) {
      const contactInfo: string[] = [];
      if (matchedPartner.manager) contactInfo.push(`담당자: **${matchedPartner.manager}**`);
      if (matchedPartner.phone) contactInfo.push(`전화: **${matchedPartner.phone}**`);
      if (matchedPartner.tel) contactInfo.push(`대표전화: **${matchedPartner.tel}**`);
      if (matchedPartner.fax) contactInfo.push(`팩스: **${matchedPartner.fax}**`);
      if (matchedPartner.email) contactInfo.push(`이메일: **${matchedPartner.email}**`);
      if (matchedPartner.address) contactInfo.push(`주소: **${matchedPartner.address}**`);

      return `**${matchedPartner.name}** (${matchedPartner.type}) 정보입니다:\n• ` + contactInfo.join('\n• ');
    }

    if (q.includes('목록') || q.includes('전체') || q.includes('몇')) {
      const list = partners
        .map(
          (p) =>
            `• **${p.name}** (${p.type}) - 담당: ${p.manager || '미지정'} / 연락처: ${p.phone || p.tel || '미등록'}`
        )
        .join('\n');
      return `현재 등록된 거래처는 총 **${partners.length}개사**입니다:\n${list}`;
    }
  }

  // 2. Order completion query (e.g. "이번 달 납품 완료된 건 몇 개야?")
  if (q.includes('완료') || q.includes('납품 완료') || q.includes('이번달') || q.includes('이번 달')) {
    const completedOrders = orders.filter((o) => o.status === '완료');
    const completedThisMonth = completedOrders.filter(
      (o) => (o.dueDate && o.dueDate.startsWith(currentMonth)) || (o.orderDate && o.orderDate.startsWith(currentMonth))
    );

    if (completedOrders.length === 0) {
      return `현재 완료된 납품/수주 건이 없습니다.`;
    }

    const itemsText = completedOrders
      .slice(0, 5)
      .map((o, idx) => `${idx + 1}. **[${o.projectNo}] ${o.partnerName}**: ${o.itemName} (${o.quantity}개)`)
      .join('\n');

    return `이번 달(${currentMonth}) 완료된 납품은 **${completedThisMonth.length}건** (전체 누적 완료 **${completedOrders.length}건**)입니다:\n${itemsText}`;
  }

  // 3. Nearing due query (e.g. "납기 임박한 수주 목록 알려줘", "이번 주 납품")
  if (q.includes('임박') || q.includes('납기') || q.includes('d-day') || q.includes('이번 주') || q.includes('이번주') || q.includes('급한')) {
    const urgentOrders = orders.filter(
      (o) => o.status === '납기임박' || (o.dueDate && o.status !== '완료')
    );

    if (urgentOrders.length === 0) {
      return `현재 납기 임박(D-3 이내) 또는 대기 중인 긴급 수주가 없습니다. 모든 공정이 정상적으로 진행 중입니다.`;
    }

    const list = urgentOrders
      .map(
        (o, idx) =>
          `${idx + 1}. **[${o.projectNo}] ${o.partnerName}** - ${o.itemName} (${o.quantity}개)\n   - 납기일: **${o.dueDate || '미정'}** | 진행률: **${o.progressPercent}%** (${o.status})`
      )
      .join('\n');

    return `납기 임박 및 예정 수주 목록은 총 **${urgentOrders.length}건**입니다:\n${list}`;
  }

  // 4. Estimates query
  if (q.includes('견적') || q.includes('견적서')) {
    if (estimates.length === 0) {
      return `현재 등록된 견적서가 없습니다.`;
    }
    const list = estimates
      .slice(0, 5)
      .map(
        (e, idx) =>
          `${idx + 1}. **[${e.docNo}] ${e.partnerName}** - ${e.projectName} (${e.totalAmount?.toLocaleString()}원, ${e.status})`
      )
      .join('\n');
    return `최근 작성된 견적서는 총 **${estimates.length}건**입니다:\n${list}`;
  }

  // 5. General status / summary query
  if (q.includes('요약') || q.includes('현황') || q.includes('전체')) {
    const inProgress = orders.filter((o) => o.status === '진행중').length;
    const completed = orders.filter((o) => o.status === '완료').length;
    const urgent = orders.filter((o) => o.status === '납기임박').length;

    return `현재 TASS 실시간 현황 요약입니다:\n` +
      `• **거래처**: 총 **${partners.length}개사**\n` +
      `• **수주/공정**: 총 **${orders.length}건** (진행중 ${inProgress}건, 납기임박 ${urgent}건, 완료 ${completed}건)\n` +
      `• **견적서**: 총 **${estimates.length}건**`;
  }

  // 6. General Greetings / Casual questions
  if (q.includes('안녕') || q.includes('반가') || q.includes('누구')) {
    return `안녕하세요! TASS 현장 AI 비서입니다. 거래처 연락처, 납품 건수, 공정 현황 등 궁금하신 점을 말씀해 주세요.`;
  }

  if (q.includes('날씨')) {
    return `현장 날씨 정보는 기상청 또는 날씨 앱을 참조해 주세요. 오늘 TASS 현장 공정은 모두 정상적으로 운영 중입니다!`;
  }

  // 7. Keyword search fallback across DB items
  const matchedPartners = partners.filter((p) => q.includes(p.name.toLowerCase()));
  const matchedOrders = orders.filter(
    (o) =>
      q.includes(o.itemName.toLowerCase()) ||
      q.includes(o.partnerName.toLowerCase()) ||
      q.includes(o.projectNo.toLowerCase())
  );

  if (matchedPartners.length > 0 || matchedOrders.length > 0) {
    const lines: string[] = [];
    if (matchedPartners.length > 0) {
      lines.push(
        `**관련 거래처**: ` +
          matchedPartners
            .map(
              (p) =>
                `**${p.name}** (담당: ${p.manager || '미지정'}, 전화: ${p.phone || p.tel || '없음'})`
            )
            .join(', ')
      );
    }
    if (matchedOrders.length > 0) {
      lines.push(
        `**관련 공정**:\n` +
          matchedOrders
            .map(
              (o) =>
                `• **[${o.projectNo}] ${o.partnerName}** - ${o.itemName} (${o.status}, ${o.progressPercent}%)`
            )
            .join('\n')
      );
    }
    return lines.join('\n\n');
  }

  // Generic direct fallback (Clean, concise, no fixed headers or templates!)
  return `요청하신 **"${query}"**에 대한 정보를 찾고 있습니다. 거래처명(예: "아크 담당자"), 공정 현황(예: "납기 임박 목록"), 실적(예: "이번달 납품 건수") 등을 구체적으로 질문하시면 바로 안내해 드립니다.`;
}
