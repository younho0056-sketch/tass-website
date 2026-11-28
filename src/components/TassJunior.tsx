"use client";

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { robotState, ROBOT_GREET_EVENT, ROBOT_WAKE_EVENT } from '@/lib/robotBus';
import { setPendingEstimateFiles } from '@/lib/pendingUploads';
import { todayString } from '@/lib/estimateFiles';
import { useRobotWalker } from './useRobotWalker';
import TarsBody, { TB_W, TB_H } from './TarsBody';

/**
 * 후임 로봇 TASS JR. — 판넬 4장이 번갈아 휘두르며 걷는 입체 로봇.
 * 역할: 알림 담당 막내. 납기·일정·견적 회신을 먼저 알려주고, 누르면 오늘 브리핑과 바로가기를 보여준다.
 * 견적서 파일을 끌어다 놓으면 견적관리 보드로 가져간다.
 */

type Mode = 'walk' | 'idle' | 'alert' | 'spin' | 'stretch';

const W = TB_W;
const H = TB_H;
const SPEED = 30;

type Order = { status: string; dueDate: string | null; itemName: string; partnerName: string; projectNo?: string | null };
type Schedule = { title: string; startDate: string; isAllDay?: boolean };
type BriefRow = { key: string; icon: string; label: string; detail?: string; href: string; urgent?: boolean };

const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];

function daysUntil(dateStr: string | null): number | null {
  const m = dateStr?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

async function loadBriefing(): Promise<{ rows: BriefRow[]; lines: string[] }> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
  const [ordersRes, schedRes, filesRes] = await Promise.all([
    fetch('/api/orders').then((r) => r.json()).catch(() => ({})),
    fetch(`/api/schedules?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`).then((r) => r.json()).catch(() => ({})),
    fetch('/api/estimate-files').then((r) => r.json()).catch(() => ({})),
  ]);

  const orders: Order[] = (Array.isArray(ordersRes.orders) ? ordersRes.orders : []).filter((o: Order) => o.status !== '완료');
  const withDays = orders.map((o) => ({ o, d: daysUntil(o.dueDate) })).filter((x) => x.d !== null) as { o: Order; d: number }[];
  const overdue = withDays.filter((x) => x.d < 0).sort((a, b) => a.d - b.d);
  const today = withDays.filter((x) => x.d === 0);
  const soon = withDays.filter((x) => x.d >= 1 && x.d <= 3).sort((a, b) => a.d - b.d);
  const schedules: Schedule[] = Array.isArray(schedRes.schedules) ? schedRes.schedules : [];
  const waiting = (Array.isArray(filesRes.files) ? filesRes.files : []).filter((f: { status: string }) => f.status === '견적중');

  const rows: BriefRow[] = [];
  const lines: string[] = [];
  if (today.length) {
    rows.push({ key: 'today', icon: '⏰', label: `오늘 납기 ${today.length}건`, detail: today.map((x) => x.o.itemName).slice(0, 2).join(', '), href: '/orders', urgent: true });
    lines.push(`오늘 납기 ${today.length}건! ${today[0].o.itemName}`);
  }
  if (overdue.length) {
    rows.push({ key: 'overdue', icon: '🚨', label: `납기 지난 수주 ${overdue.length}건`, detail: `${overdue[0].o.itemName} (${-overdue[0].d}일 지남)${overdue.length > 1 ? ' 외' : ''}`, href: '/orders', urgent: true });
    lines.push(`납기 지난 수주가 ${overdue.length}건 있어요`);
  }
  if (soon.length) {
    rows.push({ key: 'soon', icon: '📦', label: `3일 안에 납기 ${soon.length}건`, detail: soon.map((x) => `${x.o.itemName}(D-${x.d})`).slice(0, 2).join(', '), href: '/orders' });
    lines.push(`3일 안에 납기 ${soon.length}건이에요`);
  }
  if (schedules.length) {
    rows.push({ key: 'sched', icon: '🗓', label: `오늘 일정 ${schedules.length}건`, detail: schedules.map((s) => s.title).slice(0, 2).join(', '), href: '/calendar' });
    lines.push(`오늘 일정: ${schedules[0].title}${schedules.length > 1 ? ` 외 ${schedules.length - 1}건` : ''}`);
  }
  if (waiting.length) {
    rows.push({ key: 'est', icon: '📄', label: `회신 기다리는 견적서 ${waiting.length}건`, href: '/estimates' });
    lines.push(`회신 기다리는 견적서 ${waiting.length}건 있어요`);
  }
  if (rows.length === 0) lines.push('오늘은 급한 일 없어요 👍');
  return { rows, lines };
}

function speakKo(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith('ko'));
  text
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .forEach((part) => {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = 'ko-KR';
      u.rate = 1.05;
      if (voice) u.voice = voice;
      synth.speak(u);
    });
}

export default function TassJunior() {
  const router = useRouter();
  const { isAuthenticated, openAuthModal } = useAuth();
  const [mode, setMode] = useState<Mode>('idle');
  const [bubble, setBubble] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const [fileOver, setFileOver] = useState(false);
  const [landing, setLanding] = useState(false);
  const [brief, setBrief] = useState<{ rows: BriefRow[]; lines: string[] } | null>(null);
  const [card, setCard] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const modeRef = useRef<Mode>('idle');
  const lineIdx = useRef(0);
  const bubbleTimer = useRef<number | undefined>(undefined);
  const lastChat = useRef(0);

  const say = (text: string, ms = 3200) => {
    window.clearTimeout(bubbleTimer.current);
    setBubble(text);
    bubbleTimer.current = window.setTimeout(() => setBubble(null), ms);
  };

  const walker = useRobotWalker({
    name: 'junior',
    width: W,
    height: H,
    speed: SPEED,
    startX: (vw) => vw - W - 160,
    onDragStart: () => {
      setCard(false);
      say('으아아 무서워요!', 1500);
    },
    onDragEnd: () => {
      setLanding(true);
      window.setTimeout(() => setLanding(false), 500);
      say('휴~ 여기서 대기할게요', 1800);
    },
  });
  const { wrapRef, facing, dragging, dragHandlers, consumeDragClick, setWalking, setPaused, flip, getX, getBottom } = walker;

  const changeMode = (m: Mode) => {
    modeRef.current = m;
    robotState.junior.mode = m;
    setWalking(m === 'walk');
    setMode(m);
  };

  // 브리핑 데이터 (PIN 인증 후에만, 5분마다 새로)
  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;
    const load = () =>
      loadBriefing().then((b) => {
        if (!alive) return;
        setBrief(b);
        // 하루 첫 방문이면 아침 브리핑 카드를 한 번 펼친다
        const key = 'tassjr-briefing-date';
        const isPc = window.matchMedia('(min-width: 48em)').matches;
        if (isPc && window.localStorage.getItem(key) !== todayString()) {
          window.localStorage.setItem(key, todayString());
          openCard();
          say('오늘 브리핑이에요! 🔊 누르면 읽어드려요', 4000);
        }
      });
    load();
    const t = window.setInterval(load, 5 * 60 * 1000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // 할 일 정하기: 걷기 / 대기 / 알림 / 빙글 돌기 / 기지개
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    let timer = 0;
    const next = () => {
      const r = Math.random();
      const m: Mode = r < 0.5 ? 'walk' : r < 0.68 ? 'idle' : r < 0.86 ? 'alert' : r < 0.95 ? 'spin' : 'stretch';
      if (m === 'walk' && Math.random() < 0.3) flip();
      changeMode(m);
      timer = window.setTimeout(next, m === 'walk' ? 6000 + Math.random() * 7000 : m === 'spin' ? 2000 : m === 'alert' ? 3600 : 3000 + Math.random() * 2500);
    };
    timer = window.setTimeout(next, 2500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 알림 모드가 되면 다음 소식을 말풍선으로
  useEffect(() => {
    if (mode !== 'alert') return;
    if (!isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      say(pick(['안녕하세요! 막내 TASS JR.예요', 'PIN을 넣으시면 오늘 할 일을 알려드려요']));
      return;
    }
    const lines = brief?.lines || [];
    if (lines.length === 0) return;
    say(lines[lineIdx.current % lines.length], 3400);
    lineIdx.current += 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // 선임 옆을 지나가면 인사, 선임이 졸고 있으면 깨우기
  useEffect(() => {
    const t = window.setInterval(() => {
      if (dragging || Date.now() - lastChat.current < 45000) return;
      const s = robotState.senior;
      if (s.x < -100) return;
      const gap = Math.abs(s.x + s.width / 2 - (getX() + W / 2));
      if (gap > 110) return;
      lastChat.current = Date.now();
      if (s.mode === 'doze') {
        say('선배님! 일어나세요~', 2400);
        window.dispatchEvent(new Event(ROBOT_WAKE_EVENT));
      } else {
        say(pick(['선배님! 안녕하세요', '선배님 오늘도 파이팅!', '선배님~ 커피 드실래요?']), 2400);
        window.dispatchEvent(new Event(ROBOT_GREET_EVENT));
      }
    }, 2500);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  useEffect(() => () => window.clearTimeout(bubbleTimer.current), []);

  function openCard() {
    setCard(true);
    setPaused(true); // 카드가 열려 있는 동안은 제자리
  }

  // 카드는 화면 기준(fixed)으로 로봇 바로 위에 두고, 화면 밖으로 나가지 않게 맞춘다
  useEffect(() => {
    if (!card) return;
    const place = () => {
      const el = cardRef.current;
      if (!el) return;
      const cardW = el.offsetWidth || 300;
      const left = Math.min(Math.max(12, getX() + W / 2 - cardW / 2), window.innerWidth - cardW - 12);
      const bottom = Math.min(getBottom() + H + 18, window.innerHeight - el.offsetHeight - 12);
      el.style.left = `${Math.max(12, left)}px`;
      el.style.bottom = `${Math.max(12, bottom)}px`;
    };
    place();
    window.addEventListener('resize', place);
    const t = window.setInterval(place, 400);
    return () => {
      window.removeEventListener('resize', place);
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card]);
  const closeCard = () => {
    setCard(false);
    setPaused(false);
  };

  const onClick = () => {
    if (consumeDragClick()) return;
    if (!isAuthenticated) {
      say('PIN을 먼저 입력해 주세요!', 2500);
      openAuthModal('/#jr');
      return;
    }
    if (card) closeCard();
    else openCard();
  };

  const go = (href: string) => {
    closeCard();
    say('바로 모셔다 드릴게요!', 1500);
    window.setTimeout(() => router.push(href), 400);
  };

  const readAloud = () => {
    if (!brief) return;
    const text = brief.rows.length
      ? `오늘 브리핑입니다. ${brief.rows.map((r) => r.label).join('. ')}.`
      : '오늘은 급한 일이 없어요.';
    speakKo(text);
  };

  // 견적서 파일을 끌어다 놓으면 견적관리로 가져가기
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (!fileOver) {
      setFileOver(true);
      say('견적서인가요? 여기 놓아주세요!', 2500);
    }
  };
  const onDragLeave = () => setFileOver(false);
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setFileOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    if (!isAuthenticated) {
      say('PIN을 먼저 입력해 주세요!', 2500);
      openAuthModal('/#jr');
      return;
    }
    setPendingEstimateFiles(files);
    say(`견적관리로 ${files.length}개 가져갈게요!`, 1800);
    window.setTimeout(() => router.push('/estimates'), 700);
  };

  const face = fileOver ? '?' : dragging ? '>_<' : hover || mode === 'spin' ? '^_^' : mode === 'alert' ? '!' : mode === 'stretch' ? 'o_o' : '•_•';
  const animClass = dragging ? 'dragged' : landing ? 'landing' : fileOver ? 'alert' : mode;

  return (
    <>
    <div ref={wrapRef} className="jr-wrap" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <style>{CSS}</style>

      {bubble && !card && <div className="jr-bubble">{bubble}</div>}

      <button
        type="button"
        className="jr-btn"
        {...dragHandlers}
        onMouseEnter={() => {
          setHover(true);
          setPaused(true);
          if (!card && !dragging) say(isAuthenticated ? '누르면 오늘 브리핑! (끌면 옮기기)' : '저는 알림 담당 막내예요!', 3000);
        }}
        onMouseLeave={() => {
          setHover(false);
          if (!card) setPaused(false);
        }}
        onClick={onClick}
        aria-label="후임 로봇 TASS JR. — 눌러서 오늘 브리핑 보기"
      >
        <TarsBody variant="junior" face={face} anim={animClass} facing={facing} />
      </button>
    </div>

      {card && (
        <div ref={cardRef} className="jr-card">
          <div className="jr-card-head">
            <b>TASS JR. 오늘의 브리핑</b>
            <span>{todayString().slice(5).replace('-', '/')}</span>
          </div>
          {!brief ? (
            <div className="jr-card-empty">불러오는 중…</div>
          ) : brief.rows.length === 0 ? (
            <div className="jr-card-empty">오늘은 급한 일 없어요 👍</div>
          ) : (
            brief.rows.map((r) => (
              <button key={r.key} type="button" className={`jr-row${r.urgent ? ' urgent' : ''}`} onClick={() => go(r.href)}>
                <span className="ic">{r.icon}</span>
                <span className="tx">
                  <b>{r.label}</b>
                  {r.detail && <small>{r.detail}</small>}
                </span>
                <span className="go">›</span>
              </button>
            ))
          )}
          <div className="jr-card-foot">
            <button type="button" onClick={readAloud}>🔊 소리로 듣기</button>
            <button type="button" onClick={closeCard}>닫기</button>
          </div>
          <div className="jr-card-tip">💡 견적서 PDF를 저에게 끌어다 놓으면 견적관리에 올려드려요</div>
        </div>
      )}
    </>
  );
}

const CSS = `
.jr-wrap {
  position: fixed;
  left: 0;
  bottom: 72px;
  z-index: 141;
  width: ${W}px;
  will-change: transform;
}
@media (max-width: 48em) { .jr-wrap, .jr-card { display: none; } }
.jr-btn { all: unset; display: block; position: relative; width: ${W}px; height: ${H}px; cursor: grab; touch-action: none; }
.jr-btn:active { cursor: grabbing; }
.jr-btn:focus-visible { outline: 2px solid #22d3ee; outline-offset: 4px; border-radius: 6px; }

/* 말풍선 */
.jr-bubble {
  position: absolute; bottom: ${H + 14}px; left: 50%; transform: translateX(-50%);
  background: #ecfeff; color: #0f172a; font-size: 12.5px; font-weight: 700;
  padding: 7px 11px; border-radius: 12px; white-space: nowrap; border: 1px solid #a5f3fc;
  box-shadow: 0 6px 18px rgba(0,0,0,0.25); pointer-events: none; animation: jr-pop 0.25s ease-out;
}
.jr-bubble::after { content: ''; position: absolute; left: 50%; bottom: -6px; transform: translateX(-50%); border: 6px solid transparent; border-top-color: #ecfeff; border-bottom: 0; }
@keyframes jr-pop { from { opacity: 0; transform: translateX(-50%) translateY(6px); } to { opacity: 1; transform: translateX(-50%); } }

/* 브리핑 카드 */
.jr-card {
  position: fixed; left: -9999px; bottom: 0; width: 300px; background: #0b1220; color: #e2e8f0;
  border: 1px solid #164e63; border-radius: 14px; padding: 12px;
  box-shadow: 0 16px 40px rgba(0,0,0,0.45); z-index: 160; animation: jr-pop2 0.2s ease-out;
}
@keyframes jr-pop2 { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.jr-card-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
.jr-card-head b { font-size: 14px; color: #67e8f9; }
.jr-card-head span { font-size: 12px; color: #94a3b8; }
.jr-card-empty { font-size: 13px; color: #cbd5e1; padding: 10px 2px; }
.jr-row {
  all: unset; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 8px;
  padding: 8px; margin-bottom: 6px; border-radius: 10px; background: #111c2e; border: 1px solid #1e293b; cursor: pointer;
}
.jr-row:hover { border-color: #22d3ee; background: #12233a; }
.jr-row.urgent { border-color: #7f1d1d; background: #2a0f14; }
.jr-row.urgent:hover { border-color: #f87171; }
.jr-row .ic { font-size: 16px; width: 20px; text-align: center; }
.jr-row .tx { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.jr-row .tx b { font-size: 13px; }
.jr-row .tx small { font-size: 11px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jr-row .go { color: #64748b; font-size: 18px; }
.jr-card-foot { display: flex; gap: 6px; margin-top: 4px; }
.jr-card-foot button { all: unset; cursor: pointer; flex: 1; text-align: center; font-size: 12.5px; font-weight: 700; padding: 7px 0; border-radius: 8px; background: #155e75; color: #ecfeff; }
.jr-card-foot button:last-child { background: #1e293b; color: #cbd5e1; }
.jr-card-tip { margin-top: 8px; font-size: 11px; color: #94a3b8; }

`;
