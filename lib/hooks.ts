"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { onMuteChange } from "./audio";
import { getMuted } from "./storage";

/**
 * Read a client-only value (localStorage-backed) after mount.
 * Server render and first client render both see `fallback`, so hydration
 * never mismatches; the real value lands a microtask later.
 */
export function useClientValue<T>(read: () => T, fallback: T): T {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setValue(read());
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

function subscribeReducedMotion(onChange: () => void): () => void {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** True when the user prefers reduced motion — gate shakes and flashes on it. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
}

/** Current mute state, kept in sync across every mute button. */
export function useMuted(): boolean {
  return useSyncExternalStore(
    (onChange) => onMuteChange(onChange),
    getMuted,
    () => false
  );
}
