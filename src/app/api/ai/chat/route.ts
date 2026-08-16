import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
    const conversationHistory = messages.slice(0, -1);

    // 1. Fetch real-time DB snapshots
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

    // Chronological PRJ mapping
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

    // 2. Strict System Prompt with DB Snapshot Context
    const systemPrompt = `당신은 TASS 제조 공장의 지능형 AI 비서입니다.
오늘 날짜: ${todayStr} (당월: ${currentYearMonth})

[TASS 실시간 사내 DB 최신 데이터 스냅샷]
■ 등록 거래처 목록 (${partners.length}개사):
${partners
  .map(
    (p) =>
      `- [${p.name}] 구분: ${p.type} | 담당자: ${p.manager || '미지정'} | 휴대전화: ${p.phone || '없음'} | 대표/직통: ${p.tel || '없음'} | 팩스: ${p.fax || '없음'} | 이메일: ${p.email || '없음'} | 주소: ${p.address || '없음'} | 메모/품목: ${p.specialty || ''} ${p.memo || ''}`
  )
  .join('\n')}

■ 수주 및 공정 현황 목록 (${parsedOrders.length}건):
${parsedOrders
  .map(
    (o) =>
      `- [${o.projectNo}] 거래처: ${o.partnerName} | 품목: ${o.itemName} (${o.quantity}개) | 발주일: ${o.orderDate || '미정'} | 납기일: ${o.dueDate || '미정'} | 상태: ${o.status} (진행률: ${o.progressPercent}%) | 메모: ${o.memo || '없음'}`
  )
  .join('\n')}

■ 견적 작성 목록 (${estimates.length}건):
${estimates
  .map(
    (e) =>
      `- [${e.docNo}] 거래처: ${e.partnerName} | 프로젝트: ${e.projectName} | 금액: ${e.totalAmount?.toLocaleString()}원 | 상태: ${e.status} | 견적일: ${e.date}`
  )
  .join('\n')}

■ TASS 주요 제품 및 장비 (${products.length}건):
${products
  .map((p) => `- 제품명: ${p.name} | 카테고리: ${p.category} | 설명: ${p.desc || '없음'}`)
  .join('\n')}

[답변 및 대화 원칙]
1. 사내 데이터(거래처 연락처, 담당자, 납기일, 특정 공정 상태, 미완료 품목 등) 질문에는 주입된 DB 데이터를 기반으로 정답만 군더더기 없이 정확히 답변하세요.
2. 날씨, 일반 상식, 기계/용접/안전 기술, 수식 계산, 일상 대화 등 사내 DB 외의 모든 질문에도 유능하고 똑똑하게 직접 답변하세요.
3. 하드코딩된 고정 매크로 문구나 템플릿 서론(예: '조회 결과입니다', '질문하신 내용:', '도움말:')은 전부 삭제하고 유연하게 대화하세요.
`;

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      '';

    // 3. Primary LLM: Google Generative AI SDK (gemini-1.5-flash)
    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          systemInstruction: systemPrompt,
        });

        // Format history for SDK
        const formattedHistory = conversationHistory.map((m: any) => ({
          role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

        const chat = model.startChat({
          history: formattedHistory,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1200,
          },
        });

        const result = await chat.sendMessage(lastUserMessage);
        const replyText = result.response.text().trim();

        if (replyText) {
          return createStreamResponse(replyText);
        }
      } catch (err: any) {
        console.error('Gemini SDK Error, attempting REST fallback:', err.message || err);

        // Fallback REST call for gemini-1.5-flash / gemini-2.0-flash
        const models = ['gemini-1.5-flash', 'gemini-2.0-flash'];
        for (const modelName of models) {
          try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            const geminiContents = [
              ...conversationHistory.map((m: any) => ({
                role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
                parts: [{ text: m.content }],
              })),
              { role: 'user', parts: [{ text: lastUserMessage }] },
            ];

            const response = await fetch(geminiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: geminiContents,
                generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
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
          } catch (restErr) {
            console.error(`Gemini REST fallback error (${modelName}):`, restErr);
          }
        }
      }
    }

    // 4. OpenAI API Fallback
    const openAiKey = process.env.OPENAI_API_KEY;
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
          const replyText = data.choices?.[0]?.message?.content?.trim() || '';
          if (replyText) {
            return createStreamResponse(replyText);
          }
        }
      } catch (err) {
        console.error('OpenAI API call error:', err);
      }
    }

    // 5. Smart Dynamic Engine Fallback
    const replyText = generateSmartFallbackReply(messages, partners, parsedOrders, estimates, products);
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

// Helper: Dynamic fallback answer synthesis (Zero static macro headers)
function generateSmartFallbackReply(
  messages: any[],
  partners: any[],
  orders: any[],
  estimates: any[],
  products: any[]
): string {
  const lastUserMsg = messages[messages.length - 1]?.content || '';
  const q = lastUserMsg.toLowerCase().trim();

  const matchedPartner = partners.find((p) => q.includes(p.name.toLowerCase()));
  if (matchedPartner) {
    const details = [
      matchedPartner.manager ? `담당자: **${matchedPartner.manager}**` : null,
      matchedPartner.phone ? `전화: **${matchedPartner.phone}**` : null,
      matchedPartner.tel ? `대표전화: **${matchedPartner.tel}**` : null,
      matchedPartner.fax ? `팩스: **${matchedPartner.fax}**` : null,
      matchedPartner.email ? `이메일: **${matchedPartner.email}**` : null,
      matchedPartner.address ? `주소: **${matchedPartner.address}**` : null,
    ]
      .filter(Boolean)
      .join('\n• ');
    return `**${matchedPartner.name}** (${matchedPartner.type}) 정보입니다:\n• ${details}`;
  }

  const matchedOrder = orders.find(
    (o) =>
      q.includes(o.itemName.toLowerCase()) ||
      q.includes(o.partnerName.toLowerCase()) ||
      q.includes(o.projectNo.toLowerCase())
  );
  if (matchedOrder) {
    return `**[${matchedOrder.projectNo}] ${matchedOrder.partnerName}** 수주 공정 현황입니다:\n` +
      `• 품목: **${matchedOrder.itemName}** (${matchedOrder.quantity}개)\n` +
      `• 발주일: **${matchedOrder.orderDate || '미정'}** | 납기일: **${matchedOrder.dueDate || '미정'}**\n` +
      `• 현재 상태: **${matchedOrder.status}** (진행률 **${matchedOrder.progressPercent}%**)`;
  }

  if (q.includes('안녕') || q.includes('반가')) {
    return `안녕하세요! TASS 스마트 현장 AI 비서입니다. 🤖 사내 거래처 조회, 수주/공정 현황, 장비 지식 등 편하게 말씀해 주세요.`;
  }

  return `질문하신 **"${lastUserMsg}"**에 대한 정보를 사내 DB에서 확인하고 있습니다. 거래처명이나 수주 품목명을 구체적으로 입력해주시면 빠르게 안내드리겠습니다.`;
}
