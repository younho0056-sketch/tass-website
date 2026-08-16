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

    // 2. System Prompt with DB Snapshot Context
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

    // 3. Read API Key
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      '';

    // 4. Try Dynamic Gemini API Execution
    if (apiKey) {
      try {
        const aiReply = await executeDynamicGeminiCall(
          apiKey,
          systemPrompt,
          conversationHistory,
          lastUserMessage
        );
        if (aiReply) {
          return createStreamResponse(aiReply);
        }
      } catch (geminiErr) {
        console.warn('Gemini API call failed, triggering instant DB hybrid engine:', geminiErr);
      }
    }

    // 5. DB Hybrid Instant Fallback (Guarantees zero error screen for user!)
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
    return createStreamResponse('TASS 스마트 현장 관리 시스템에 오신 것을 환영합니다! 거래처, 납기, 수주 현황 등을 말씀해 주세요.');
  }
}

// Helper: Dynamic Gemini Model Discovery & Execution
async function executeDynamicGeminiCall(
  apiKey: string,
  systemPrompt: string,
  history: any[],
  lastUserMessage: string
): Promise<string | null> {
  let selectedModel = 'gemini-1.5-flash';

  // Step A: Dynamic Model Discovery via GET v1beta/models
  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (listRes.ok) {
      const listData = await listRes.json();
      const validModels = (listData.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name.replace(/^models\//, ''));

      if (validModels.length > 0) {
        const preferred =
          validModels.find((m: string) => m.includes('2.0-flash')) ||
          validModels.find((m: string) => m.includes('1.5-flash')) ||
          validModels.find((m: string) => m.includes('flash')) ||
          validModels[0];
        if (preferred) {
          selectedModel = preferred;
        }
      }
    }
  } catch (e) {
    console.warn('Dynamic model discovery warning, using fallback model identifier:', e);
  }

  // Step B: Build prompt & execute REST generateContent call
  const historyText = history
    .map((m: any) => `${m.role === 'user' ? '사용자' : 'AI 비서'}: ${m.content}`)
    .join('\n');

  const promptWithContext = `${systemPrompt}\n\n[대화 기록]:\n${historyText}\n\n[사용자 질문]: ${lastUserMessage}`;

  const cleanModelName = selectedModel.startsWith('models/')
    ? selectedModel
    : `models/${selectedModel}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/${cleanModelName}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: promptWithContext }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1200,
      },
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (response.ok) {
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (text) return text;
  }

  return null;
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

  if (q.includes('날씨')) {
    return `오늘 TASS 산업 현장은 안전 수칙을 준수하며 정상 가동 중입니다! 최신 날씨는 일기예보를 참고해 주세요.`;
  }

  // 5. Keyword search across DB tables
  const partialPartners = partners.filter(
    (p) => p.name.toLowerCase().includes(q) || (p.manager && p.manager.toLowerCase().includes(q))
  );
  if (partialPartners.length > 0) {
    const list = partialPartners
      .map((p) => `• **${p.name}** (담당: ${p.manager || '미지정'}, Tel: ${p.phone || p.tel || '없음'})`)
      .join('\n');
    return `요청하신 검색 결과와 일치하는 거래처입니다:\n${list}`;
  }

  const partialOrders = orders.filter(
    (o) =>
      o.itemName.toLowerCase().includes(q) ||
      o.partnerName.toLowerCase().includes(q) ||
      o.projectNo.toLowerCase().includes(q)
  );
  if (partialOrders.length > 0) {
    const list = partialOrders
      .map((o) => `• **[${o.projectNo}] ${o.partnerName}**: ${o.itemName} (${o.status}, ${o.progressPercent}%)`)
      .join('\n');
    return `요청하신 검색 결과와 일치하는 공정 현황입니다:\n${list}`;
  }

  return `요청하신 **"${query}"**에 대해 TASS 사내 DB(거래처 ${partners.length}개사, 수주/공정 ${orders.length}건)를 바탕으로 정보를 안내합니다. 특정 거래처명(예: "노만", "아크")이나 수주 품목을 말씀해 주시면 즉시 상세 정보를 찾아드립니다.`;
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
