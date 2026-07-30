"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * A one-shot confetti burst on a full-screen canvas — no dependencies, no
 * assets, in keeping with the rest of Overload. Mount it (e.g. when a real
 * personal best lands) and it pops the arcade's accent colors out of a chosen
 * origin, flutters them down over ~5s, then cleans itself up. Honors
 * prefers-reduced-motion by rendering nothing.
 */

// The four brand accents (globals.css) so confetti reads as "Overload".
const COLORS = ["#ffd23f", "#ff5d73", "#3ddc97", "#4f9bff", "#f4f1ff"];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vrot: number;
  /** Sway phase + rate, so pieces tumble sideways instead of dropping on rails. */
  sway: number;
  vsway: number;
  color: string;
}

export function Confetti({
  count = 130,
  originRef,
}: {
  count?: number;
  /** Element to burst from — its center is the launch point. Falls back to
      the upper-middle of the screen when absent. */
  originRef?: RefObject<HTMLElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = window.innerWidth;
    let H = window.innerHeight;
    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Launch point: the origin element's center, or upper-middle by default.
    const rect = originRef?.current?.getBoundingClientRect();
    const ox = rect ? rect.left + rect.width / 2 : W / 2;
    const oy = rect ? rect.top + rect.height / 2 : H * 0.3;

    // Burst up and out from the origin — a fan through the upper hemisphere so
    // it reads as popping out of the button, then gravity brings it down.
    const pieces: Piece[] = Array.from({ length: count }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.25;
      const speed = 4 + Math.random() * 9;
      return {
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 7,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.4,
        sway: Math.random() * Math.PI * 2,
        vsway: 0.05 + Math.random() * 0.06,
        color: COLORS[(Math.random() * COLORS.length) | 0],
      };
    });

    const GRAVITY = 0.17;
    // Sideways drag only. Fall speed is capped separately instead of damped,
    // which keeps the initial burst punchy while the descent stays slow.
    const DRAG = 0.99;
    // Paper flutters, it doesn't plummet: ~5px per 60fps frame (~310px/s) keeps
    // pieces on screen for the whole show rather than 2 seconds of it.
    const TERMINAL = 5;
    const LIFE_MS = 5200;
    const FADE_MS = 1300;
    let raf = 0;
    const start = performance.now();
    let prev = start;

    const frame = (now: number) => {
      const elapsed = now - start;
      // Step in 60fps-equivalent units. Without this the sim advances once per
      // rAF callback, so a 120Hz display runs the whole thing at double speed
      // while the wall-clock timings below stay put. Capped so a background tab
      // or a hitch resumes instead of teleporting every piece off screen.
      const dt = Math.min((now - prev) / (1000 / 60), 2);
      prev = now;

      const fadeAt = LIFE_MS - FADE_MS;
      const alpha =
        elapsed < fadeAt ? 1 : Math.max(0, 1 - (elapsed - fadeAt) / FADE_MS);
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = alpha;

      for (const p of pieces) {
        p.vx *= Math.pow(DRAG, dt);
        p.vy = Math.min(p.vy + GRAVITY * dt, TERMINAL);
        p.sway += p.vsway * dt;
        p.x += (p.vx + Math.sin(p.sway)) * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        // Thin rectangles read as tumbling paper flakes.
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }

      if (elapsed < LIFE_MS) {
        raf = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, W, H);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [count, originRef]);

  return (
    // h-full w-full is load-bearing: a <canvas> is a replaced element, so
    // without an explicit CSS size it lays out at its (huge) drawing-buffer
    // intrinsic size and adds phantom scroll space. Pin it to the viewport.
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
    />
  );
}
