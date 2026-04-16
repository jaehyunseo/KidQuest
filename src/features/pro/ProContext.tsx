import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { UserAccount } from '../../types';
import { useProEntitlement } from '../../hooks/useProEntitlement';
import { ProUpsellModal, type UpsellReason } from './ProUpsellModal';

// Single source of truth for Pro entitlement + a global upsell modal
// so any component can call `openUpsell('second_child')` without
// having to plumb props through the entire tree.

interface ProContextValue {
  isPro: boolean;
  tier: string;
  renewingSoon: boolean;
  openUpsell: (reason: UpsellReason) => void;
  closeUpsell: () => void;
}

const ProContext = createContext<ProContextValue | null>(null);

export function ProProvider({
  account,
  children,
}: {
  account: UserAccount | null;
  children: ReactNode;
}) {
  const status = useProEntitlement(account);
  const [upsell, setUpsell] = useState<{ open: boolean; reason: UpsellReason }>({
    open: false,
    reason: 'generic',
  });

  const openUpsell = useCallback((reason: UpsellReason) => {
    setUpsell({ open: true, reason });
  }, []);

  const closeUpsell = useCallback(() => {
    setUpsell((prev) => ({ ...prev, open: false }));
  }, []);

  const value = useMemo<ProContextValue>(
    () => ({
      isPro: status.isPro,
      tier: status.tier,
      renewingSoon: status.renewingSoon,
      openUpsell,
      closeUpsell,
    }),
    [status.isPro, status.tier, status.renewingSoon, openUpsell, closeUpsell],
  );

  return (
    <ProContext.Provider value={value}>
      {children}
      <ProUpsellModal
        open={upsell.open}
        reason={upsell.reason}
        onClose={closeUpsell}
        onSelectYearly={() => {
          // TODO(phase 3): wire Google Play Billing callable here.
          // For now, redirect to a "coming soon" alert via the host.
          console.info('[pro] yearly CTA clicked');
          closeUpsell();
        }}
        onSelectMonthly={() => {
          console.info('[pro] monthly CTA clicked');
          closeUpsell();
        }}
        onEnterPromoCode={() => {
          console.info('[pro] promo code clicked');
          closeUpsell();
        }}
      />
    </ProContext.Provider>
  );
}

export function usePro(): ProContextValue {
  const ctx = useContext(ProContext);
  if (!ctx) {
    throw new Error('usePro must be used inside <ProProvider>');
  }
  return ctx;
}
