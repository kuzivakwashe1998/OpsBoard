import { clsx, type ClassValue } from 'clsx'

export const cn = (...inputs: ClassValue[]): string => clsx(inputs)

/** Tiny subsequence-based fuzzy score for the command palette. Higher = better. */
export function fuzzyScore(text: string, query: string): number {
  if (!query) return 1
  const t = text.toLowerCase()
  const q = query.toLowerCase().replace(/\s+/g, '')
  if (!q) return 1
  const direct = t.indexOf(q)
  if (direct === 0) return 1000 - t.length
  if (direct > 0) return 700 - direct - t.length / 100
  // subsequence match
  let ti = 0
  let gaps = 0
  for (const ch of q) {
    const found = t.indexOf(ch, ti)
    if (found < 0) return -1
    if (found > ti) gaps += 1
    ti = found + 1
  }
  return 300 - gaps * 10 - t.length / 50
}
