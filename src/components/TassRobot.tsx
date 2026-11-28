"use client";

import { useEffect, useRef, useState } from 'react';
import { openTassAi } from '@/lib/tassAi';
import { robotState, ROBOT_GREET_EVENT, ROBOT_WAKE_EVENT } from '@/lib/robotBus';
import { useRobotWalker } from './useRobotWalker';
import TarsBody, { TB_W, TB_H } from './TarsBody';

/**
 * 선임 TASS 로봇 — PC 홈 화면 아래쪽을 걸어 다니고, 졸기도 하고, 놀기도 한다.
 * 누르면 TASS AI 비서 창이 열리고, 끌면 원하는 곳(높이)으로 옮길 수 있다.
 */

type Mode = 'walk' | 'idle' | 'doze' | 'play';

const W = TB_W; // 로봇 폭(px) — 후임과 같은 몸체, 색만 다름
const H = TB_H;
const SPEED = 38; // 걷는 속도(px/초)

const LINES: Record<'idle' | 'doze' | 'play', string[]> = {
  idle: ['안녕하세요! 저는 TASS예요', '궁금한 건 저를 눌러 물어보세요', '오늘 납기 확인하셨나요?', '거래처 연락처도 찾아드려요', '저를 끌어서 옮길 수도 있어요'],
  doze: ['zZ… 잠깐만 졸게요', '음냐… 5분만…'],
  play: ['신난다~ ♪', '빙글빙글!', '점프!'],
};
const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];

export default function TassRobot() {
  const [mode, setMode] = useState<Mode>('idle');
  const [bubble, setBubble] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const [poked, setPoked] = useState(false);
  const [landing, setLanding] = useState(false);

  const modeRef = useRef<Mode>('idle');
  const bubbleTimer = useRef<number | undefined>(undefined);

  const say = (text: string, ms = 2600) => {
    window.clearTimeout(bubbleTimer.current);
    setBubble(text);
    bubbleTimer.current = window.setTimeout(() => setBubble(null), ms);
  };

  const walker = useRobotWalker({
    name: 'senior',
    width: W,
    height: H,
    speed: SPEED,
    startX: () => 40,
    onDragStart: () => say('으앗! 어디 가요?', 1500),
    onDragEnd: () => {
      setLanding(true);
      window.setTimeout(() => setLanding(false), 450);
      say('여기서 걸을게요!', 1800);
    },
  });
  const { wrapRef, facing, dragging, dragHandlers, consumeDragClick, setWalking, setPaused, flip } = walker;

  const changeMode = (m: Mode) => {
    modeRef.current = m;
    robotState.senior.mode = m;
    setWalking(m === 'walk');
    setMode(m);
  };

  // 무엇을 할지 몇 초마다 정한다: 걷기 / 멈춰 쉬기 / 졸기 / 놀기
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    let timer = 0;
    const next = () => {
      const r = Math.random();
      const m: Mode = r < 0.45 ? 'walk' : r < 0.63 ? 'idle' : r < 0.82 ? 'doze' : 'play';
      if (m === 'walk' && Math.random() < 0.35) flip();
      changeMode(m);
      if (m !== 'walk' && Math.random() < 0.6) say(pick(LINES[m]));
      const dur =
        m === 'walk' ? 5000 + Math.random() * 6000 : m === 'doze' ? 6500 + Math.random() * 5000 : m === 'play' ? 3300 : 2600 + Math.random() * 2400;
      timer = window.setTimeout(next, dur);
    };
    timer = window.setTimeout(next, 1800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 후임이 인사하거나 깨우면 대답
  useEffect(() => {
    const onGreet = () => window.setTimeout(() => say(pick(['응~ 수고 많아!', '오, 막내 왔어?', '오늘도 파이팅!']), 2200), 900);
    const onWake = () => {
      if (modeRef.current === 'doze') {
        changeMode('idle');
        window.setTimeout(() => say('어! 안 잤어… 진짜야', 2400), 700);
      } else {
        window.setTimeout(() => say('나 안 졸았다~', 2000), 700);
      }
    };
    window.addEventListener(ROBOT_GREET_EVENT, onGreet);
    window.addEventListener(ROBOT_WAKE_EVENT, onWake);
    return () => {
      window.removeEventListener(ROBOT_GREET_EVENT, onGreet);
      window.removeEventListener(ROBOT_WAKE_EVENT, onWake);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => window.clearTimeout(bubbleTimer.current), []);

  const onEnter = () => {
    setPaused(true);
    setHover(true);
    if (!dragging) say('누르면 AI 비서, 끌면 옮기기 💬', 4000);
  };
  const onLeave = () => {
    setPaused(false);
    setHover(false);
  };
  const onClick = () => {
    if (consumeDragClick()) return; // 끌어서 옮긴 경우
    setPoked(true);
    window.setTimeout(() => setPoked(false), 600);
    say('네! 무엇을 도와드릴까요?', 2200);
    openTassAi();
  };

  const face = dragging ? '>_<' : poked ? '!' : hover || mode === 'play' ? '^_^' : mode === 'doze' ? '-_-' : '■_■';
  const bodyClass = dragging ? 'dragged' : landing ? 'landing' : poked ? 'poke' : hover ? 'hover' : mode;

  return (
    <div ref={wrapRef} className="tassbot-wrap">
      <style>{CSS}</style>

      {bubble && <div className="tassbot-bubble">{bubble}</div>}
      {mode === 'doze' && !hover && !dragging && (
        <div className="tassbot-zzz" aria-hidden>
          <span>z</span>
          <span>Z</span>
          <span>z</span>
        </div>
      )}

      <button
        type="button"
        className="tassbot-btn"
        {...dragHandlers}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocus={onEnter}
        onBlur={onLeave}
        onClick={onClick}
        aria-label="TASS 로봇 — 눌러서 AI 비서에게 물어보기"
      >
        <TarsBody variant="senior" face={face} anim={bodyClass} facing={facing} />
      </button>
    </div>
  );
}

const CSS = `
.tassbot-wrap {
  position: fixed;
  left: 0;
  bottom: 72px;
  z-index: 140;
  width: ${W}px;
  will-change: transform;
}
@media (max-width: 48em) { .tassbot-wrap { display: none; } }
.tassbot-btn {
  all: unset;
  cursor: grab;
  touch-action: none;
  display: block;
  position: relative;
  width: ${W}px;
  height: ${H}px;
}
.tassbot-btn:focus-visible { outline: 2px solid #60a5fa; outline-offset: 4px; border-radius: 6px; }
/* 말풍선 */
.tassbot-bubble {
  position: absolute;
  bottom: ${H + 14}px;
  left: 50%;
  transform: translateX(-50%);
  background: #ffffff;
  color: #0f172a;
  font-size: 12.5px;
  font-weight: 700;
  padding: 7px 11px;
  border-radius: 12px;
  white-space: nowrap;
  box-shadow: 0 6px 18px rgba(0,0,0,0.25);
  pointer-events: none;
  animation: tassbot-pop 0.25s ease-out;
}
.tassbot-bubble::after {
  content: '';
  position: absolute; left: 50%; bottom: -6px; transform: translateX(-50%);
  border: 6px solid transparent; border-top-color: #ffffff; border-bottom: 0;
}
@keyframes tassbot-pop { from { opacity: 0; transform: translateX(-50%) translateY(6px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

/* 졸 때 zZ */
.tassbot-zzz { position: absolute; left: 48px; bottom: ${H - 6}px; pointer-events: none; color: #e2e8f0; font-weight: 900; text-shadow: 0 2px 6px rgba(0,0,0,0.5); }
.tassbot-zzz span { position: absolute; animation: tassbot-z 2.4s ease-in infinite; opacity: 0; }
.tassbot-zzz span:nth-child(1) { font-size: 11px; animation-delay: 0s; }
.tassbot-zzz span:nth-child(2) { font-size: 15px; animation-delay: 0.8s; }
.tassbot-zzz span:nth-child(3) { font-size: 12px; animation-delay: 1.6s; }
@keyframes tassbot-z {
  0% { transform: translate(0, 0); opacity: 0; }
  20% { opacity: 1; }
  100% { transform: translate(14px, -30px); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .tassbot-zzz span { animation: none !important; }
}
`;
