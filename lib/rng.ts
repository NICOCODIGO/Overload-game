/**
 * Deterministic RNG for daily challenges.
 *
 * mulberry32 seeded via the xmur3 string hash. Given the same seed string,
 * every player on the planet generates the identical game — that's what makes
 * the daily challenge shareable.
 */

/** xmur3: hashes a string into a 32-bit seed generator. */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/** mulberry32: fast 32-bit PRNG, returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

/** RNG from an arbitrary string seed. */
export function rngFromString(seed: string): Rng {
  return mulberry32(xmur3(seed)());
}

/** Random integer in [min, max] inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Pick a random element. */
export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Draws from `pool` without repeats: walks a shuffled deck and reshuffles once
 * it runs out. The reshuffle never puts the just-drawn item first, so the wrap
 * can't hand you the same thing twice in a row.
 *
 * Use this wherever a run picks from a small fixed pool — `pick` draws *with*
 * replacement, which is why a 14-round hunt through 6 pairs used to show the
 * same pair three times.
 */
export function makeBag<T>(rng: Rng, pool: readonly T[]): () => T {
  let deck: T[] = [];
  let next = 0;
  let last: T | undefined;
  return () => {
    if (next >= deck.length) {
      deck = shuffle(rng, pool);
      if (deck.length > 1 && deck[0] === last) {
        [deck[0], deck[deck.length - 1]] = [deck[deck.length - 1], deck[0]];
      }
      next = 0;
    }
    last = deck[next++];
    return last;
  };
}

/**
 * Builds `total` rounds, rejecting any puzzle the run has already shown.
 *
 * `key` is the player-visible identity of a round — the clock face's time, the
 * anomaly's glyph, the question being asked. Two rounds with the same key read
 * as "wait, I just did this one", which is what makes a daily feel stale.
 *
 * Retries walk the same RNG stream, so the result is still fully determined by
 * the seed and every player gets the identical daily. Long unlimited runs will
 * eventually exhaust a small pool; past that point the guarantee softens to
 * "never twice in a row", which is the part players actually notice.
 */
export function distinctRounds<T>(
  total: number,
  make: (index: number) => T,
  key: (round: T) => string,
  tries = 24
): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < total; i++) {
    let round = make(i);
    for (let t = 0; t < tries && seen.has(key(round)); t++) round = make(i);
    const last = out.length ? key(out[out.length - 1]) : null;
    for (let t = 0; t < tries && key(round) === last; t++) round = make(i);
    seen.add(key(round));
    out.push(round);
  }
  return out;
}

/**
 * Derangement: shuffle until no element sits at its original index.
 * Used for Stroop label scrambles — a label must never match its button color.
 */
export function derange<T>(rng: Rng, arr: readonly T[]): T[] {
  for (let tries = 0; tries < 50; tries++) {
    const out = shuffle(rng, arr);
    if (out.every((v, i) => v !== arr[i])) return out;
  }
  // Fallback: rotate by one — always a valid derangement for distinct items.
  return [...arr.slice(1), arr[0]];
}
