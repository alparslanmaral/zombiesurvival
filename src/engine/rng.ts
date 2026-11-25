/**
 * Deterministic randomness. Every random value is addressed by
 * (seed, round, playerId, tag) — never by a sequential counter — so any client
 * replaying the same inputs computes the same numbers regardless of arrival order.
 */

/** cyrb128: string -> four 32-bit hashes. Public domain. */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** Small fast PRNG seeded with 128 bits. */
function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export interface Rng {
  /** float in [0, 1) */
  next(): number;
  /** integer in [0, n) */
  int(n: number): number;
  /** 1..6 */
  d6(): number;
  pick<T>(arr: readonly T[]): T;
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
  shuffle<T>(arr: readonly T[]): T[];
}

export function makeRng(...parts: (string | number)[]): Rng {
  const [a, b, c, d] = cyrb128(parts.join('␟'));
  const raw = sfc32(a, b, c, d);
  // discard a few outputs to decorrelate similar seeds
  for (let i = 0; i < 12; i++) raw();
  const rng: Rng = {
    next: raw,
    int: (n) => Math.floor(raw() * n),
    d6: () => 1 + Math.floor(raw() * 6),
    pick: (arr) => {
      if (arr.length === 0) throw new Error('pick from empty array');
      return arr[Math.floor(raw() * arr.length)] as (typeof arr)[number];
    },
    weighted: (entries) => {
      const total = entries.reduce((s, [, w]) => s + w, 0);
      let r = raw() * total;
      for (const [v, w] of entries) {
        r -= w;
        if (r < 0) return v;
      }
      const last = entries[entries.length - 1];
      if (!last) throw new Error('weighted pick from empty list');
      return last[0];
    },
    shuffle: (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(raw() * (i + 1));
        const tmp = out[i] as (typeof out)[number];
        out[i] = out[j] as (typeof out)[number];
        out[j] = tmp;
      }
      return out;
    },
  };
  return rng;
}

/** The canonical game RNG address. `tag` names the purpose of the roll (e.g. "enc", "loot:1"). */
export function gameRng(seed: string, round: number, playerId: string, tag: string | number): Rng {
  return makeRng(seed, round, playerId, tag);
}

/** 2d6 for a given address. */
export function roll2d6(seed: string, round: number, playerId: string, tag: string | number): [number, number] {
  const r = gameRng(seed, round, playerId, `dice:${tag}`);
  return [r.d6(), r.d6()];
}

/** Non-cryptographic stable hash of a string, as 8 hex chars. */
export function hashString(str: string): string {
  return cyrb128(str)[0].toString(16).padStart(8, '0');
}
