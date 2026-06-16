/** Tiny deterministic PRNG so the seed is identical on every load / re-run. */

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

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  float(min: number, max: number, decimals?: number): number;
  pick<T>(arr: readonly T[]): T;
  /** pick `n` distinct items (or fewer if the array is smaller). */
  sample<T>(arr: readonly T[], n: number): T[];
  bool(probabilityTrue?: number): boolean;
  /** weighted pick: choices with relative weights. */
  weighted<T>(choices: readonly [T, number][]): T;
}

export function makeRng(seed: string): Rng {
  const seedFn = xmur3(seed);
  const rand = mulberry32(seedFn());
  const rng: Rng = {
    next: rand,
    int: (min, max) => Math.floor(rand() * (max - min + 1)) + min,
    float: (min, max, decimals = 2) => {
      const v = rand() * (max - min) + min;
      const p = Math.pow(10, decimals);
      return Math.round(v * p) / p;
    },
    pick: (arr) => arr[Math.floor(rand() * arr.length)],
    sample: (arr, n) => {
      const copy = arr.slice();
      const out: typeof copy = [];
      const count = Math.min(n, copy.length);
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(rand() * copy.length);
        out.push(copy.splice(idx, 1)[0]);
      }
      return out;
    },
    bool: (p = 0.5) => rand() < p,
    weighted: (choices) => {
      const total = choices.reduce((s, [, w]) => s + w, 0);
      let r = rand() * total;
      for (const [value, w] of choices) {
        r -= w;
        if (r <= 0) return value;
      }
      return choices[choices.length - 1][0];
    },
  };
  return rng;
}
