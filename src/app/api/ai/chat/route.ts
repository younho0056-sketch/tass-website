import { Groq } from 'groq-sdk';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
// 사내 DB 전체를 함께 보내므로 응답에 몇 초 걸릴 수 있다
export const maxDuration = 60;

interface ProcessStep {
  name: string;
  status: string;
  active: boolean;
  date?: string | null;
}

type ChatMessage = { role: string; content: string };

/** 한국 시간 기준 오늘 (YYYY-MM-DD) */
function todayKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function buildSystemPrompt(voice: boolean): Promise<string> {
  const [partners, orders, estimates, products] = await Promise.all([
    prisma.partner.findMany({ orderBy: { name: 'asc' } }),
    prisma.order.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.estimate.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.product.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);

  const todayStr = todayKST();
  const currentYearMonth = todayStr.substring(0, 7);

  const sortedOrders = [...orders].sort((a, b) => a.id - b.id);
  const prjMap = new Map<number, string>();
  sortedOrders.forEach((o, index) => prjMap.set(o.id, `PRJ-${String(index + 1).padStart(3, '0')}`));

  const parsedOrders = orders.map((o) => {
    let steps: ProcessStep[] = [];
    try {
      steps = JSON.parse(o.processSteps || '[]');
    } catch {
      steps = [];
    }
    const activeSteps = steps.filter((s) => s.active !== false);
    const completedSteps = activeSteps.filter((s) => s.status === '완료');
    const progressPercent = activeSteps.length > 0 ? Math.round((completedSteps.length / activeSteps.length) * 100) : 0;

    let currentStatus = o.status;
    if (activeSteps.length > 0 && completedSteps.length === activeSteps.length) {
      currentStatus = '완료';
    } else if (o.dueDate && currentStatus !== '완료') {
      const diffDays = Math.ceil((new Date(o.dueDate).getTime() - new Date(todayStr).getTime()) / 86400000);
      if (diffDays < 0) currentStatus = `납기 ${-diffDays}일 지남`;
      else if (diffDays <= 3) currentStatus = '납기임박';
    }

    return {
      projectNo: o.projectNo || prjMap.get(o.id) || `PRJ-${String(o.id).padStart(3, '0')}`,
      partnerName: o.partnerName,
      itemName: o.itemName,
      quantity: o.quantity,
      orderDate: o.orderDate,
      dueDate: o.dueDate,
      status: currentStatus,
      progressPercent,
      memo: o.memo,
    };
  });

  const voiceRules = voice
    ? `
4. 이 답변은 운전 중인 사용자에게 음성으로 읽어 줍니다. 2~3문장 이내로 짧게, 표·목록 기호·이모지·마크다운 없이 말하듯이 답하세요. 전화번호는 "010 1234 5678"처럼 띄어 쓰세요.`
    : '';

  return `당신은 TASS 제조 공장의 수석 AI 비서입니다.
오늘 날짜: ${todayStr} (당월: ${currentYearMonth})

[TASS 실시간 사내 DB 최신 데이터 스냅샷]
■ 등록 거래처 목록 (${partners.length}개사):
${partners
  .map(
    (p) =>
      `- [${p.name}] 구분: ${p.type} | 담당자: ${p.manager || '미지정'} | 휴대전화: ${p.phone || '없음'} | 대표/직통: ${p.tel || '없음'} | 팩스: ${p.fax || '없음'} | 이메일: ${p.email || '없음'} | 주소: ${p.address || '없음'} | 메모/품목: ${p.specialty || ''} ${p.memo || ''}`
  )
  .join('\n')}

■ 수주 및 공정 목록 (${parsedOrders.length}건):
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
${products.map((p) => `- 제품명: ${p.name} | 카테고리: ${p.category} | 설명: ${p.desc || '없음'}`).join('\n')}

[답변 및 대화 원칙]
1. 사내 데이터 질문(담당자, 연락처, 공정 현황, 납기일, 특정 품목 등)에는 주입된 DB 데이터를 기반으로 정답만 군더더기 없이 정확히 답변하세요. 거래처 이름은 일부만 말해도(예: "일진정밀" → "일진정밀공업") 가장 비슷한 거래처로 찾아 답하세요.
2. 날씨, 일반 상식, 기계/용접/안전 기술, 수식 계산, 일상 대화 등 사내 DB 외의 모든 질문에도 친절하고 유능하게 직접 답변하세요.
3. 기계적인 고정 Fallback 문구나 템플릿 서론(예: '조회 결과입니다', '질문하신 내용:')은 완전히 제거하세요.${voiceRules}
`;
}

/** 대화는 사용자 질문으로 시작해야 하므로 맨 앞의 인사말(비서 메시지)은 뺀다 */
function cleanHistory(messages: ChatMessage[]): ChatMessage[] {
  const list = messages
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
  const first = list.findIndex((m) => m.role === 'user');
  return first < 0 ? [] : list.slice(first).slice(-12);
}

async function askGemini(apiKey: string, systemPrompt: string, history: ChatMessage[]): Promise<string> {
  // 'latest' 별칭: 모델이 바뀌어도 이번처럼 "모델 없음" 오류가 나지 않도록
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: history.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })),
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${data?.error?.message || '응답 오류'}`);
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((p: { text?: string; thought?: boolean }) => (p.thought ? '' : p.text || ''))
    .join('')
    .trim();
  if (!text) throw new Error(`Gemini 빈 응답 (${data?.candidates?.[0]?.finishReason || '원인 불명'})`);
  return text;
}

/** Groq는 모델이 자주 바뀌므로 지금 쓸 수 있는 모델 중에서 고른다 */
async function pickGroqModel(groq: Groq): Promise<string> {
  const preferred = [
    'openai/gpt-oss-120b',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
    'llama-3.3-70b-versatile',
    'qwen/qwen3-32b',
    'openai/gpt-oss-20b',
    'llama-3.1-8b-instant',
  ];
  try {
    const list = await groq.models.list();
    const ids = list.data.map((m) => m.id);
    return (
      preferred.find((id) => ids.includes(id)) ||
      ids.find((id) => !/whisper|tts|guard|prompt|distil|orpheus|playai|compound/i.test(id)) ||
      preferred[0]
    );
  } catch {
    return preferred[0];
  }
}

async function askGroq(apiKey: string, systemPrompt: string, history: ChatMessage[]): Promise<string> {
  const groq = new Groq({ apiKey });
  const model = process.env.GROQ_MODEL || (await pickGroqModel(groq));
  const completion = await groq.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ],
    temperature: 0.3,
    max_tokens: 1200,
  });
  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new Error('Groq 빈 응답');
  return text;
}

const usableKey = (k?: string) => (k && k.length > 20 && !/your-|placeholder/i.test(k) ? k : '');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const history = cleanHistory(Array.isArray(body.messages) ? body.messages : []);
    if (history.length === 0) {
      return createStreamResponse('질문을 입력해 주세요.');
    }

    const systemPrompt = await buildSystemPrompt(body.voice === true);
    const geminiKey = usableKey(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
    const groqKey = usableKey(process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY);

    if (!geminiKey && !groqKey) {
      return createStreamResponse('⚠️ AI 키가 설정되지 않았습니다. Vercel 환경 변수에 GEMINI_API_KEY를 넣어 주세요.');
    }

    // Gemini를 먼저 쓰고, 안 되면 Groq로 한 번 더 시도
    const errors: string[] = [];
    if (geminiKey) {
      try {
        return createStreamResponse(await askGemini(geminiKey, systemPrompt, history));
      } catch (err) {
        console.error('Gemini error:', err);
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
    if (groqKey) {
      try {
        return createStreamResponse(await askGroq(groqKey, systemPrompt, history));
      } catch (err) {
        console.error('Groq error:', err);
        errors.push(`Groq: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return createStreamResponse(`⚠️ AI 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.\n(${errors.join(' / ').slice(0, 300)})`);
  } catch (error) {
    console.error('AI Chat API error:', error);
    return createStreamResponse(`⚠️ 서버 API 오류: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// 글자가 조금씩 나타나는 효과를 위한 스트림 응답
function createStreamResponse(text: string) {
  const encoder = new TextEncoder();
  const chunks = text.match(/[\s\S]{1,4}/g) || [text];

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
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}
