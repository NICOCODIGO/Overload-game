"use client";

import { useEffect, useRef } from "react";

/**
 * The synthwave grid behind everything — a corridor of two perspective planes
 * running toward the viewer, out of a void that swallows them at the middle.
 *
 * There is no horizon line. The corridor doesn't end at a lit seam; it fades
 * to nothing and is then painted over by a band of darkness, so the lines read
 * as travelling out of somewhere unlit rather than as stopping at a wall.
 * Order matters — the void goes down *after* the grid. Fading alone reads as
 * lines running out of ink; darkness on top reads as depth in front of them.
 *
 * Drawn on a canvas rather than with CSS 3D transforms, and that is the whole
 * point. The CSS version was a pair of elements 200% of the viewport wide with
 * a repeating-gradient grid, tipped 85° in a perspective container. That works
 * until the element exceeds the rasteriser's maximum texture size — 4096px on
 * most GPUs — at which point the browser downsamples or tiles the layer and
 * the thin lines come apart. A 2560px-wide monitor makes that element 5120px
 * wide, so it broke on exactly the machines it looked best on, differently in
 * each engine because they tile differently.
 *
 * Here the lines are geometry, computed per frame at the device's real pixel
 * ratio. There is no texture to overflow, nothing to resample, and no
 * sub-pixel line-width problem near the horizon, so it renders identically at
 * any resolution in any browser.
 */

/** --color-coral, as canvas needs the channels separately for alpha. */
const RGB = "255,93,115";
/** Line opacity at the near edge. Low enough that paper-on-ink text keeps its
    contrast — this sits behind real content. */
const GRID_ALPHA = 0.2;
/** Distance from the viewport middle out to where each half's grid stops, as a
    fraction of viewport height. Lines reach zero alpha here, so the clip edge
    itself is never visible — this is the mouth of the void, not a seam. */
const GAP = 0.075;
/** The abyss, darker than --color-ink so it reads as a hole in the page rather
    than as more page. Near-black rather than pure black: pure #000 against the
    indigo ground looks like a rendering fault on OLED. */
const VOID_RGB = "6,3,18";
const VOID_ALPHA = 0.92;
/** How far the darkness bleeds past the void mouth, as a fraction of viewport
    height. Generous, because a short falloff draws a visible band edge — the
    one hard line this whole effect exists to get rid of. */
const VOID_REACH = 0.3;
/** Seconds for the grid to advance one row. Lower is faster. */
const SPEED = 6;
/** Rows drawn per half. Past ~30 they land inside the horizon bar anyway. */
const ROWS = 36;
/** Columns each side of centre, and the near-edge spacing between them as a
    fraction of viewport width. */
const COLS = 12;
const COL_STEP = 1 / 9;

export function GridBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;

    const resize = () => {
      // Capped at 2: past that the extra pixels cost real time and buy nothing
      // on a backdrop this faint.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /**
     * One half of the corridor. `dir` of 1 draws the floor, -1 the ceiling.
     *
     * Screen position comes straight from the perspective relation y = k / d:
     * a row at depth d sits `near / d` from the horizon, so rows bunch up as
     * they recede and reach the horizon only at infinity. Advancing `phase`
     * from 0 to 1 walks every row into the position the next one just left,
     * which is what makes the loop seamless.
     */
    const drawHalf = (phase: number, dir: 1 | -1) => {
      const mid = H / 2;
      const near = H / 2;
      const gap = H * GAP;
      const edge = mid + dir * gap; // the void's mouth — where the grid stops
      const far = mid + dir * near; // the screen edge

      ctx.save();
      // Clip to this half, past the bar. The verticals are drawn from the
      // vanishing point, so without this they would run through the void.
      ctx.beginPath();
      ctx.rect(0, dir === 1 ? edge : 0, W, dir === 1 ? H - edge : edge);
      ctx.clip();

      // Verticals: straight lines from the vanishing point out to the near
      // edge, faded toward the horizon so distance reads as haze.
      const grad = ctx.createLinearGradient(0, edge, 0, far);
      grad.addColorStop(0, `rgba(${RGB},0)`);
      grad.addColorStop(1, `rgba(${RGB},${GRID_ALPHA})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let m = -COLS; m <= COLS; m++) {
        ctx.moveTo(W / 2, mid);
        ctx.lineTo(W / 2 + m * W * COL_STEP, far);
      }
      ctx.stroke();

      // Horizontals: one per row of depth, marching toward the viewer.
      ctx.lineWidth = 1.5;
      for (let n = 1; n <= ROWS; n++) {
        const d = n - phase;
        if (d <= 0.02) continue; // behind the camera
        const y = mid + dir * (near / d);
        if (Math.abs(y - mid) > near + 4) continue; // past the screen edge
        // Fade with depth, matching the verticals' gradient. Reaches a true 0
        // at the void mouth — the old floor of 0.2 left a rung of lines
        // stacked on the seam, which is what made it read as a horizon.
        const t = Math.min(1, Math.max(0, (Math.abs(y - mid) - gap) / (near - gap)));
        ctx.strokeStyle = `rgba(${RGB},${GRID_ALPHA * t})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      ctx.restore();
    };

    /** The abyss the corridor runs out of. Drawn over both halves, so the last
        of the grid is consumed by it rather than merely thinning out. */
    const drawVoid = () => {
      const mid = H / 2;
      const reach = H * VOID_REACH;
      const grad = ctx.createLinearGradient(0, mid - reach, 0, mid + reach);
      grad.addColorStop(0, `rgba(${VOID_RGB},0)`);
      grad.addColorStop(0.5, `rgba(${VOID_RGB},${VOID_ALPHA})`);
      grad.addColorStop(1, `rgba(${VOID_RGB},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, mid - reach, W, reach * 2);
    };

    let phase = 0;
    let raf = 0;
    let last = performance.now();

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      drawHalf(phase, 1);
      drawHalf(phase, -1);
      drawVoid();
    };

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.25);
      last = now;
      phase = (phase + dt / SPEED) % 1;
      draw();
      raf = requestAnimationFrame(frame);
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    /**
     * Start or stop the loop to match `body.backdrop-still` — the class
     * useLiveBackdrop toggles when a round begins. Stopping rAF outright (not
     * just holding `phase`) means a live round pays nothing at all for the
     * backdrop, which is the point of freezing it.
     */
    const sync = () => {
      const still =
        document.body.classList.contains("backdrop-still") || reduce.matches;
      if (still) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        draw(); // hold the current frame rather than clearing it
      } else if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    const onResize = () => {
      resize();
      draw();
    };

    resize();
    draw();
    sync();

    window.addEventListener("resize", onResize);
    reduce.addEventListener("change", sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      reduce.removeEventListener("change", sync);
      observer.disconnect();
    };
  }, []);

  // h-full w-full is load-bearing: a <canvas> is a replaced element, so without
  // an explicit CSS size it lays out at its drawing-buffer size and adds
  // phantom scroll space.
  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
