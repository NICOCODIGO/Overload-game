import type { GameId } from "./daily";
import { getMuted, setMuted } from "./storage";

/**
 * Sound effects: your own audio files wherever you've supplied one, and a
 * synthesized Web Audio tone everywhere else.
 *
 * Both paths share one AudioContext, created lazily on the first user gesture
 * (browser autoplay policy) — so muting, iOS unlocking, and volume all work
 * the same whether a sound came from a file or an oscillator.
 */

/* ------------------------------------------------------------------ *
 * Your audio files
 * ------------------------------------------------------------------ */

/**
 * Custom sounds, served from `public/sfx/`.
 *
 * The key is a sound name, optionally scoped to a single game as
 * `"name@game"` — a scoped entry wins for that one game, the unscoped entry
 * covers everything else. So `"error@typing"` re-skins only Panic Type's
 * mistakes and leaves the other eight games on whatever `"error"` is.
 *
 * Any sound with no entry here — or whose file 404s or won't decode — keeps
 * its synthesized version, so files can be added one at a time and nothing
 * ever goes silent. Both .wav and .m4a decode fine; see public/sfx/README.md.
 */
const SAMPLES: Record<string, string> = {
  /** Right answer picked — and, in Panic Type, a prompt typed out in full. */
  success: "/sfx/RightChoice.wav",
  /** Wrong choice picked, in the games where a round *is* a choice — Simon
      Says, Overclocked, Headcount, Next!, Anomaly, Blink. */
  error: "/sfx/WrongSelection.wav",
  /** The three games you key an answer into rather than pick one keep their
      own, softer stumble: a mistyped letter, a misheard arrow, a wrong word
      are all mid-input fumbles rather than a committed wrong answer. */
  "error@scramble": "/sfx/PickedWrong.wav",
  "error@sequence": "/sfx/PickedWrong.wav",
  "error@typing": "/sfx/PickedWrong.wav",
  /** Lives ran out. */
  gameOver: "/sfx/GameOver.wav",
  /** Run finished. Despite the extension this one is really an MP4/AAC file —
      decoding sniffs the bytes rather than the name, so it plays fine. */
  fanfare: "/sfx/RUNCOMPLETE.wav",
  /** Signal Rush's arrow keys and Panic Type's keystrokes. Both games hold
      this one back on the input that finishes the round — `success` fires on
      that same frame, and two sounds at once is just a smear. */
  "good@sequence": "/sfx/select.wav",
  "tap@typing": "/sfx/select.wav",
  // "timesUp": "/sfx/times-up.wav",
  // "error@typing": "/sfx/panic-error.wav",
};

/** Playback level for file-based sounds. The synth peaks around 0.12, so a
    normalized file needs pulling down to sit alongside it — turn this knob if
    your files land louder or quieter than the tones they replace. */
const SAMPLE_GAIN = 0.7;

/* ------------------------------------------------------------------ *
 * Context
 * ------------------------------------------------------------------ */

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
    // Safety net: if nothing preloaded, at least start now.
    preloadSounds();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call from any pointer/key handler to unlock audio on iOS. */
export function unlockAudio(): void {
  audioCtx();
}

/* ------------------------------------------------------------------ *
 * Sample loading
 * ------------------------------------------------------------------ */

const buffers = new Map<string, AudioBuffer>();
let loadStarted = false;

/**
 * Fetch and decode every registered file.
 *
 * Called on the intro screen's mount, not on the gesture that starts the run:
 * a sound fires the instant a round begins, and a fetch that starts on the
 * same click loses that race every time — leaving the first sound of every
 * run on the synth. Decoding needs neither an output device nor a user
 * gesture, so an OfflineAudioContext does it while the how-to-play screen is
 * still up, and the buffers are waiting by the time anything asks for them.
 */
export function preloadSounds(): void {
  if (loadStarted || typeof window === "undefined") return;
  const OAC =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  if (!OAC) return;
  loadStarted = true;
  const decoder = new OAC(1, 1, 44100);
  // One fetch and decode per file, however many sound names point at it.
  const jobs = new Map<string, Promise<AudioBuffer>>();
  for (const [key, url] of Object.entries(SAMPLES)) {
    let job = jobs.get(url);
    if (!job) {
      job = fetch(url)
        .then((res) =>
          res.ok ? res.arrayBuffer() : Promise.reject(new Error(url))
        )
        .then((data) => decoder.decodeAudioData(data));
      jobs.set(url, job);
    }
    void job.then((buf) => buffers.set(key, buf)).catch(() => {
      // Missing, or not audio this browser can decode. That sound simply
      // keeps its synthesized version — never a silent gap.
    });
  }
}

/** Plays the file registered for this sound, if there is one. */
function playSample(name: SfxName, game?: GameId): boolean {
  const scoped = game ? `${name}@${game}` : "";
  const buffer = buffers.get(scoped) ?? buffers.get(name);
  if (!buffer) return false;
  const ac = audioCtx();
  if (!ac) return false;
  const src = ac.createBufferSource();
  const amp = ac.createGain();
  src.buffer = buffer;
  amp.gain.value = SAMPLE_GAIN;
  src.connect(amp).connect(ac.destination);
  src.start();
  return true;
}

/* ------------------------------------------------------------------ *
 * Synth
 * ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ *
 * The vocabulary
 * ------------------------------------------------------------------ */

export type SfxName =
  | "tap"
  | "good"
  | "success"
  | "error"
  | "tick"
  | "reveal"
  | "timesUp"
  | "fanfare"
  | "gameOver";

/**
 * The timeout sting stands in for the generic error buzz.
 *
 * A round that runs out of clock fires `timesUp` from the countdown, and then
 * a beat later `error` from whichever game's miss handler took over — one
 * event, reported twice. The second is swallowed rather than layered on top.
 * Time-boxed, so a wrong answer landing later still buzzes normally.
 */
let timesUpAt = 0;
const TIMEOUT_ECHO_MS = 250;

function sound(name: SfxName, notes: Note[]) {
  return (game?: GameId) => {
    if (getMuted()) return;
    const now = Date.now();
    if (name === "error" && now - timesUpAt < TIMEOUT_ECHO_MS) return;
    if (name === "timesUp") timesUpAt = now;
    if (playSample(name, game)) return;
    play(notes);
  };
}

export const sfx = {
  /** Neutral button press. */
  tap: sound("tap", [{ freq: 440, dur: 0.05, type: "square", gain: 0.07 }]),
  /** Correct input within a round. */
  good: sound("good", [{ freq: 660, dur: 0.06, type: "triangle", gain: 0.12 }]),
  /** Round / level cleared. */
  success: sound("success", [
    { freq: 523, dur: 0.09, type: "triangle" },
    { freq: 784, at: 0.07, dur: 0.12, type: "triangle" },
  ]),
  /** Mistake — harsh descending buzz. */
  error: sound("error", [
    { freq: 220, dur: 0.18, type: "sawtooth", slide: 110, gain: 0.14 },
  ]),
  /** Timer running low. */
  tick: sound("tick", [{ freq: 1200, dur: 0.03, type: "sine", gain: 0.05 }]),
  /** Sequence revealed / new prompt. */
  reveal: sound("reveal", [
    { freq: 880, dur: 0.07, type: "sine", slide: 1320, gain: 0.08 },
  ]),
  /** The clock beat you — fired by the countdown itself, on every game. */
  timesUp: sound("timesUp", [
    { freq: 440, dur: 0.12, type: "square", gain: 0.11 },
    { freq: 330, at: 0.11, dur: 0.2, type: "square", slide: 220, gain: 0.12 },
  ]),
  /** Run finished — little fanfare. */
  fanfare: sound("fanfare", [
    { freq: 523, dur: 0.1, type: "square", gain: 0.09 },
    { freq: 659, at: 0.09, dur: 0.1, type: "square", gain: 0.09 },
    { freq: 784, at: 0.18, dur: 0.1, type: "square", gain: 0.09 },
    { freq: 1047, at: 0.27, dur: 0.24, type: "square", gain: 0.1 },
  ]),
  /** All lives gone. */
  gameOver: sound("gameOver", [
    { freq: 330, dur: 0.16, type: "sawtooth", gain: 0.1 },
    { freq: 262, at: 0.14, dur: 0.16, type: "sawtooth", gain: 0.1 },
    { freq: 196, at: 0.28, dur: 0.3, type: "sawtooth", slide: 98, gain: 0.11 },
  ]),
};

/* ------------------------------------------------------------------ *
 * Mute
 * ------------------------------------------------------------------ */

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
