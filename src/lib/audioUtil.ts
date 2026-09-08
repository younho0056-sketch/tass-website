/**
 * Web Audio API & Web Speech API Utilities for Kiosk Global Broadcast
 */

/**
 * Play a crisp 2-tone "Ding-Dong" chime using Web Audio API
 */
export function playDingDongChime(): void {
  if (typeof window === 'undefined') return;

  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Tone 1: "Ding" (Higher tone, E5 ~659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.4, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.6);

    // Tone 2: "Dong" (Lower tone, C5 ~523.25 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(523.25, now + 0.4);

    gain2.gain.setValueAtTime(0, now + 0.4);
    gain2.gain.linearRampToValueAtTime(0.5, now + 0.43);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.4);
    osc2.stop(now + 1.25);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1500);
  } catch (err) {
    console.error('Failed to play chime sound:', err);
  }
}

/**
 * Read text out loud in Korean using Web Speech API (TTS)
 */
export function speakKoreanTTS(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const koVoice = voices.find((v) => v.lang.includes('ko') || v.lang.includes('KO'));
    if (koVoice) {
      utterance.voice = koVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error('Failed to execute TTS:', err);
  }
}

/**
 * Play chime sound followed by Korean TTS reading
 */
export function playChimeAndSpeak(message: string): void {
  playDingDongChime();
  setTimeout(() => {
    speakKoreanTTS(message);
  }, 450);
}
