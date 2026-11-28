"use client";

import { useEffect, useRef, useState } from 'react';
import { openTassAi } from '@/lib/tassAi';
import { robotState, ROBOT_GREET_EVENT, ROBOT_WAKE_EVENT } from '@/lib/robotBus';
import { useRobotWalker } from './useRobotWalker';

/**
 * 선임 TASS 로봇 — PC 홈 화면 아래쪽을 걸어 다니고, 졸기도 하고, 놀기도 한다.
 * 누르면 TASS AI 비서 창이 열리고, 끌면 원하는 곳(높이)으로 옮길 수 있다.
 */

type Mode = 'walk' | 'idle' | 'doze' | 'play';

const W = 64; // 로봇 폭(px)
const H = 128;
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

  const face: 'happy' | 'sleep' | 'normal' =
    hover || poked || dragging || mode === 'play' ? 'happy' : mode === 'doze' ? 'sleep' : 'normal';
  const eyeShift = facing * 2;
  const bodyClass = dragging ? 'dragged' : landing ? 'landing' : poked ? 'poke' : hover ? 'hover' : mode;

  return (
    <div ref={wrapRef} className="tassbot-wrap">
      <style>{CSS}</style>

      {bubble && <div className="tassbot-bubble">{bubble}</div>}
      {face === 'sleep' && (
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
        <svg width={W} height={128} viewBox="0 0 64 128" className={`tassbot-body ${bodyClass}`}>
          <defs>
            <linearGradient id="tassbot-metal" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#5b6470" />
              <stop offset="0.45" stopColor="#3a414b" />
              <stop offset="1" stopColor="#22272e" />
            </linearGradient>
            <linearGradient id="tassbot-shine" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(255,255,255,0.18)" />
              <stop offset="0.5" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>

          {/* 발 (걸을 때 번갈아 들썩) */}
          <rect className="tassbot-foot left" x="8" y="111" width="22" height="13" rx="1.5" fill="#2a3038" stroke="#14171b" />
          <rect className="tassbot-foot right" x="34" y="111" width="22" height="13" rx="1.5" fill="#2a3038" stroke="#14171b" />

          {/* 몸통: 길쭉한 금속 판넬 */}
          <rect x="4" y="3" width="56" height="110" rx="3" fill="url(#tassbot-metal)" stroke="#14171b" strokeWidth="1.2" />
          <rect x="4" y="3" width="56" height="110" rx="3" fill="url(#tassbot-shine)" />
          {/* 판넬 홈 */}
          <g stroke="#1a1e23" strokeWidth="0.8" opacity="0.9">
            <line x1="4" y1="38" x2="60" y2="38" />
            <line x1="4" y1="76" x2="60" y2="76" />
            <line x1="32" y1="38" x2="32" y2="113" />
            <line x1="11" y1="38" x2="11" y2="113" opacity="0.5" />
            <line x1="53" y1="38" x2="53" y2="113" opacity="0.5" />
          </g>
          <g stroke="rgba(255,255,255,0.08)" strokeWidth="0.6">
            <line x1="4.6" y1="39" x2="59.4" y2="39" />
            <line x1="4.6" y1="77" x2="59.4" y2="77" />
          </g>

          {/* 얼굴 화면 */}
          <rect x="10" y="9" width="44" height="24" rx="2.5" fill="#07110c" stroke="#26342c" />
          <g fill="#4ade80" transform={`translate(${eyeShift} 0)`}>
            {face === 'normal' && (
              <g className="tassbot-eyes">
                <rect x="19" y="15" width="7" height="7" rx="1.5" />
                <rect x="38" y="15" width="7" height="7" rx="1.5" />
              </g>
            )}
            {face === 'sleep' && (
              <g>
                <rect x="18" y="19" width="9" height="1.8" rx="0.9" />
                <rect x="37" y="19" width="9" height="1.8" rx="0.9" />
              </g>
            )}
            {face === 'happy' && (
              <g fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18.5 21 L22.5 16.5 L26.5 21" />
                <path d="M37.5 21 L41.5 16.5 L45.5 21" />
              </g>
            )}
          </g>
          <text x="32" y="30.5" textAnchor="middle" fontSize="3.6" fontFamily="monospace" fill="#22c55e" opacity="0.85">
            {mode === 'doze' && !hover ? 'SLEEP MODE' : mode === 'play' ? 'PLAY ♪' : 'TASS AI ONLINE'}
          </text>

          {/* 세로 TASS 글자 */}
          <g fill="#f59e0b" fontSize="11" fontWeight="900" fontFamily="Arial, sans-serif" textAnchor="middle">
            <text x="21.5" y="53">T</text>
            <text x="21.5" y="65">A</text>
            <text x="21.5" y="77">S</text>
            <text x="21.5" y="89">S</text>
          </g>
          {/* 작은 표시등 점 */}
          <g fill="#f59e0b" opacity="0.75">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <circle key={i} cx={39 + (i % 2) * 5} cy={47 + Math.floor(i / 2) * 5} r="1.1" className={`tassbot-led led${i}`} />
            ))}
          </g>
          {/* 아래 통풍구 */}
          <rect x="16" y="94" width="32" height="12" rx="1" fill="#15191e" stroke="#0d1013" />
          <g stroke="#2b3138" strokeWidth="0.8">
            {[97, 100, 103].map((y) => (
              <line key={y} x1="19" y1={y} x2="45" y2={y} />
            ))}
          </g>
        </svg>
        <div className="tassbot-shadow" aria-hidden />
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
}
.tassbot-btn:focus-visible { outline: 2px solid #60a5fa; outline-offset: 4px; border-radius: 6px; }
.tassbot-body { display: block; overflow: visible; transform-origin: 50% 100%; filter: drop-shadow(0 6px 10px rgba(0,0,0,0.35)); }
.tassbot-shadow {
  position: absolute; left: 6px; right: 6px; bottom: -6px; height: 8px;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0.45), rgba(0,0,0,0) 70%);
  z-index: -1;
}

/* 걷기: 좌우로 뒤뚱 + 발 번갈아 */
.tassbot-body.walk { animation: tassbot-waddle 0.7s ease-in-out infinite; }
.tassbot-body.walk .tassbot-foot.left { animation: tassbot-step 0.7s ease-in-out infinite; }
.tassbot-body.walk .tassbot-foot.right { animation: tassbot-step 0.7s ease-in-out infinite 0.35s; }
@keyframes tassbot-waddle {
  0%, 100% { transform: rotate(-3.5deg) translateY(0); }
  50% { transform: rotate(3.5deg) translateY(-2px); }
}
@keyframes tassbot-step {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

/* 쉬기: 살짝 숨쉬기 */
.tassbot-body.idle { animation: tassbot-bob 2.6s ease-in-out infinite; }
@keyframes tassbot-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-1.5px); }
}

/* 졸기: 천천히 꾸벅꾸벅 */
.tassbot-body.doze { animation: tassbot-nod 3.2s ease-in-out infinite; }
@keyframes tassbot-nod {
  0%, 100% { transform: rotate(-2deg); }
  45% { transform: rotate(4deg) translateY(1px); }
  55% { transform: rotate(4deg) translateY(1px); }
}

/* 놀기: 점프 → 한 바퀴 → 흔들흔들 */
.tassbot-body.play { animation: tassbot-play 3.2s ease-in-out 1; transform-origin: 50% 55%; }
@keyframes tassbot-play {
  0% { transform: translateY(0); }
  15% { transform: translateY(-30px) rotate(0deg); }
  35% { transform: translateY(-30px) rotate(360deg); }
  48% { transform: translateY(0) rotate(360deg); }
  58% { transform: translateY(-12px) rotate(360deg); }
  66% { transform: translateY(0) rotate(360deg); }
  74% { transform: rotate(352deg); }
  82% { transform: rotate(368deg); }
  90% { transform: rotate(354deg); }
  100% { transform: rotate(360deg); }
}

/* 끌려가는 중: 대롱대롱 / 놓으면 통통 착지 */
.tassbot-btn:active { cursor: grabbing; }
.tassbot-body.dragged { animation: tassbot-dangle 0.5s ease-in-out infinite; transform-origin: 50% 0%; }
.tassbot-body.dragged .tassbot-foot.left { animation: tassbot-step 0.25s ease-in-out infinite; }
.tassbot-body.dragged .tassbot-foot.right { animation: tassbot-step 0.25s ease-in-out infinite 0.12s; }
@keyframes tassbot-dangle {
  0%, 100% { transform: rotate(-7deg); }
  50% { transform: rotate(7deg); }
}
.tassbot-body.landing { animation: tassbot-land 0.45s ease-out 1; }
@keyframes tassbot-land {
  0% { transform: scale(1.08, 0.86); }
  45% { transform: translateY(-8px) scale(0.96, 1.05); }
  100% { transform: translateY(0) scale(1); }
}

/* 마우스 올리면 반가워하기 / 누르면 깡총 */
.tassbot-body.hover { transform: translateY(-4px) scale(1.06); transition: transform 0.2s; }
.tassbot-body.poke { animation: tassbot-poke 0.6s ease-out 1; }
@keyframes tassbot-poke {
  0% { transform: translateY(0) scale(1); }
  40% { transform: translateY(-16px) scale(1.08); }
  100% { transform: translateY(0) scale(1); }
}

/* 눈 깜빡임 */
.tassbot-eyes { transform-box: fill-box; transform-origin: center; animation: tassbot-blink 4.2s infinite; }
@keyframes tassbot-blink {
  0%, 92%, 100% { transform: scaleY(1); }
  95% { transform: scaleY(0.1); }
}

/* 표시등 깜빡 */
.tassbot-led { animation: tassbot-led 1.8s infinite; }
.tassbot-led.led1 { animation-delay: 0.3s; } .tassbot-led.led2 { animation-delay: 0.6s; }
.tassbot-led.led3 { animation-delay: 0.9s; } .tassbot-led.led4 { animation-delay: 1.2s; } .tassbot-led.led5 { animation-delay: 1.5s; }
@keyframes tassbot-led { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }

/* 말풍선 */
.tassbot-bubble {
  position: absolute;
  bottom: 142px;
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
.tassbot-zzz { position: absolute; left: 46px; bottom: 112px; pointer-events: none; color: #e2e8f0; font-weight: 900; text-shadow: 0 2px 6px rgba(0,0,0,0.5); }
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
  .tassbot-body, .tassbot-foot, .tassbot-eyes, .tassbot-led, .tassbot-zzz span { animation: none !important; }
}
`;
