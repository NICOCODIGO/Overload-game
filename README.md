<p align="center">
  <img src=".github/overload.svg" alt="OVERLOAD — the brain arcade" width="880">
</p>

Nine fast, stressful mini-games that test reflexes, focus, and patience.
Every game has a **daily challenge** — seeded from the UTC date, so every
player worldwide gets the identical run — plus an endless **unlimited mode**
(how long can you last?), scored by rounds survived.

<!--
  GALLERY — one clip per game, full width, description underneath.
  Clips live in .github/demos/ (see the README there for naming and sizing).
  880 is GitHub's content width on desktop and the clips are ~2557px native,
  so nothing is upscaled; GitHub shrinks them to fit on narrow screens.
-->

<p align="center">
  <b>SIMON SAYS</b> &nbsp;·&nbsp; <code>/simon</code><br><br>
  <img src=".github/demos/simon.gif" alt="Simon Says gameplay" width="880">
</p>

<p align="center"><img src=".github/divider.svg" alt="" width="880"></p>

30 commands, 3 lives. Only obey when the card is stamped SIMON SAYS. From round 5 the button labels lie (Stroop trap), and feint rounds open on GET READY TO TAP — move during the hold and you're out, wait it through and the real command lands.

<p align="center">
  <b>SIGNAL RUSH</b> &nbsp;·&nbsp; <code>/sequence</code><br><br>
  <img src=".github/demos/sequence.gif" alt="Signal Rush gameplay" width="880">
</p>

<p align="center"><img src=".github/divider.svg" alt="" width="880"></p>

Intercept an arrow code and re-key it before the channel closes. Deep transmissions flash once, then go dark — input from memory. A wrong key resets the code and burns time.

<p align="center">
  <b>PANIC TYPE</b> &nbsp;·&nbsp; <code>/typing</code><br><br>
  <img src=".github/demos/typing.gif" alt="Panic Type gameplay" width="880">
</p>

<p align="center"><img src=".github/divider.svg" alt="" width="880"></p>

20 prompts, short words escalating into punctuated phrases. Type them exactly. Typos flash red; the clock has no mercy. Score is prompts survived plus accuracy.

<p align="center">
  <b>OVERCLOCKED</b> &nbsp;·&nbsp; <code>/clock</code><br><br>
  <img src=".github/demos/clock.gif" alt="Overclocked gameplay" width="880">
</p>

<p align="center"><img src=".github/divider.svg" alt="" width="880"></p>

Read the analog clock, tap the matching time — flip rounds reverse it, matching a digital time to a face. Numbers vanish, distractors become hand-swap traps, and the finale clocks spin, freeze, and disappear.

<p align="center">
  <b>ANOMALY</b> &nbsp;·&nbsp; <code>/anomaly</code><br><br>
  <img src=".github/demos/anomaly.gif" alt="Anomaly gameplay" width="880">
</p>

<p align="center"><img src=".github/divider.svg" alt="" width="880"></p>

One glyph in a seeded crowd doesn't belong. Colour pops give way to odd-one-out emoji, then conjunction search, then near-identical character twins. Wrong taps burn time.

<p align="center">
  <b>HEADCOUNT</b> &nbsp;·&nbsp; <code>/count</code><br><br>
  <img src=".github/demos/count.gif" alt="Headcount gameplay" width="880">
</p>

<p align="center"><img src=".github/divider.svg" alt="" width="880"></p>

A mob of numbers and shapes in mixed colours, sizes, and spins — count only what the question asks for ("how many are mint?", "how many triangles?", "how many huge 7s?"). One keypad tap to answer.

<p align="center">
  <b>NEXT!</b> &nbsp;·&nbsp; <code>/pattern</code><br><br>
  <img src=".github/demos/pattern.gif" alt="Next! gameplay" width="880">
</p>

<p align="center"><img src=".github/divider.svg" alt="" width="880"></p>

Sequence completion: number runs, letter ladders, growing gaps, spinning arrows. The wrong options are the mistakes you were about to make — miss one and the rule is drawn onto the pattern itself.

<p align="center">
  <b>SCRAMBLE</b> &nbsp;·&nbsp; <code>/scramble</code><br><br>
  <img src=".github/demos/scramble.gif" alt="Scramble gameplay" width="880">
</p>

<p align="center"><img src=".github/divider.svg" alt="" width="880"></p>

Unscramble the hidden word from a pile of letter tiles — but decoys are mixed in. The hint disappears as you climb; one correct letter is locked in green to start you off.

<p align="center">
  <b>BLINK</b> &nbsp;·&nbsp; <code>/blink</code><br><br>
  <img src=".github/demos/blink.gif" alt="Blink gameplay" width="880">
</p>

<p align="center"><img src=".github/divider.svg" alt="" width="880"></p>

Change blindness: the scene flashes, blinks, and flashes again with one difference. Tap it. Changes go from loud recolours to near-identical hue shifts.

Personal bests, daily results, and the daily streak live in `localStorage`.
Results copy to the clipboard as share text, Wordle-style:

```
Overload: Signal Rush #12 — Level 9 ⚡ — ✅✅✅✅✅✅✅✅❌ — beat me: https://…/sequence
```

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4
- Fully static (`output: "export"`) — no backend in v1. All persistence goes
  through `lib/storage.ts`, so a future backend (accounts, leaderboards) swaps
  one module, not the games.
- Sounds are synthesized with the Web Audio API (`lib/audio.ts`) — no assets.
  Mute toggle persists.
- Mobile-first: touch/swipe/d-pad + on-screen keyboard everywhere; arrow keys,
  WASD, and number keys on desktop. `prefers-reduced-motion` respected.

## Architecture

```
lib/
  rng.ts          mulberry32 + xmur3 seeded RNG, shuffle, derangement
  daily.ts        UTC daily number + per-game daily/practice seeds, speed ramp
  storage.ts      localStorage: bests, daily results, streak, mute
  audio.ts        Web Audio synth sfx + mute pub/sub
  useCountdown.ts rAF countdown with penalty support (drives every game)
  share.ts        share-text builder + clipboard
  words.ts        word/phrase pools for Panic Type
  hooks.ts        useClientValue (hydration-safe), useMuted, reduced motion
components/
  Header, GameCard, ArcadeGrid, IntroScreen, ResultScreen, TimerBar, Lives
app/
  globals.css     ALL design tokens (colors, fonts, shadows, animations)
  simon/ sequence/ typing/ clock/ anomaly/ count/ pattern/ scramble/ blink/
                  one server page (metadata) + one client game component each
```

## Develop

```bash
npm install
npm run dev    # http://localhost:3000
npm run lint
npm run build  # static site → /out
```

## Deploy to AWS Amplify

The repo ships an `amplify.yml`. Connect the repo in the Amplify console,
accept the detected settings, and it deploys the static `/out` directory.
Optionally set `NEXT_PUBLIC_SITE_URL` to your live URL so share links and
Open Graph tags use the real domain.
