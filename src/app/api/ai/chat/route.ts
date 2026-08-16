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

    // Read API Key from environment variables
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      '';

    if (!apiKey) {
      return createStreamResponse(
        '⚠️ Gemini API 키가 설정되지 않았습니다. Vercel 또는 .env 환경 변수에 GEMINI_API_KEY를 설정해 주세요.'
      );
    }

    // 3. Direct GoogleGenerativeAI Execution
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: systemPrompt,
      });

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
      } else {
        return createStreamResponse('⚠️ Gemini API로부터 빈 응답이 반환되었습니다.');
      }
    } catch (sdkErr: any) {
      console.error('Gemini SDK Execution Error:', sdkErr);

      // Try REST API fallback before throwing error
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
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

        const errorJson = await response.json().catch(() => ({}));
        const restErrorMsg = errorJson.error?.message || response.statusText;
        return createStreamResponse(
          `⚠️ Gemini API 호출 실패 (${response.status}): ${restErrorMsg}`
        );
      } catch (restErr: any) {
        const errorDetails = sdkErr.message || String(sdkErr);
        return createStreamResponse(
          `⚠️ Gemini API 런타임 오류: ${errorDetails}`
        );
      }
    }
  } catch (error: any) {
    console.error('AI Chat API error:', error);
    return createStreamResponse(`⚠️ 서버 API 오류: ${error.message || String(error)}`);
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
