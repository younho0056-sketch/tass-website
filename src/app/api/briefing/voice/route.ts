import { buildBriefing, kstDayRange, kstToday, briefingKey, type BriefFile, type BriefOrder, type BriefSchedule } from '@/lib/briefing';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * 후임 로봇 TASS JR.의 오늘 브리핑을 '장난기 있는 남자 막내' 목소리로 읽은 음성(wav).
 * 읽을 글은 서버가 DB로 직접 만든다 (아무 글이나 읽히지 못하게).
 * 같은 내용이면 10분 동안 캐시해서 바로 나오게 한다.
 */

const cache = new Map<string, { at: number; audio: Uint8Array; type: string }>();
const TTL = 10 * 60 * 1000;

/** 원시 PCM(audio/L16)으로 오면 재생할 수 있게 WAV 머리말을 붙인다 */
function pcmToWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const write = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  write(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  write(36, 'data');
  v.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}

async function getJson<T>(url: URL): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  if (!apiKey) return new Response('음성 키가 설정되지 않았습니다.', { status: 503 });

  // 화면과 같은 방식으로 오늘 브리핑을 만든다
  const today = kstToday();
  const { start, end } = kstDayRange(today);
  const base = new URL(request.url);
  const [o, s, f] = await Promise.all([
    getJson<{ orders?: BriefOrder[] }>(new URL('/api/orders', base)),
    getJson<{ schedules?: BriefSchedule[] }>(new URL(`/api/schedules?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, base)),
    getJson<{ files?: BriefFile[] }>(new URL('/api/estimate-files', base)),
  ]);
  const { speech } = buildBriefing(o?.orders || [], s?.schedules || [], f?.files || [], today);
  const key = briefingKey(speech);

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) {
    return new Response(new Uint8Array(hit.audio), { headers: audioHeaders(hit.type, key) });
  }

  const model = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts';
  const voice = process.env.GEMINI_TTS_VOICE || 'Puck';
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `장난기 많은 막내 후배 남자 직원처럼, 밝고 개구쟁이 같은 말투로 경쾌하게 읽어 줘: ${speech}` }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    const part = data?.candidates?.[0]?.content?.parts?.find((p: { inlineData?: { data: string; mimeType: string } }) => p.inlineData)?.inlineData;
    if (!res.ok || !part?.data) {
      console.error('Briefing TTS error:', res.status, data?.error?.message);
      return new Response('음성을 만들지 못했습니다.', { status: 502 });
    }
    let audio: Uint8Array = Buffer.from(part.data, 'base64');
    let type = String(part.mimeType || 'audio/wav');
    if (/audio\/(L16|pcm)/i.test(type)) {
      const rate = Number(type.match(/rate=(\d+)/)?.[1]) || 24000;
      audio = pcmToWav(audio, rate);
      type = 'audio/wav';
    }
    cache.set(key, { at: Date.now(), audio, type });
    if (cache.size > 8) cache.delete(cache.keys().next().value as string);
    return new Response(new Uint8Array(audio), { headers: audioHeaders(type, key) });
  } catch (err) {
    console.error('Briefing TTS failed:', err);
    return new Response('음성을 만들지 못했습니다.', { status: 502 });
  }
}

function audioHeaders(type: string, key: string) {
  return {
    'Content-Type': type,
    'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=1200',
    'X-Briefing-Key': key,
  };
}
