/**
 * Deterministic seeded pseudo-random utilities.
 * Everything the simulation generates flows through these, so the whole
 * dataset is reproducible for a given seed.
 */

export type Rng = () => number

/** Fast, well-distributed 32-bit PRNG. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const randBetween = (rng: Rng, min: number, max: number): number => min + rng() * (max - min)

export const randInt = (rng: Rng, min: number, max: number): number =>
  Math.floor(randBetween(rng, min, max + 1))

export function randPick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

/** Box–Muller gaussian. */
export function randGauss(rng: Rng, mean = 0, sd = 1): number {
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** Lognormal multiplier centred on 1 — good for revenue-like noise. */
export function randLognormal(rng: Rng, sigma: number): number {
  return Math.exp(randGauss(rng, (-sigma * sigma) / 2, sigma))
}

export function weightedPick<T>(rng: Rng, items: readonly T[], weights: readonly number[]): T {
  let total = 0
  for (const w of weights) total += w
  let r = rng() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

export function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v))
