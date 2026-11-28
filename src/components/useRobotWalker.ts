"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { robotState, type RobotName } from '@/lib/robotBus';

type Options = {
  name: RobotName;
  width: number;
  height: number;
  /** 걷는 속도 (px/초) */
  speed: number;
  /** 처음 위치 (왼쪽에서 px) — 창 폭을 받아 계산 */
  startX: (viewportWidth: number) => number;
  /** 화면 아래에서 띄울 기본 높이(px) */
  defaultBottom?: number;
  onDragStart?: () => void;
  onDragEnd?: () => void;
};

const EDGE = 24;
const TOP_GAP = 90; // 위쪽 메뉴 줄 아래로만

/**
 * 홈 화면 로봇 공통 움직임: 좌우로 걷기 + 마우스로 집어서 옮기기 + 옮긴 높이 기억하기.
 * 위치는 리렌더 없이 매 프레임 transform/bottom 으로만 바꾼다.
 */
export function useRobotWalker({ name, width, height, speed, startX, defaultBottom = 72, onDragStart, onDragEnd }: Options) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const xRef = useRef(0);
  const bottomRef = useRef(defaultBottom);
  const dirRef = useRef<1 | -1>(1);
  const walkingRef = useRef(false);
  const pausedRef = useRef(false);
  const draggingRef = useRef(false);
  const justDraggedRef = useRef(false);
  const dragRef = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [dragging, setDragging] = useState(false);
  const laneKey = `tassbot-lane-${name}`;

  const callbacks = useRef({ onDragStart, onDragEnd });
  useEffect(() => {
    callbacks.current = { onDragStart, onDragEnd };
  });

  const clampBottom = (b: number) => Math.min(Math.max(8, b), Math.max(8, window.innerHeight - height - TOP_GAP));
  const clampX = (x: number) => Math.min(Math.max(EDGE, x), Math.max(EDGE, window.innerWidth - width - EDGE));

  const apply = () => {
    const el = wrapRef.current;
    if (!el) return;
    el.style.transform = `translateX(${xRef.current}px)`;
    el.style.bottom = `${bottomRef.current}px`;
    robotState[name].x = xRef.current;
  };

  const turn = (d: 1 | -1) => {
    dirRef.current = d;
    setFacing(d);
  };

  // 처음 위치와 저장해 둔 높이
  useEffect(() => {
    xRef.current = clampX(startX(window.innerWidth));
    const saved = Number(window.localStorage.getItem(laneKey));
    bottomRef.current = clampBottom(saved > 0 ? saved : defaultBottom);
    apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 걷기
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (!draggingRef.current) {
        const max = Math.max(EDGE, window.innerWidth - width - EDGE);
        if (walkingRef.current && !pausedRef.current && !document.hidden) {
          let x = xRef.current + dirRef.current * speed * dt;
          if (x >= max) {
            x = max;
            turn(-1);
          } else if (x <= EDGE) {
            x = EDGE;
            turn(1);
          }
          xRef.current = x;
          apply();
        } else if (xRef.current > max) {
          xRef.current = max; // 창이 줄어들면 화면 안으로
          apply();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onResize = () => {
      bottomRef.current = clampBottom(bottomRef.current);
      apply();
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed, width]);

  // 마우스로 집어서 옮기기 (6px 이상 움직이면 '끌기', 아니면 '누르기')
  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !wrapRef.current) return;
    justDraggedRef.current = false;
    const rect = wrapRef.current.getBoundingClientRect();
    dragRef.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: e.clientX - rect.left, oy: e.clientY - rect.top, moved: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 일부 환경에서는 포인터 캡처가 안 될 수 있음 — 끌기는 그대로 동작
    }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId || !wrapRef.current) return;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return;
      d.moved = true;
      draggingRef.current = true;
      setDragging(true);
      callbacks.current.onDragStart?.();
    }
    xRef.current = clampX(e.clientX - d.ox);
    const wrapH = wrapRef.current.offsetHeight;
    bottomRef.current = clampBottom(window.innerHeight - (e.clientY - d.oy) - wrapH);
    apply();
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.id !== e.pointerId) return;
    if (d.moved) {
      draggingRef.current = false;
      justDraggedRef.current = true; // 바로 뒤따르는 click 은 무시
      setDragging(false);
      window.localStorage.setItem(laneKey, String(Math.round(bottomRef.current)));
      callbacks.current.onDragEnd?.();
    }
  };

  return {
    wrapRef,
    facing,
    dragging,
    dragHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
    /** click 처리 전에 불러서, 방금 끌어서 놓은 거면 true (그 click 은 무시) */
    consumeDragClick: () => {
      const was = justDraggedRef.current;
      justDraggedRef.current = false;
      return was;
    },
    setWalking: (on: boolean) => {
      walkingRef.current = on;
    },
    setPaused: (on: boolean) => {
      pausedRef.current = on;
    },
    turn,
    flip: () => turn(dirRef.current === 1 ? -1 : 1),
    getX: () => xRef.current,
    getBottom: () => bottomRef.current,
  };
}
