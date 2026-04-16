import { useEffect, useMemo, useState } from 'react';
import type { UserAccount } from '../types';
import { evaluateProStatus, type ProStatus } from '../lib/proEntitlement';

// Thin React adapter around evaluateProStatus. The only reason this
// needs to be a hook (rather than a pure function call in the
// component) is to refresh the "now" reference periodically so a
// trial/plan can expire mid-session without requiring a reload.
//
// Refresh cadence is intentionally slow (once per minute) — Pro
// status changing is not latency-sensitive and we don't want to
// rerender the whole app every tick.
export function useProEntitlement(
  account: UserAccount | null,
): ProStatus {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return useMemo(
    () => evaluateProStatus(account),
    // `tick` intentionally drives recomputation — ignore the lint hint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [account?.proTier, account?.proExpiresAt, tick],
  );
}
