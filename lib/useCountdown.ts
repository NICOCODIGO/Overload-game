"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sfx } from "./audio";

/**
 * requestAnimationFrame countdown shared by all games.
 *
 * Imperative API (start/stop/shave) because games restart timers dozens of
 * times per run and penalties must adjust a live deadline without re-rendering
 * the world. `progress` (1 → 0) drives the TimerBar.
 */
export interface Countdown {
  /** 1 at start, 0 when expired. */
  progress: number;
  start: (
    durationSeconds: number,
    onExpire: () => void,
    /** `silentExpiry` withholds the timeout sting for rounds where running the
        clock out is the *right* answer — Simon's "didn't say" cards. Expiring
        is a win there, and the alarm would be calling it a loss. */
    opts?: { silentExpiry?: boolean }
  ) => void;
  stop: () => void;
  /** Deduct seconds from the live deadline (error penalties). */
  shave: (seconds: number) => void;
  /** Seconds left right now. */
  remaining: () => number;
}

export function useCountdown(): Countdown {
  const [progress, setProgress] = useState(1);
  const endAtRef = useRef(0);
  const durationRef = useRef(1);
  const runningRef = useRef(false);
  const rafRef = useRef(0);
  const onExpireRef = useRef<(() => void) | null>(null);
  const lastProgressRef = useRef(1);
  const silentExpiryRef = useRef(false);

  const start = useCallback(
    (
      durationSeconds: number,
      onExpire: () => void,
      opts?: { silentExpiry?: boolean }
    ) => {
      silentExpiryRef.current = opts?.silentExpiry ?? false;
      durationRef.current = durationSeconds;
      endAtRef.current = performance.now() + durationSeconds * 1000;
      onExpireRef.current = onExpire;
      runningRef.current = true;
      lastProgressRef.current = 1;
      setProgress(1);
      cancelAnimationFrame(rafRef.current);

      const tick = () => {
        if (!runningRef.current) return;
        const remainingMs = endAtRef.current - performance.now();
        const p = Math.max(0, remainingMs / (durationRef.current * 1000));
        // Warning ticks as the bar crosses into the danger zone.
        for (const threshold of [0.3, 0.15]) {
          if (p < threshold && lastProgressRef.current >= threshold) sfx.tick();
        }
        lastProgressRef.current = p;
        setProgress(p);
        if (remainingMs <= 0) {
          runningRef.current = false;
          const cb = onExpireRef.current;
          onExpireRef.current = null;
          // Every game's clock runs out through here, so the timeout sting
          // lives here rather than in nine separate miss handlers.
          if (cb && !silentExpiryRef.current) sfx.timesUp();
          cb?.();
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    []
  );

  const stop = useCallback(() => {
    runningRef.current = false;
    onExpireRef.current = null;
    cancelAnimationFrame(rafRef.current);
  }, []);

  const shave = useCallback((seconds: number) => {
    endAtRef.current -= seconds * 1000;
  }, []);

  const remaining = useCallback(
    () => Math.max(0, (endAtRef.current - performance.now()) / 1000),
    []
  );

  useEffect(() => {
    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { progress, start, stop, shave, remaining };
}
