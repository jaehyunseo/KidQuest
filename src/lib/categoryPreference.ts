import type { HistoryRecord } from '../types';

/**
 * Computes how many times each category has been completed in the
 * child's history. Used to surface recommended presets in the parent's
 * quest quick-add picker.
 */
export function categoryCompletionCounts(
  history: HistoryRecord[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const h of history) {
    if (h.type === 'reward') continue;
    if ((h.points ?? 0) < 0) continue;
    const cat = h.category || 'other';
    counts[cat] = (counts[cat] ?? 0) + 1;
  }
  return counts;
}

/** Returns the top-N category IDs by completion count, desc. */
export function topCategories(history: HistoryRecord[], n: number = 3): string[] {
  const counts = categoryCompletionCounts(history);
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([id]) => id);
}
