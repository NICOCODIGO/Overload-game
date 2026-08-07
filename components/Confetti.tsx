"use client";

import { useEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useClientValue } from "@/lib/hooks";

/**
 * A one-shot confetti celebration on a full-screen canvas — no dependencies,
 * no assets, in keeping with the rest of Overload. Mount it (e.g. when a real
 * personal best lands) and it pops the arcade's accent colors out of a chosen
 * origin, rains more across the full width, and lets the lot fall off the
 * bottom of the screen — the effect ends when the last piece lands, roughly
 * 4s, with nothing fading out. Honors prefers-reduced-motion by rendering
 * nothing.
 *
 * The canvas is portalled to <body>. That is load-bearing, not tidiness: its
 * caller is inside `.animate-rise`, and a transformed element becomes the
 * containing block for its position:fixed descendants. `animation: … both`
 * keeps `transform: translateY(0)` on that element permanently — still a
 * transform, so still a containing block — which trapped the canvas inside
 * the result screen's centered max-w-3xl column. Rendered there, the burst
 * was clipped at that column's edges and squashed, because the drawing buffer
 * was sized to the viewport while CSS sized the element to the column.
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
  /** Fell past the bottom after the rain stopped — gone for good. */
  dead?: boolean;
}

export function Confetti({
  count = 170,
  originRef,
}: {
  count?: number;
  /** Element to burst from — its center is the launch point. Falls back to
      the upper-middle of the screen when absent. */
  originRef?: RefObject<HTMLElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Portals need a DOM to aim at, and this ships in a static export.
  const mounted = useClientValue(() => true, false);

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

    const newPiece = (over: Partial<Piece>): Piece => ({
      x: ox,
      y: oy,
      vx: 0,
      vy: 0,
      size: 5 + Math.random() * 7,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.4,
      sway: Math.random() * Math.PI * 2,
      vsway: 0.05 + Math.random() * 0.06,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      ...over,
    });

    // Two populations. The burst keeps the "it popped out of the badge"
    // moment; the rain is what actually fills the screen, spread across the
    // full width and staggered above the top edge so it arrives over a few
    // seconds instead of all at once.
    const burstCount = Math.round(count * 0.45);
    const pieces: Piece[] = [
      ...Array.from({ length: burstCount }, () => {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.25;
        const speed = 4 + Math.random() * 9;
        return newPiece({
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
        });
      }),
      ...Array.from({ length: count - burstCount }, () =>
        newPiece({
          x: Math.random() * W,
          y: -20 - Math.random() * H * 0.5,
          vx: (Math.random() - 0.5) * 2.5,
          vy: 1 + Math.random() * 2,
        })
      ),
    ];

    const GRAVITY = 0.17;
    // Sideways drag only. Fall speed is capped separately instead of damped,
    // which keeps the initial burst punchy while the descent stays slow.
    const DRAG = 0.99;
    // Paper flutters, it doesn't plummet — but it does have to clear the
    // screen, since falling out of frame is how this ends now.
    const TERMINAL = 6.5;
    // How long new pieces keep being fed in at the top. After this the rain
    // stops and whatever is still airborne simply finishes its fall, so the
    // show ends by emptying out rather than by being switched off.
    const RAIN_MS = 1100;
    // Safety net only: the loop normally stops the moment the last piece is
    // gone, well before this.
    const MAX_MS = 6000;
    // Off-screen slack, so wrapping and recycling both happen out of sight.
    const MARGIN = 30;
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

      ctx.clearRect(0, 0, W, H);
      let airborne = false;

      for (const p of pieces) {
        if (p.dead) continue;
        p.vx *= Math.pow(DRAG, dt);
        p.vy = Math.min(p.vy + GRAVITY * dt, TERMINAL);
        p.sway += p.vsway * dt;
        p.x += (p.vx + Math.sin(p.sway)) * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;

        // Drift off one side, come back in the other — nothing is lost to the
        // edges, and the spread stays even across the whole width.
        if (p.x < -MARGIN) p.x = W + MARGIN;
        else if (p.x > W + MARGIN) p.x = -MARGIN;

        // Past the bottom: send it round again while the rain is still on,
        // otherwise let it go. Retiring pieces one by one is what makes the
        // end read as the confetti landing rather than as an effect stopping.
        if (p.y > H + MARGIN) {
          if (elapsed >= RAIN_MS) {
            p.dead = true;
            continue;
          }
          p.x = Math.random() * W;
          p.y = -MARGIN;
          p.vx = (Math.random() - 0.5) * 2.5;
          p.vy = 1 + Math.random() * 2;
        }

        airborne = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        // Thin rectangles read as tumbling paper flakes.
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }

      // Runs until the last piece is off the bottom — no fade, no cut-off.
      if (airborne && elapsed < MAX_MS) {
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
  }, [count, originRef, mounted]);

  if (!mounted) return null;

  return createPortal(
    // h-full w-full is load-bearing: a <canvas> is a replaced element, so
    // without an explicit CSS size it lays out at its (huge) drawing-buffer
    // intrinsic size and adds phantom scroll space. Pin it to the viewport.
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
    />,
    document.body
  );
}
