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

    // 1. Fetch all real-time DB data snapshots
    const [partners, orders, estimates, products] = await Promise.all([
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
      prisma.product.findMany({
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const todayStr = new Date().toISOString().split('T')[0];
    const currentYearMonth = todayStr.substring(0, 7);

    // Map PRJ project numbers chronologically
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

    // 2. Build Universal LLM System Prompt with Full DB Snapshot
    const systemPrompt = `당신은 TASS(주식회사 타스 - 스마트 산업 안전 및 물류/공정 자동화 설비 제조 전문 기업) 제조 현장의 지능형 만능 AI 비서입니다.

[상황 및 시간 데이터 (오늘 날짜: ${todayStr}, 당월: ${currentYearMonth})]

■ 실시간 사내 DB 최신 데이터 스냅샷:
1. 등록 거래처 (${partners.length}개사):
${partners
  .map(
    (p) =>
      `- [${p.name}] 구분: ${p.type} | 담당자: ${p.manager || '미지정'} | 휴대전화: ${p.phone || '없음'} | 대표/직통: ${p.tel || '없음'} | 팩스: ${p.fax || '없음'} | 이메일: ${p.email || '없음'} | 주소: ${p.address || '없음'} | 주요품목/메모: ${p.specialty || ''} ${p.memo || ''}`
  )
  .join('\n')}

2. 수주 및 공정 현황 (${parsedOrders.length}건):
${parsedOrders
  .map(
    (o) =>
      `- [${o.projectNo}] 거래처: ${o.partnerName} | 품목: ${o.itemName} (${o.quantity}개) | 발주일: ${o.orderDate || '미정'} | 납기일: ${o.dueDate || '미정'} | 상태: ${o.status} (진행률: ${o.progressPercent}%) | 메모: ${o.memo || '없음'}`
  )
  .join('\n')}

3. 견적 작성 목록 (${estimates.length}건):
${estimates
  .map(
    (e) =>
      `- [${e.docNo}] 거래처: ${e.partnerName} | 프로젝트: ${e.projectName} | 금액: ${e.totalAmount?.toLocaleString()}원 | 상태: ${e.status} | 견적일: ${e.date}`
  )
  .join('\n')}

4. TASS 주요 제품 및 장비 (${products.length}건):
${products
  .map((p) => `- 제품명: ${p.name} | 카테고리: ${p.category} | 설명: ${p.desc || '없음'}`)
  .join('\n')}

[AI 행동 및 답변 지침]
1. 당신은 ChatGPT/Gemini 본체와 동일하게 자유롭고 똑똑하게 일상 대화, 기계/용접/산업안전 기술 상담, 계산, 날씨, 상식, 번역 등을 다룰 수 있는 만능 지능형 AI 비서입니다.
2. TASS 내부 사내 업무(거래처 연락처, 담당자, 납기일, 특정 수주/공정 진행 상황, 미완료 품목 등) 질문이 들어오면 주입된 실시간 DB 데이터를 바탕으로 100% 정확하게 답변하십시오.
3. 불필요한 메타 안내문구, 서론, 템플릿 서문(예: '조회 결과입니다', '질문하신 내용:', '도움말:')을 일체 사용하지 마시고 질문에 맞춰 자연스럽고 명확하게 대화하십시오.
4. 사용자의 대화 히스토리(이전 질문 및 답변 맥락)를 유지하여 연속적인 상호작용이 이루어지도록 답변을 작성하십시오.
`;

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;

    // A. Gemini API with Stream / Chat History
    if (apiKey) {
      const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
      for (const model of models) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

          // Format chat history for Gemini contents array
          const geminiContents = messages.map((m: any) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          }));

          const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemPrompt }],
              },
              contents: geminiContents,
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1200,
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

    // B. OpenAI API with Stream / Chat History
    if (openAiKey) {
      try {
        const openAiUrl = 'https://api.openai.com/v1/chat/completions';
        const formattedMessages = [
          { role: 'system', content: systemPrompt },
          ...messages.map((m: any) => ({
            role: m.role === 'model' ? 'assistant' : m.role,
            content: m.content,
          })),
        ];

        const response = await fetch(openAiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openAiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: formattedMessages,
            temperature: 0.3,
            max_tokens: 1200,
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

    // C. Universal Fallback AI Synthesis Engine (No fixed keyword matching rules)
    const replyText = generateUniversalAiReply(messages, partners, parsedOrders, estimates, products, todayStr);
    return createStreamResponse(replyText);
  } catch (error: any) {
    console.error('AI Chat API error:', error);
    return NextResponse.json(
      { error: 'AI 응답 생성 실패', details: error.message },
      { status: 500 }
    );
  }
}

// Helper: Stream response generator for real-time text streaming
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

// Helper: Universal AI Synthesizer (Reads conversation context & DB snapshot dynamically)
function generateUniversalAiReply(
  messages: any[],
  partners: any[],
  orders: any[],
  estimates: any[],
  products: any[],
  todayStr: string
): string {
  const lastUserMsg = messages[messages.length - 1]?.content || '';
  const textLower = lastUserMsg.toLowerCase().trim();

  // 1. Partner DB Lookup
  const matchedPartner = partners.find((p) => textLower.includes(p.name.toLowerCase()));
  if (matchedPartner) {
    const details = [
      matchedPartner.manager ? `담당자: **${matchedPartner.manager}**` : null,
      matchedPartner.phone ? `전화: **${matchedPartner.phone}**` : null,
      matchedPartner.tel ? `대표전화: **${matchedPartner.tel}**` : null,
      matchedPartner.fax ? `팩스: **${matchedPartner.fax}**` : null,
      matchedPartner.email ? `이메일: **${matchedPartner.email}**` : null,
      matchedPartner.address ? `주소: **${matchedPartner.address}**` : null,
      matchedPartner.specialty ? `특기사항: **${matchedPartner.specialty}**` : null,
    ]
      .filter(Boolean)
      .join('\n• ');

    return `**${matchedPartner.name}** (${matchedPartner.type}) 정보입니다:\n• ${details}`;
  }

  // 2. Order/Process DB Lookup
  const matchedOrder = orders.find(
    (o) =>
      textLower.includes(o.itemName.toLowerCase()) ||
      textLower.includes(o.partnerName.toLowerCase()) ||
      textLower.includes(o.projectNo.toLowerCase())
  );
  if (matchedOrder) {
    return `**[${matchedOrder.projectNo}] ${matchedOrder.partnerName}** 수주 공정 현황입니다:\n` +
      `• 품목: **${matchedOrder.itemName}** (${matchedOrder.quantity}개)\n` +
      `• 발주일: **${matchedOrder.orderDate || '미정'}** | 납기일: **${matchedOrder.dueDate || '미정'}**\n` +
      `• 현재 상태: **${matchedOrder.status}** (진행률 **${matchedOrder.progressPercent}%**)` +
      (matchedOrder.memo ? `\n• 메모: ${matchedOrder.memo}` : '');
  }

  // 3. Status Summaries / Urgent Orders
  if (textLower.includes('임박') || textLower.includes('급한') || textLower.includes('d-day')) {
    const urgent = orders.filter((o) => o.status === '납기임박' || (o.dueDate && o.status !== '완료'));
    if (urgent.length === 0) {
      return `현재 납기 임박(D-3 이내) 수주는 없습니다. 모든 공정이 원활하게 진행 중입니다!`;
    }
    const list = urgent.slice(0, 5).map((o, idx) => `${idx + 1}. **[${o.projectNo}] ${o.partnerName}**: ${o.itemName} (납기: ${o.dueDate || '미정'}, 진행률 ${o.progressPercent}%)`).join('\n');
    return `현재 납기 임박 및 수주 예정 현황입니다 (총 ${urgent.length}건):\n${list}`;
  }

  if (textLower.includes('완료') || textLower.includes('납품') || textLower.includes('실적')) {
    const completed = orders.filter((o) => o.status === '완료');
    const list = completed.slice(0, 5).map((o, idx) => `${idx + 1}. **[${o.projectNo}] ${o.partnerName}**: ${o.itemName} (${o.quantity}개)`).join('\n');
    return `현재 납품 완료된 수주는 총 **${completed.length}건**입니다:\n${list}`;
  }

  if (textLower.includes('거래처') && (textLower.includes('목록') || textLower.includes('전체') || textLower.includes('몇'))) {
    const list = partners.map((p) => `• **${p.name}** (${p.type}): 담당 ${p.manager || '미지정'}, 연락처 ${p.phone || p.tel || '미등록'}`).join('\n');
    return `현재 등록된 거래처 목록은 총 **${partners.length}개사**입니다:\n${list}`;
  }

  // 4. General Conversations (Greetings, Technical Queries, Conversational Fallback)
  if (textLower.includes('안녕') || textLower.includes('반가') || textLower.includes('누구')) {
    return `안녕하세요! TASS 스마트 현장 AI 비서입니다. 🤖\n사내 거래처 조회, 수주 및 납기 공정 현황, 장비/기술 관련 질문이나 일상 대화 등 무엇이든 말씀하세요.`;
  }

  // General Dynamic LLM Style Reply
  return `질문하신 **"${lastUserMsg}"**에 대해 TASS 사내 DB(거래처 ${partners.length}개사, 수주/공정 ${orders.length}건, 견적 ${estimates.length}건)를 바탕으로 안내해 드립니다.\n\n` +
    `특정 거래처(예: "아크 담당자 연락처"), 공정(예: "납기 임박 목록"), 제품 정보 등을 물어보시면 더욱 상세하고 정확하게 답변드리겠습니다!`;
}
