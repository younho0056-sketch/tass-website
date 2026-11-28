"use client";

import type { CSSProperties } from 'react';

/**
 * 판넬 4장짜리 입체 로봇 몸체 (선임 TASS / 후임 TASS JR. 공용).
 * 색만 다르고 모양·동작은 같다. anim 값에 따라 걷기·졸기·빙글 돌기 등을 한다.
 */

export type TarsVariant = 'senior' | 'junior';

// 판넬 크기 (바깥 2장은 좁고, 안쪽 2장은 넓다)
const SLABS = [13, 18, 18, 13];
const GAP = 1;
const SH = 112; // 판넬 높이
const SD = 12; // 판넬 두께

export const TB_W = SLABS.reduce((a, b) => a + b, 0) + GAP * (SLABS.length - 1);
export const TB_H = SH + 8;

const LABELS: Record<TarsVariant, [string, string]> = {
  senior: ['A', 'I'],
  junior: ['J', 'R'],
};

type Props = {
  variant: TarsVariant;
  /** 화면에 보이는 얼굴 글자 (예: '•_•', '^_^', '-_-') */
  face: string;
  /** walk | idle | doze | play | alert | spin | stretch | hover | poke | dragged | landing */
  anim: string;
  facing: 1 | -1;
};

export default function TarsBody({ variant, face, anim, facing }: Props) {
  const [l1, l2] = LABELS[variant];
  return (
    <div className={`tb-root tb-${variant}`}>
      <style>{CSS}</style>
      <div className="tb-stage">
        <div className="tb-turn" style={{ transform: `rotateY(${facing === 1 ? 42 : -42}deg)` }}>
          <div className={`tb-anim ${anim}`}>
            {SLABS.map((w, i) => {
              const left = SLABS.slice(0, i).reduce((a, b) => a + b, 0) + GAP * i;
              const style = { left, width: w, '--hw': `${w / 2}px` } as CSSProperties;
              return (
                <div key={i} className={`tb-slab s${i}`} style={style}>
                  <div className="f front">
                    {i === 1 && (
                      <>
                        <div className="tb-screen">
                          <span>{face}</span>
                        </div>
                        <div className="tb-name">
                          <b>{l1}</b>
                          <b>{l2}</b>
                        </div>
                      </>
                    )}
                    {i === 2 && (
                      <div className="tb-tass">
                        <b>T</b>
                        <b>A</b>
                        <b>S</b>
                        <b>S</b>
                      </div>
                    )}
                    {(i === 0 || i === 3) && (
                      <div className="tb-leds">
                        <i />
                        <i />
                        <i />
                      </div>
                    )}
                  </div>
                  <div className="f back" />
                  <div className="f left" />
                  <div className="f right" />
                  <div className="f top" />
                  <div className="f bottom" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="tb-shadow" aria-hidden />
    </div>
  );
}

const CSS = `
/* 색상: 선임은 진한 흑연색 + 초록 화면, 후임은 밝은 은색 + 하늘색 화면 */
.tb-junior {
  --tb-front: linear-gradient(180deg, #9aa6b6 0%, #7d8899 40%, #5f6a7a 100%);
  --tb-side: linear-gradient(180deg, #59636f, #3a414b);
  --tb-top: #b8c2cf;
  --tb-back: #3d4550;
  --tb-edge: #2d333c;
  --tb-seam: rgba(20,24,30,0.55);
  --tb-glow: #22d3ee;
  --tb-glow-soft: rgba(34,211,238,0.45);
  --tb-letter: #f59e0b;
}
.tb-senior {
  --tb-front: linear-gradient(180deg, #4b535e 0%, #30363e 45%, #1b1f24 100%);
  --tb-side: linear-gradient(180deg, #2c3138, #15181c);
  --tb-top: #626b76;
  --tb-back: #1b1f24;
  --tb-edge: #0c0e10;
  --tb-seam: rgba(0,0,0,0.6);
  --tb-glow: #4ade80;
  --tb-glow-soft: rgba(74,222,128,0.45);
  --tb-letter: #fb923c;
}

.tb-root { position: absolute; inset: 0; }
.tb-stage { position: absolute; inset: 0; perspective: 520px; perspective-origin: 50% 40%; }
.tb-turn { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform 0.7s cubic-bezier(.4,1.4,.6,1); }
.tb-anim { position: absolute; inset: 0; transform-style: preserve-3d; transform-origin: 50% 60%; transition: transform 0.2s; }

/* 판넬(직육면체) 하나 */
.tb-slab { position: absolute; top: 0; height: ${SH}px; transform-style: preserve-3d; transform-origin: 50% 28%; }
.tb-slab .f { position: absolute; box-sizing: border-box; }
.tb-slab .front {
  width: 100%; height: 100%;
  transform: translateZ(${SD / 2}px);
  border: 1px solid var(--tb-edge);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.1);
  background-image:
    linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0) 30%),
    repeating-linear-gradient(180deg, transparent 0 27px, var(--tb-seam) 27px 28px),
    var(--tb-front);
}
.tb-slab .back { width: 100%; height: 100%; transform: rotateY(180deg) translateZ(${SD / 2}px); background: var(--tb-back); border: 1px solid var(--tb-edge); }
.tb-slab .left, .tb-slab .right {
  width: ${SD}px; height: 100%; left: calc(50% - ${SD / 2}px);
  background: var(--tb-side);
  border: 1px solid var(--tb-edge);
}
.tb-slab .right { transform: rotateY(90deg) translateZ(var(--hw)); }
.tb-slab .left { transform: rotateY(-90deg) translateZ(var(--hw)); }
.tb-slab .top, .tb-slab .bottom { width: 100%; height: ${SD}px; top: calc(50% - ${SD / 2}px); }
.tb-slab .top { transform: rotateX(90deg) translateZ(${SH / 2}px); background: var(--tb-top); border: 1px solid var(--tb-edge); }
.tb-slab .bottom { transform: rotateX(-90deg) translateZ(${SH / 2}px); background: #15181c; }

/* 얼굴 화면 / 글자 */
.tb-screen {
  position: absolute; left: 2px; right: 2px; top: 6px; height: 16px;
  background: #03100a; border: 1px solid rgba(255,255,255,0.08); border-radius: 2px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 6px var(--tb-glow-soft);
}
.tb-screen span { color: var(--tb-glow); font: 700 8px/1 monospace; letter-spacing: -0.5px; text-shadow: 0 0 4px var(--tb-glow); white-space: nowrap; }
.tb-name, .tb-tass { position: absolute; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; gap: 1px; }
.tb-name { top: 30px; }
.tb-name b { color: var(--tb-glow); font: 900 9px/1 Arial, sans-serif; text-shadow: 0 0 3px var(--tb-glow-soft); }
.tb-tass { top: 12px; }
.tb-tass b { color: var(--tb-letter); font: 900 9.5px/1.05 Arial, sans-serif; }
.tb-leds { position: absolute; top: 10px; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.tb-leds i { width: 3px; height: 3px; border-radius: 50%; background: var(--tb-glow); opacity: 0.3; animation: tb-led 1.6s infinite; }
.tb-leds i:nth-child(2) { animation-delay: 0.4s; } .tb-leds i:nth-child(3) { animation-delay: 0.8s; }
@keyframes tb-led { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }

.tb-shadow { position: absolute; left: 2px; right: 2px; bottom: -6px; height: 9px; background: radial-gradient(ellipse at center, rgba(0,0,0,0.5), rgba(0,0,0,0) 70%); }

/* 걷기: 바깥 판넬 2장 ↔ 안쪽 판넬 2장이 번갈아 앞뒤로 휘두르며 */
.tb-anim.walk { animation: tb-bob 0.55s ease-in-out infinite; }
.tb-anim.walk .s0, .tb-anim.walk .s3 { animation: tb-swing-a 1.1s ease-in-out infinite; }
.tb-anim.walk .s1, .tb-anim.walk .s2 { animation: tb-swing-b 1.1s ease-in-out infinite; }
@keyframes tb-swing-a { 0%, 100% { transform: rotateX(18deg); } 50% { transform: rotateX(-18deg); } }
@keyframes tb-swing-b { 0%, 100% { transform: rotateX(-12deg); } 50% { transform: rotateX(12deg); } }
@keyframes tb-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }

/* 대기 */
.tb-anim.idle { animation: tb-idle 3s ease-in-out infinite; }
@keyframes tb-idle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1.5px); } }

/* 졸기: 천천히 꾸벅꾸벅 */
.tb-anim.doze { animation: tb-nod 3.2s ease-in-out infinite; transform-origin: 50% 100%; }
@keyframes tb-nod {
  0%, 100% { transform: rotateZ(-2deg); }
  45%, 55% { transform: rotateZ(4deg) translateY(1px); }
}

/* 놀기: 점프 → 입체로 한 바퀴 → 흔들흔들 */
.tb-anim.play { animation: tb-play 3.2s ease-in-out 1; }
@keyframes tb-play {
  0% { transform: translateY(0) rotateY(0deg) rotateZ(0deg); }
  15% { transform: translateY(-28px) rotateY(0deg) rotateZ(0deg); }
  38% { transform: translateY(-28px) rotateY(360deg) rotateZ(0deg); }
  50% { transform: translateY(0) rotateY(360deg) rotateZ(0deg); }
  60% { transform: translateY(-10px) rotateY(360deg) rotateZ(0deg); }
  68% { transform: translateY(0) rotateY(360deg) rotateZ(0deg); }
  76% { transform: translateY(0) rotateY(360deg) rotateZ(-7deg); }
  84% { transform: translateY(0) rotateY(360deg) rotateZ(7deg); }
  92% { transform: translateY(0) rotateY(360deg) rotateZ(-4deg); }
  100% { transform: translateY(0) rotateY(360deg) rotateZ(0deg); }
}

/* 알림: 깡총 + 판넬 들썩 */
.tb-anim.alert { animation: tb-hop 0.9s ease-in-out 2; }
.tb-anim.alert .s0, .tb-anim.alert .s3 { animation: tb-flap 0.45s ease-in-out 4; }
@keyframes tb-hop { 0%, 100% { transform: translateY(0); } 40% { transform: translateY(-14px); } }
@keyframes tb-flap { 0%, 100% { transform: rotateX(0deg); } 50% { transform: rotateX(-28deg); } }

/* 빙글 한 바퀴 (입체로) */
.tb-anim.spin { animation: tb-spin 1.8s cubic-bezier(.5,0,.5,1) 1; }
@keyframes tb-spin { 0% { transform: rotateY(0deg); } 100% { transform: rotateY(360deg); } }

/* 기지개: 바깥 판넬을 펼쳤다 모으기 */
.tb-anim.stretch .s0 { animation: tb-open-l 2.4s ease-in-out 1; }
.tb-anim.stretch .s3 { animation: tb-open-r 2.4s ease-in-out 1; }
@keyframes tb-open-l { 0%, 100% { transform: rotateZ(0deg); } 40%, 60% { transform: rotateZ(-35deg); } }
@keyframes tb-open-r { 0%, 100% { transform: rotateZ(0deg); } 40%, 60% { transform: rotateZ(35deg); } }

/* 마우스 올리면 반가워하기 / 누르면 깡총 */
.tb-anim.hover { transform: translateY(-4px) scale(1.05); }
.tb-anim.poke { animation: tb-poke 0.6s ease-out 1; }
@keyframes tb-poke { 0% { transform: translateY(0) scale(1); } 40% { transform: translateY(-16px) scale(1.06); } 100% { transform: translateY(0) scale(1); } }

/* 끌려가는 중 / 착지 */
.tb-anim.dragged { animation: tb-dangle 0.45s ease-in-out infinite; transform-origin: 50% 0%; }
.tb-anim.dragged .s0, .tb-anim.dragged .s3 { animation: tb-swing-a 0.3s ease-in-out infinite; }
.tb-anim.dragged .s1, .tb-anim.dragged .s2 { animation: tb-swing-b 0.3s ease-in-out infinite; }
@keyframes tb-dangle { 0%, 100% { transform: rotateZ(-6deg); } 50% { transform: rotateZ(6deg); } }
.tb-anim.landing { animation: tb-land 0.5s ease-out 1; }
@keyframes tb-land { 0% { transform: scale(1.06, 0.88); } 45% { transform: translateY(-8px); } 100% { transform: none; } }

@media (prefers-reduced-motion: reduce) {
  .tb-anim, .tb-slab, .tb-leds i { animation: none !important; }
  .tb-turn { transition: none; }
}
`;
