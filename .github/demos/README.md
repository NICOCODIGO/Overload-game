# DROP GIFS HERE

The gallery table in the repo's main [README](../../README.md) already points at
these filenames. Drop a file in with the matching name and it appears — no
Markdown to edit.

| Drop a file named | and it fills the cell for |
| --- | --- |
| `simon.gif` | Simon Says |
| `sequence.gif` | Signal Rush |
| `typing.gif` | Panic Type |
| `clock.gif` | Overclocked |
| `anomaly.gif` | Anomaly |
| `count.gif` | Headcount |
| `pattern.gif` | Next! |
| `scramble.gif` | Scramble |
| `blink.gif` | Blink |

Until a file exists, its cell shows a broken-image icon on GitHub. Either add
all nine before pushing, or comment the table out in the meantime — there's a
note above it explaining how.

## Keep them small

Git keeps every version of a binary forever, so an oversized GIF committed once
inflates the repo's clone size permanently — even if you delete it later. Aim
for **under 3MB each**, which is very achievable:

- **Crop to the game panel, not the browser.** The play surfaces are ~450px
  wide; there's no reason to ship 2500px of desktop and tab bar.
- **One round, 3–6 seconds.** Long enough to show the mechanic, not the whole
  game.
- **~15fps at 600–700px wide** is plenty for a README.

ffmpeg gives much smaller files than most recorders, because it builds a
palette from the actual clip instead of using a generic one:

```bash
ffmpeg -i clip.mp4 \
  -vf "fps=15,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
  -loop 0 simon.gif
```

No ffmpeg? https://ezgif.com does crop, resize and optimise in the browser.

## Why GIF and not MP4

MP4 is smaller and sharper, but a `<video>` tag pointing at a repo file does
**not** render in a GitHub README — video only works for files uploaded through
GitHub's own drag-and-drop uploader, which puts them on its CDN rather than in
your repo. For anything committed here, GIF is the format that actually plays.
