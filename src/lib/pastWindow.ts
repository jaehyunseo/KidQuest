// Pure helper for "retroactive quest completion" date guard.
//
// A quest can be toggled if it has no scheduledDate, or if its
// scheduledDate falls within [today - windowDays, today]. Future-dated
// quests are always rejected.

import { localDateKey } from './achievements';

export type PastWindowDecision =
  | { allowed: true; isPastScheduled: boolean; effectiveTimestamp: string }
  | { allowed: false; reason: 'future' | 'too-old' };

export function evalPastWindow(
  scheduledDate: string | undefined,
  dayKey: string,
  windowDays: number,
  now: Date = new Date(),
): PastWindowDecision {
  if (!scheduledDate) {
    return {
      allowed: true,
      isPastScheduled: false,
      effectiveTimestamp: now.toISOString(),
    };
  }
  if (scheduledDate > dayKey) {
    return { allowed: false, reason: 'future' };
  }
  const minAllowed = localDateKey(
    new Date(now.getTime() - windowDays * 86400000),
  );
  if (scheduledDate < minAllowed) {
    return { allowed: false, reason: 'too-old' };
  }
  const isPastScheduled = scheduledDate < dayKey;
  const effectiveTimestamp = isPastScheduled
    ? new Date(`${scheduledDate}T12:00:00`).toISOString()
    : now.toISOString();
  return { allowed: true, isPastScheduled, effectiveTimestamp };
}
