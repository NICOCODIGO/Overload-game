# Custom sounds

Drop audio files in this folder, then register them in `SAMPLES` at the top of
[`lib/audio.ts`](../../lib/audio.ts). Anything you don't register keeps its
synthesized version, so you can add one file at a time.

```ts
const SAMPLES: Record<string, string> = {
  timesUp: "/sfx/times-up.wav",
  gameOver: "/sfx/game-over.m4a",
  fanfare: "/sfx/run-complete.m4a",
  "error@typing": "/sfx/panic-error.wav",
  "good@sequence": "/sfx/signal-key.wav",
};
```

Paths are URLs, not file paths — `public/sfx/x.wav` is served as `/sfx/x.wav`.

## Sound names

| Name       | Fires when                                             |
| ---------- | ------------------------------------------------------ |
| `tap`      | neutral button / keystroke                             |
| `good`     | a correct input mid-round                              |
| `success`  | round or level cleared                                 |
| `error`    | a mistake                                              |
| `tick`     | timer crossing into the danger zone (twice per round)  |
| `reveal`   | new prompt / sequence shown                            |
| `timesUp`  | the clock ran out — fires on every game                |
| `fanfare`  | run complete                                           |
| `gameOver` | all lives gone                                         |

## Per-game sounds

`"name@game"` overrides that sound for one game only; the unscoped name covers
the rest. Game ids: `simon`, `sequence`, `typing`, `clock`, `anomaly`, `count`,
`pattern`, `scramble`, `blink`.

Scoping is live at the call sites that pass a game id — currently Signal Rush
(`good`, `reveal`, `success`, `error`) and Panic Type (`tap`, `error`). To
theme another game, pass its id at that game's `sfx.*()` calls, e.g.
`sfx.success("blink")`.

## Formats

`.wav` and `.m4a` both decode in every current browser, so mix freely.

- **`.wav`** — uncompressed, ~170 KB per second. Fine for short blips.
- **`.m4a`** — roughly 10× smaller. Better for the longer stings (`gameOver`,
  `fanfare`).

Everything registered here is fetched and decoded up front, on the gesture that
starts a run, so keep the total modest — a few hundred KB is comfortable.

## Levels

Files play through `SAMPLE_GAIN` in `lib/audio.ts` (default `0.7`) because the
synth tones they sit beside peak around `0.12`. If your files come out louder
or quieter than the rest of the arcade, that's the knob.

`timesUp` suppresses the generic `error` buzz for 250 ms after it fires, so a
timeout is one sound rather than two stacked on top of each other.
