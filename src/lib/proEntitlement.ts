// Pure helpers for Pro tier evaluation. Keeping this Firebase-free
// makes it unit-testable and reusable from both React hooks and
// non-React code paths (e.g. service worker logic in the future).

import type { ProTier, UserAccount } from '../types';

export interface ProStatus {
  isPro: boolean;
  tier: ProTier;
  expiresAt: string | null;
  // True while a monthly/yearly plan is active but within the last
  // 7 days of its term — useful for gentle "renew soon" banners.
  renewingSoon: boolean;
  // True when the tier grant was paid (vs promo/trial). Drives
  // messaging: paid users see "plan" labels, trial users see
  // "upgrade" CTAs.
  isPaid: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function evaluateProStatus(
  account: Pick<UserAccount, 'proTier' | 'proExpiresAt'> | null | undefined,
  now: Date = new Date(),
): ProStatus {
  const tier: ProTier = account?.proTier ?? 'free';
  const expiresAtRaw = account?.proExpiresAt ?? null;
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

  // Lifetime never expires.
  if (tier === 'pro_lifetime') {
    return {
      isPro: true,
      tier,
      expiresAt: null,
      renewingSoon: false,
      isPaid: true,
    };
  }

  // Promo codes are honored if their (optional) expiry hasn't passed.
  if (tier === 'promo') {
    const active = !expiresAt || expiresAt.getTime() > now.getTime();
    return {
      isPro: active,
      tier: active ? 'promo' : 'free',
      expiresAt: expiresAt?.toISOString() ?? null,
      renewingSoon: false,
      isPaid: false,
    };
  }

  // Free is always, well, free.
  if (tier === 'free') {
    return {
      isPro: false,
      tier: 'free',
      expiresAt: null,
      renewingSoon: false,
      isPaid: false,
    };
  }

  // Everything else (trial / monthly / yearly) is date-bounded.
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
    // Malformed data — treat as free rather than silently granting Pro.
    return {
      isPro: false,
      tier: 'free',
      expiresAt: null,
      renewingSoon: false,
      isPaid: false,
    };
  }

  const active = expiresAt.getTime() > now.getTime();
  const renewingSoon =
    active && expiresAt.getTime() - now.getTime() < 7 * DAY_MS;
  return {
    isPro: active,
    tier: active ? tier : 'free',
    expiresAt: expiresAt.toISOString(),
    renewingSoon,
    isPaid: tier === 'pro_monthly' || tier === 'pro_yearly',
  };
}

// Which product should we offer THIS user next? Drives the upsell
// modal's primary CTA. Expired-paid users see the same plan they
// had; brand-new users see the yearly plan (the anchor choice).
export function recommendNextPlan(
  account: Pick<UserAccount, 'proTier'> | null | undefined,
): 'pro_yearly' | 'pro_monthly' {
  if (account?.proTier === 'pro_monthly') return 'pro_monthly';
  return 'pro_yearly';
}
