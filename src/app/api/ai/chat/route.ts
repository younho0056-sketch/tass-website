import { NextResponse } from 'next/server';
import OpenAI from 'openai';
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

    // 1. Fetch real-time DB snapshots from Supabase via Prisma
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
    const systemPrompt = `당신은 TASS 제조 공장의 지능형 전담 AI 비서입니다.
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
1. 사내 DB 관련 질문(담당자, 연락처, 공정 현황, 납기일, 특정 품목 등)에는 주입된 최신 사내 DB 데이터를 바탕으로 정답만 군더더기 없이 정확하게 답변하세요.
2. 날씨, 일반 상식, 기계/용접/산업안전 기술, 수식 계산, 일상 대화 등 사내 DB 외의 모든 질문에도 유능하고 똑똑하게 친절히 답변하세요.
3. 불필요한 메타 서론, 인사말 템플릿(예: '조회 결과입니다', '질문하신 내용:')을 쓰지 말고 대화 맥락에 맞게 자연스럽게 대답하세요.
`;

    // 3. Primary AI Model: OpenAI SDK (gpt-4o-mini)
    const openAiApiKey =
      process.env.OPENAI_API_KEY ||
      process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
      '';

    if (openAiApiKey) {
      try {
        const openai = new OpenAI({ apiKey: openAiApiKey });

        const formattedMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: 'system', content: systemPrompt },
          ...messages.map((m: any) => ({
            role: (m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
            content: m.content,
          })),
        ];

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: formattedMessages,
          temperature: 0.3,
          max_tokens: 1200,
        });

        const replyText = completion.choices[0]?.message?.content?.trim();
        if (replyText) {
          return createStreamResponse(replyText);
        }
      } catch (openAiErr: any) {
        console.error('OpenAI SDK Execution Error:', openAiErr.message || openAiErr);
      }
    }

    // 4. Fallback: Gemini REST API if Gemini key is available
    const geminiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      '';

    if (geminiKey) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        const historyText = messages
          .slice(0, -1)
          .map((m: any) => `${m.role === 'user' ? '사용자' : 'AI 비서'}: ${m.content}`)
          .join('\n');
        const promptWithContext = `${systemPrompt}\n\n[대화 기록]:\n${historyText}\n\n[사용자 질문]: ${lastUserMessage}`;

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptWithContext }] }],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) return createStreamResponse(text);
        }
      } catch (e) {
        console.warn('Gemini fallback failed:', e);
      }
    }

    // 5. Smart DB Direct Search Fallback (Guarantees zero downtime)
    const hybridReply = generateDbHybridReply(
      lastUserMessage,
      partners,
      parsedOrders,
      estimates,
      products,
      todayStr
    );
    return createStreamResponse(hybridReply);
  } catch (error: any) {
    console.error('AI Chat API error:', error);
    return createStreamResponse('TASS 스마트 현장 관리 시스템입니다. 궁금하신 거래처나 수주/공정 현황을 말씀해 주세요!');
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

// Helper: Smart DB Hybrid Engine Fallback
function generateDbHybridReply(
  query: string,
  partners: any[],
  orders: any[],
  estimates: any[],
  products: any[],
  todayStr: string
): string {
  const q = query.trim().toLowerCase();

  // 1. Partner DB Lookup (Matches exact or partial partner/manager name, e.g. "노만", "아크")
  const matchedPartner = partners.find(
    (p) =>
      q.includes(p.name.toLowerCase()) ||
      p.name.toLowerCase().includes(q) ||
      (p.manager && q.includes(p.manager.toLowerCase()))
  );

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
      .join(' | ');

    return `**${matchedPartner.name}** (${matchedPartner.type}) 정보:\n• ${details || '연락처 미등록'}`;
  }

  if (q.includes('담당자') || q.includes('연락처') || q.includes('전화번호') || q.includes('거래처')) {
    if (partners.length > 0) {
      const list = partners
        .slice(0, 10)
        .map((p) => `• **${p.name}** (${p.type}): 담당 ${p.manager || '미지정'} (${p.phone || p.tel || '미등록'})`)
        .join('\n');
      return `현재 등록된 거래처 (총 ${partners.length}개사 중 상위 10개):\n${list}`;
    }
  }

  // 2. Order / Delivery Lookup
  if (q.includes('납기') || q.includes('임박') || q.includes('d-day') || q.includes('급한')) {
    const urgent = orders.filter((o) => o.status === '납기임박' || (o.dueDate && o.status !== '완료'));
    if (urgent.length === 0) {
      return `현재 납기 임박(D-3 이내) 수주는 없습니다. 모든 공정이 순조롭게 진행 중입니다.`;
    }
    const list = urgent
      .slice(0, 5)
      .map(
        (o, idx) =>
          `${idx + 1}. **[${o.projectNo}] ${o.partnerName}**: ${o.itemName} (${o.quantity}개) - 납기: **${o.dueDate || '미정'}** (${o.progressPercent}%)`
      )
      .join('\n');
    return `납기 임박 및 주요 수주 목록 (${urgent.length}건):\n${list}`;
  }

  if (q.includes('완료') || q.includes('납품') || q.includes('실적')) {
    const completed = orders.filter((o) => o.status === '완료');
    if (completed.length === 0) {
      return `현재 납품 완료된 수주는 없습니다.`;
    }
    const list = completed
      .slice(0, 5)
      .map((o, idx) => `${idx + 1}. **[${o.projectNo}] ${o.partnerName}**: ${o.itemName} (${o.quantity}개)`)
      .join('\n');
    return `납품 완료 현황 (총 ${completed.length}건):\n${list}`;
  }

  // 3. Product / Machinery Lookup
  const matchedProduct = products.find((p) => q.includes(p.name.toLowerCase()));
  if (matchedProduct) {
    return `**${matchedProduct.name}** (${matchedProduct.category}): ${matchedProduct.desc || 'TASS 정품 스마트 산업 설비입니다.'}`;
  }

  // 4. Greetings & Weather
  if (q.includes('안녕') || q.includes('반가') || q.includes('누구')) {
    return `안녕하세요! TASS 스마트 현장 AI 비서입니다. 🤖 사내 거래처 연락처, 수주/공정 현황, 장비 지식 등 편하게 말씀해 주세요!`;
  }

  return `요청하신 **"${query}"**에 대해 TASS 사내 DB(거래처 ${partners.length}개사, 수주/공정 ${orders.length}건)를 바탕으로 정보를 안내합니다. 특정 거래처명이나 수주 품목을 말씀해 주시면 즉시 상세 정보를 찾아드립니다.`;
}
