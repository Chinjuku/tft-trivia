// Deterministic randomness. Never use Math.random in anything that builds questions:
// the same seed must give the same questions on every device (challenge links, Daily).

/** cyrb53: fast 53-bit string hash. */
export function hashString(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

export interface Rng {
  /** float in [0, 1) */
  next(): number
  /** integer in [0, n) */
  int(n: number): number
  pick<T>(arr: readonly T[]): T
  /** returns a shuffled copy */
  shuffle<T>(arr: readonly T[]): T[]
  /** n distinct items (or fewer if arr is shorter) */
  sample<T>(arr: readonly T[], n: number): T[]
}

/** mulberry32 seeded from a string. */
export function createRng(seed: string): Rng {
  let a = hashString(seed) >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (n: number) => Math.floor(next() * n)
  const shuffle = <T>(arr: readonly T[]): T[] => {
    const out = arr.slice()
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(i + 1)
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }
  return {
    next,
    int,
    pick: (arr) => {
      if (arr.length === 0) throw new Error('pick from empty array')
      return arr[int(arr.length)]
    },
    shuffle,
    sample: (arr, n) => shuffle(arr).slice(0, n),
  }
}

/** A fresh random seed for a new game (this is the only place Math.random is allowed). */
export function newSeed(): string {
  return Math.floor(Math.random() * 2 ** 32).toString(36)
}
