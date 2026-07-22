/**
 * Word pools for Scramble, grouped by length. Each word carries a short
 * category hint (shown early, hidden at the hardest levels). All uppercase;
 * no spaces, no duplicate-heavy oddities that would make anagrams ambiguous.
 */

export interface ScrambleWord {
  w: string;
  h: string;
}

export const WORD_POOLS: Record<number, ScrambleWord[]> = {
  4: [
    { w: "WOLF", h: "animal" },
    { w: "MOON", h: "in the sky" },
    { w: "FROG", h: "animal" },
    { w: "SALT", h: "in the kitchen" },
    { w: "KING", h: "royalty" },
    { w: "BOMB", h: "it explodes" },
    { w: "NEON", h: "a glowing gas" },
    { w: "RUBY", h: "a gem" },
    { w: "SNOW", h: "weather" },
    { w: "HERO", h: "the good guy" },
    { w: "MAZE", h: "you get lost in it" },
    { w: "LAVA", h: "from a volcano" },
    { w: "DUEL", h: "a one-on-one fight" },
    { w: "IRIS", h: "part of the eye" },
  ],
  5: [
    { w: "TIGER", h: "animal" },
    { w: "PIANO", h: "instrument" },
    { w: "OCEAN", h: "lots of water" },
    { w: "ROBOT", h: "a machine" },
    { w: "GHOST", h: "spooky" },
    { w: "LEMON", h: "a fruit" },
    { w: "STORM", h: "weather" },
    { w: "CROWN", h: "royalty wears it" },
    { w: "PIXEL", h: "a tiny screen dot" },
    { w: "NINJA", h: "a stealthy fighter" },
    { w: "COMET", h: "in space" },
    { w: "MAPLE", h: "a tree" },
    { w: "VENOM", h: "from a snake" },
    { w: "LASER", h: "a beam of light" },
  ],
  6: [
    { w: "PLANET", h: "in space" },
    { w: "DRAGON", h: "a mythical beast" },
    { w: "GUITAR", h: "instrument" },
    { w: "JUNGLE", h: "a dense forest" },
    { w: "ROCKET", h: "it flies to space" },
    { w: "CASTLE", h: "royalty lives here" },
    { w: "WIZARD", h: "casts spells" },
    { w: "FALCON", h: "a bird" },
    { w: "SILVER", h: "a metal" },
    { w: "PYTHON", h: "a snake" },
    { w: "GARLIC", h: "in the kitchen" },
    { w: "MARBLE", h: "a stone or a toy" },
    { w: "TEMPLE", h: "a place of worship" },
    { w: "ZOMBIE", h: "the undead" },
  ],
  7: [
    { w: "DIAMOND", h: "a gem" },
    { w: "GRAVITY", h: "it pulls you down" },
    { w: "PENGUIN", h: "animal" },
    { w: "VOLCANO", h: "it erupts" },
    { w: "CAPTAIN", h: "leads a ship" },
    { w: "MONSTER", h: "a scary creature" },
    { w: "CRYSTAL", h: "a shiny mineral" },
    { w: "THUNDER", h: "weather" },
    { w: "JOURNEY", h: "a long trip" },
    { w: "MYSTERY", h: "a puzzle to solve" },
    { w: "OCTOPUS", h: "a sea animal" },
    { w: "DOLPHIN", h: "a sea animal" },
    { w: "LEOPARD", h: "animal" },
    { w: "TORNADO", h: "weather" },
  ],
  8: [
    { w: "DINOSAUR", h: "an extinct beast" },
    { w: "ELEPHANT", h: "animal" },
    { w: "MOUNTAIN", h: "you climb it" },
    { w: "SANDWICH", h: "food" },
    { w: "COMPUTER", h: "a machine" },
    { w: "AIRPLANE", h: "it flies" },
    { w: "HOSPITAL", h: "you go when sick" },
    { w: "UMBRELLA", h: "for the rain" },
    { w: "TREASURE", h: "pirates seek it" },
    { w: "NOTEBOOK", h: "you write in it" },
    { w: "STARFISH", h: "a sea animal" },
    { w: "PASSWORD", h: "keep it secret" },
    { w: "KANGAROO", h: "animal" },
    { w: "PANCAKES", h: "food" },
  ],
};
