/**
 * Word pools for Panic Type. Daily prompts are drawn from these with the
 * seeded RNG, escalating short word → word pair → full phrase.
 */

export const SHORT_WORDS = [
  "zap", "run", "go", "hex", "jam", "fizz", "bolt", "dash", "grip", "jolt",
  "keys", "lava", "mint", "nova", "onyx", "pixel", "quick", "rush", "snap",
  "tilt", "vex", "wave", "yell", "zip", "buzz", "clap", "dive", "echo",
  "flux", "glow", "hype", "iris", "jinx", "kick", "loop", "mode", "neon",
  "opal", "pace", "quiz", "risk", "spin", "trap", "urge", "volt", "warp",
] as const;

export const MEDIUM_WORDS = [
  "arcade", "blister", "cascade", "dazzle", "eclipse", "frantic", "gizmo",
  "haywire", "impulse", "jackpot", "kinetic", "livewire", "mayhem", "nimble",
  "orbital", "panicky", "quicken", "reactor", "scramble", "tornado",
  "unravel", "vibrant", "whiplash", "xylophone", "yardstick", "zealous",
  "adrenaline", "backfire", "circuitry", "detonate", "electric", "flashback",
  "gauntlet", "hyperdrive", "ignition", "juggernaut", "overclock", "pressure",
  "quicksand", "rampage", "shockwave", "turbulent", "ultimatum", "voltage",
] as const;

export const PHRASES = [
  "Keep your cool.",
  "Type or be typed.",
  "No pressure at all!",
  "The clock is lying.",
  "Faster, but neater.",
  "Don't look down now.",
  "Blink and you lose.",
  "Steady hands, hot keys.",
  "Panic is a choice; refuse it.",
  "Your keyboard is on fire!",
  "Speed thrills, typos kill.",
  "One more prompt, they said.",
  "Breathe in, hammer keys, breathe out.",
  "The semicolon is watching you; behave.",
  "Caps, commas, chaos — in that order.",
  "Who put punctuation in a speed test?!",
  "Somewhere, a timer laughs at you.",
  "Accuracy first, glory second, panic third.",
  "You've trained your whole life for this.",
  "Warning: this phrase contains a comma, obviously.",
  "Quick! The quota won't fill itself.",
  "Hold the line — every letter counts!",
  "Fingers, don't fail me now.",
  "It's not a typo; it's improvisation.",
  "Ninety percent panic, ten percent typing.",
  "Read twice, type once, cry later.",
  "The backspace key files a complaint.",
  "May your fingers be ever nimble.",
  "This sentence self-destructs in seconds.",
  "Overload achieved; brain rebooting now...",
] as const;
