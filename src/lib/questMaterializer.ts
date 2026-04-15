/**
 * Quest group bonus eligibility check.
 *
 * A group pays its bonus once when every member quest for a given day is
 * completed and none has yet claimed the bonus. The check is a pure
 * function over the live Quest list so it can be unit tested.
 */

import type { Quest } from '../types';

export interface GroupBonusEligibility {
  eligible: boolean;
  siblings: Quest[]; // quests that belong to the group on this date
}

export function evaluateGroupBonus(
  groupId: string,
  dateKey: string,
  allQuests: Quest[],
): GroupBonusEligibility {
  // If quests have a scheduledDate we respect it; otherwise we treat the
  // quest as live for today (backward compat with quests that predate the
  // date-scoped system).
  const siblings = allQuests.filter(
    (q) =>
      q.groupId === groupId &&
      (q.scheduledDate ? q.scheduledDate === dateKey : true),
  );
  if (siblings.length === 0) return { eligible: false, siblings };
  const anyClaimed = siblings.some((q) => q.groupBonusClaimed === true);
  if (anyClaimed) return { eligible: false, siblings };
  const allDone = siblings.every((q) => q.completed === true);
  return { eligible: allDone, siblings };
}
