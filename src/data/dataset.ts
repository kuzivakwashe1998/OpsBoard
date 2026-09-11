import { generateDataset, SEED } from './generate'
import type { Dataset } from './model'

let cached: Dataset | null = null

/** Lazily generated, memoized singleton. */
export function getDataset(): Dataset {
  if (!cached) cached = generateDataset(SEED)
  return cached
}

/** Test helper: rebuild with a specific seed/today. */
export function buildDataset(seed: number, today: string): Dataset {
  return generateDataset(seed, today)
}
