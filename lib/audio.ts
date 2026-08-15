import { getMuted, setMuted } from "./storage";

/**
 * Synthesized sound effects via Web Audio — zero audio assets.
 * The AudioContext is created lazily on first user gesture (browser autoplay
 * policy) and shared app-wide.
 */

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface Note {
  freq: number;
  /** Seconds after call to start. */
  at?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  /** Glide to this frequency over the note's duration. */
  slide?: number;
}

function play(notes: Note[]): void {
  if (getMuted()) return;
  const ac = audioCtx();
  if (!ac) return;
  const now = ac.currentTime;
  for (const n of notes) {
    const start = now + (n.at ?? 0);
    const dur = n.dur ?? 0.08;
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = n.type ?? "square";
    osc.frequency.setValueAtTime(n.freq, start);
    if (n.slide) osc.frequency.exponentialRampToValueAtTime(n.slide, start + dur);
    const peak = n.gain ?? 0.12;
    amp.gain.setValueAtTime(0, start);
    amp.gain.linearRampToValueAtTime(peak, start + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(amp).connect(ac.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }
}

/** Call from any pointer/key handler to unlock audio on iOS. */
export function unlockAudio(): void {
  audioCtx();
}

export const sfx = {
  /** Neutral button press. */
  tap: () => play([{ freq: 440, dur: 0.05, type: "square", gain: 0.07 }]),
  /** Correct input within a round. */
  good: () => play([{ freq: 660, dur: 0.06, type: "triangle", gain: 0.12 }]),
  /** Round / level cleared. */
  success: () =>
    play([
      { freq: 523, dur: 0.09, type: "triangle" },
      { freq: 784, at: 0.07, dur: 0.12, type: "triangle" },
    ]),
  /** Mistake — harsh descending buzz. */
  error: () =>
    play([
      { freq: 220, dur: 0.18, type: "sawtooth", slide: 110, gain: 0.14 },
    ]),
  /** Timer running low. */
  tick: () => play([{ freq: 1200, dur: 0.03, type: "sine", gain: 0.05 }]),
  /** Sequence revealed / new prompt. */
  reveal: () =>
    play([{ freq: 880, dur: 0.07, type: "sine", slide: 1320, gain: 0.08 }]),
  /** Run finished — little fanfare. */
  fanfare: () =>
    play([
      { freq: 523, dur: 0.1, type: "square", gain: 0.09 },
      { freq: 659, at: 0.09, dur: 0.1, type: "square", gain: 0.09 },
      { freq: 784, at: 0.18, dur: 0.1, type: "square", gain: 0.09 },
      { freq: 1047, at: 0.27, dur: 0.24, type: "square", gain: 0.1 },
    ]),
  /** All lives gone. */
  gameOver: () =>
    play([
      { freq: 330, dur: 0.16, type: "sawtooth", gain: 0.1 },
      { freq: 262, at: 0.14, dur: 0.16, type: "sawtooth", gain: 0.1 },
      { freq: 196, at: 0.28, dur: 0.3, type: "sawtooth", slide: 98, gain: 0.11 },
    ]),
};

// Simple pub/sub so every mute button stays in sync.
type Listener = (muted: boolean) => void;
const listeners = new Set<Listener>();

export function toggleMuted(): boolean {
  const next = !getMuted();
  setMuted(next);
  listeners.forEach((l) => l(next));
  return next;
}

export function onMuteChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

