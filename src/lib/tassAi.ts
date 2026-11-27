/** 어느 화면에서든 TASS AI 비서 창을 여는 신호 (TassAiAssistant가 듣고 있다가 연다) */
export const TASS_AI_OPEN_EVENT = 'tass-ai:open';

export function openTassAi() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TASS_AI_OPEN_EVENT));
}
