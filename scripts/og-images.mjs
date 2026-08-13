/**
 * Generates the Open Graph card images into app/.
 *
 *   node scripts/og-images.mjs
 *
 * Renders HTML in headless Chrome rather than hand-drawing, so the cards use
 * the real Bungee/VT323 webfonts and a straight port of GridBackdrop's
 * perspective math. Sprite grids, titles and taglines are parsed out of the
 * source files they already live in — nothing about a game is restated here,
 * so a sprite edit shows up in the card on the next run.
 *
 * Fonts come from the built CSS in out/, so `npm run build` has to have run at
 * least once. Output is committed; this only needs re-running when the art,
 * the titles, or the taglines change.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
// CRLF normalised on the way in — the source files are checked out with
// Windows endings, which would otherwise break every multi-line anchor below.
const read = (p) => readFileSync(join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((p) => {
  try { readFileSync(p, { flag: "r" }); return true; } catch { return false; }
});
if (!CHROME) throw new Error("no Chrome/Edge binary found — set CHROME by hand");

// ---------------------------------------------------------------- palette
const COLORS = {
  ink: "#140f2d", paper: "#f4f1ff", fog: "#a79ed4",
  lemon: "#ffd23f", coral: "#ff5d73", mint: "#3ddc97", sky: "#4f9bff",
};
const CSS_VAR = {
  INK: COLORS.ink, PAPER: COLORS.paper, LEMON: COLORS.lemon,
  CORAL: COLORS.coral, MINT: COLORS.mint, SKY: COLORS.sky,
};

// ------------------------------------------------------------- font files
// next/font hashes the filenames, so pull the mapping out of the built CSS
// instead of hardcoding it. The "-s.p." build of each family is the latin
// subset, which is all these cards need.
const cssPath = read("out/index.html").match(/\/_next\/static\/chunks\/[\w.-]+\.css/)?.[0];
if (!cssPath) throw new Error("no stylesheet in out/index.html — run `npm run build` first");
const css = read(`out${cssPath}`);
function fontUrl(family) {
  const faces = [...css.matchAll(
    new RegExp(`@font-face\\{font-family:${family};[^}]*?src:url\\(\\.\\.\\/media\\/([\\w.-]+\\.woff2)\\)`, "g")
  )].map((m) => m[1]);
  const latin = faces.find((f) => f.includes("-s.p.")) ?? faces[0];
  if (!latin) throw new Error(`no @font-face for ${family}`);
  return `file:///${join(ROOT, "out/_next/static/media", latin).replace(/\\/g, "/")}`;
}
const BUNGEE = fontUrl("Bungee");
const VT323 = fontUrl("VT323");

// ------------------------------------------------------ game text + art
const gamesSrc = read("lib/games.ts");
const TITLES = Object.fromEntries(
  [...gamesSrc.matchAll(/^\s*(\w+): \{ title: "([^"]+)"/gm)].map((m) => [m[1], m[2]])
);
const ORDER = JSON.parse(
  gamesSrc.match(/GAME_ORDER: GameId\[\] = \[([\s\S]*?)\]/)[1]
    .replace(/,(\s*)$/, "").replace(/\s/g, "").replace(/'/g, '"')
    .replace(/^/, "[").replace(/$/, "]")
);
// Taglines live in the English block of i18n.ts, one per game.
const i18nSrc = read("lib/i18n.ts");
const TAGLINES = Object.fromEntries(
  [...i18nSrc.matchAll(/^\s{4}(\w+): \{[\s\S]*?tagline: "([^"]+)"/gm)].map((m) => [m[1], m[2]])
);

// Sprite grids, straight out of PixelIcon.tsx.
const iconSrc = read("components/PixelIcon.tsx");
const rowsOf = (block) => [...block.matchAll(/"([.#a-zA-Z]*)"/g)].map((m) => m[1]);
const digit = (n) => rowsOf(iconSrc.match(new RegExp(`const DIGIT_${n} = \\[([^\\]]*)\\]`))[1]);
// Headcount's grid is assembled from digit stamps; rebuild it the same way.
const COUNT_ROWS = (() => {
  const [d1, d2, d3] = [digit(1), digit(2), digit(3)];
  return [
    ...Array(4).fill("................"),
    ...d1.map((row, i) =>
      `.${row}.${d2[i].replace(/#/g, "o")}.${d3[i].replace(/#/g, "x")}.`),
    ...Array(5).fill("................"),
  ];
})();

/**
 * Scramble's tile is drawn blank and its letter is a stacked layer, so the
 * base grid alone renders an empty box. PixelIcon shows `layers[0]` whenever
 * it isn't animating; these cards are stills, so they take the same first
 * frame. Padding mirrors letterLayer() in PixelIcon.tsx.
 */
function firstLayerRows(game) {
  if (game !== "scramble") return null;
  const letters = Object.fromEntries(
    [...iconSrc.matchAll(/^\s{2}([A-Z]): \[([^\]]*)\]/gm)].map((m) => [m[1], rowsOf(m[2])])
  );
  const first = iconSrc.match(/layers: \[([^\]]*)\]/)[1].match(/"([A-Z])"/)[1];
  const blank = "................";
  return [
    ...Array(3).fill(blank),
    ...letters[first].map((row) => `....${row}......`),
    ...Array(6).fill(blank),
  ];
}

function spriteOf(game) {
  const block = iconSrc.match(
    new RegExp(`\\n  ${game}: \\{\\n\\s*rows: (\\[[\\s\\S]*?\\]|COUNT_ROWS),\\n\\s*colors: \\{([^}]*)\\}`)
  );
  if (!block) throw new Error(`no sprite for ${game}`);
  const rows = block[1] === "COUNT_ROWS" ? COUNT_ROWS : rowsOf(block[1]);
  const colors = Object.fromEntries(
    [...block[2].matchAll(/"?([^\s",:]+)"?:\s*(\w+)/g)].map((m) => [m[1], CSS_VAR[m[2]]])
  );
  return { rows, colors, layerRows: firstLayerRows(game) };
}

/** One <path> per character — same run-merging the component uses. */
function pathsByChar(rows) {
  const paths = {};
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === ".") { x += 1; continue; }
      let w = 1;
      while (row[x + w] === ch) w += 1;
      paths[ch] = `${paths[ch] ?? ""}M${x} ${y}h${w}v1h-${w}z`;
      x += w;
    }
  });
  return paths;
}

/** Tight box around the lit cells of every supplied grid. */
function bounds(grids) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const rows of grids) {
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === ".") return;
        x0 = Math.min(x0, x); y0 = Math.min(y0, y);
        x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
      })
    );
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Cropped to the art rather than to the 16x16 grid. Several sprites sit in
 * only part of their grid — Blink's eyes occupy six of sixteen rows — and at
 * card size that reads as a tiny mark stranded in dead space. Cropping, then
 * scaling the crop to fill the slot, gives every game the same visual weight.
 */
function spriteSvg(game, px) {
  const { rows, colors, layerRows } = spriteOf(game);
  const grids = layerRows ? [rows, layerRows] : [rows];
  const b = bounds(grids);
  const draw = (g) =>
    Object.entries(pathsByChar(g))
      .map(([ch, p]) => `<path d="${p}" fill="${colors[ch]}"/>`).join("");
  const d = grids.map(draw).join("");
  const scale = px / Math.max(b.w, b.h);
  return `<svg width="${Math.round(b.w * scale)}" height="${Math.round(b.h * scale)}" `
    + `viewBox="${b.x} ${b.y} ${b.w} ${b.h}" shape-rendering="crispEdges">${d}</svg>`;
}

// ------------------------------------------------------------- the page
const backdrop = `
const RGB="255,93,115",GRID_ALPHA=.2,GAP=.075,VOID_RGB="6,3,18",VOID_ALPHA=.92,
VOID_REACH=.3,ROWS=36,COLS=12,COL_STEP=1/9,PHASE=.4,W=1200,H=630;
const ctx=document.getElementById("grid").getContext("2d");
function drawHalf(phase,dir){const mid=H/2,near=H/2,gap=H*GAP,edge=mid+dir*gap,far=mid+dir*near;
ctx.save();ctx.beginPath();ctx.rect(0,dir===1?edge:0,W,dir===1?H-edge:edge);ctx.clip();
const g=ctx.createLinearGradient(0,edge,0,far);g.addColorStop(0,\`rgba(\${RGB},0)\`);
g.addColorStop(1,\`rgba(\${RGB},\${GRID_ALPHA})\`);ctx.strokeStyle=g;ctx.lineWidth=1.5;ctx.beginPath();
for(let m=-COLS;m<=COLS;m++){ctx.moveTo(W/2,mid);ctx.lineTo(W/2+m*W*COL_STEP,far);}ctx.stroke();
ctx.lineWidth=1.5;
for(let n=1;n<=ROWS;n++){const d=n-phase;if(d<=.02)continue;const y=mid+dir*(near/d);
if(Math.abs(y-mid)>near+4)continue;
const t=Math.min(1,Math.max(0,(Math.abs(y-mid)-gap)/(near-gap)));
ctx.strokeStyle=\`rgba(\${RGB},\${GRID_ALPHA*t})\`;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
ctx.restore();}
function drawVoid(){const mid=H/2,reach=H*VOID_REACH;
const g=ctx.createLinearGradient(0,mid-reach,0,mid+reach);g.addColorStop(0,\`rgba(\${VOID_RGB},0)\`);
g.addColorStop(.5,\`rgba(\${VOID_RGB},\${VOID_ALPHA})\`);g.addColorStop(1,\`rgba(\${VOID_RGB},0)\`);
ctx.fillStyle=g;ctx.fillRect(0,mid-reach,W,reach*2);}
drawHalf(PHASE,1);drawHalf(PHASE,-1);drawVoid();`;

const shell = (body, extraCss = "") => `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:"Bungee";src:url("${BUNGEE}") format("woff2")}
@font-face{font-family:"VT323";src:url("${VT323}") format("woff2")}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1200px;height:630px;overflow:hidden}
body{background:${COLORS.ink}}
canvas{position:absolute;inset:0}
.stage{position:absolute;inset:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center}
.over{color:${COLORS.lemon}}
.load{color:${COLORS.coral}}
${extraCss}
</style><canvas id="grid" width="1200" height="630"></canvas>
<div class="stage">${body}</div><script>${backdrop}</script>`;

const homeCard = shell(
  `<h1><span class="over">OVER</span><span class="load">LOAD</span></h1>
   <p>the game that tests your brain</p>`,
  `h1{font-family:"Bungee";font-size:156px;line-height:1;letter-spacing:.01em;white-space:nowrap}
   .over{text-shadow:10px 10px 0 ${COLORS.coral}}
   .load{text-shadow:10px 10px 0 ${COLORS.lemon}}
   p{font-family:"VT323";font-size:52px;line-height:1;color:${COLORS.fog};
     letter-spacing:.06em;margin-top:34px}`
);

const gameCard = (game) => shell(
  `<div class="mark"><span class="over">OVER</span><span class="load">LOAD</span></div>
   <div class="sprite">${spriteSvg(game, 200)}</div>
   <h1>${TITLES[game]}</h1>
   <p>${TAGLINES[game]}</p>`,
  `.mark{font-family:"Bungee";font-size:30px;letter-spacing:.22em;opacity:.72;
     position:absolute;top:52px}
   /* Fixed slot so a short sprite doesn't shift the title up on its card. */
   .sprite{height:200px;display:flex;align-items:center;justify-content:center;
     line-height:0;margin-bottom:34px}
   h1{font-family:"Bungee";font-size:88px;line-height:1;color:${COLORS.lemon};
     text-shadow:6px 6px 0 ${COLORS.coral};white-space:nowrap}
   p{font-family:"VT323";font-size:40px;line-height:1.1;color:${COLORS.fog};
     letter-spacing:.04em;margin-top:26px;max-width:1080px;text-align:center}`
);

// ------------------------------------------------------------------ render
const work = mkdtempSync(join(tmpdir(), "og-"));
function shoot(html, outPath) {
  const page = join(work, "page.html");
  writeFileSync(page, html);
  execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--force-device-scale-factor=1", "--virtual-time-budget=4000",
    "--window-size=1200,630",
    `--screenshot=${join(ROOT, outPath).replace(/\\/g, "/")}`,
    `file:///${page.replace(/\\/g, "/")}`,
  ], { stdio: "pipe" });
  console.log(`  ${outPath}`);
}

console.log("rendering OG cards…");
shoot(homeCard, "app/opengraph-image.png");
for (const game of ORDER) {
  const path = gamesSrc.match(new RegExp(`${game}: \\{[^}]*path: "([^"]+)"`))[1];
  shoot(gameCard(game), `app${path}/opengraph-image.png`);
}
rmSync(work, { recursive: true, force: true });
console.log("done");
