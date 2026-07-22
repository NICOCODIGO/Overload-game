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

/**
 * While `active`, hold the document to the strip of screen the on-screen
 * keyboard leaves visible.
 *
 * Focusing an input on a phone doesn't shrink the page — it just covers the
 * bottom of it — so the browser scrolls the whole document up to put the
 * caret in view, taking the game's title and timer off the top with it. We
 * measure the visible strip with the VisualViewport API, hand it to CSS, and
 * undo the browser's scroll; `body.kb-fit` does the rest.
 */
export function useKeyboardFit(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const vv = window.visualViewport;
    const root = document.documentElement;
    const sync = () => {
      if (vv) root.style.setProperty("--vv-height", `${vv.height}px`);
      window.scrollTo(0, 0);
    };
    document.body.classList.add("kb-fit");
    sync();
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    return () => {
      document.body.classList.remove("kb-fit");
      root.style.removeProperty("--vv-height");
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
    };
  }, [active]);
}
