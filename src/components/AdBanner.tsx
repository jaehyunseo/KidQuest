import { useEffect, useRef } from 'react';

// AdSense banner wrapper.
//
// Rendering rules:
// 1. Pro users never see ads (`isPro`).
// 2. Ad slot must be configured via env (`VITE_ADSENSE_SLOT_PARENT` etc.) —
//    if missing, we render nothing so preview/dev builds stay clean.
// 3. The AdSense loader script is injected once in `index.html`; we just
//    push the ad unit to the `adsbygoogle` queue on mount.
//
// Policy: this component must NEVER be placed on a child-facing screen.
// Google Families Policy forbids personalized/incentivized ads on
// content made for kids — we use ProUpsellBanner there instead.

interface AdBannerProps {
  isPro: boolean;
  slot: string | undefined;
  // Visual format: 'auto' = responsive; 'horizontal' = skinny banner.
  format?: 'auto' | 'horizontal' | 'rectangle';
  className?: string;
}

const ADSENSE_CLIENT = 'ca-pub-9886893201801989';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdBanner({ isPro, slot, format = 'auto', className }: AdBannerProps) {
  const pushedRef = useRef(false);

  useEffect(() => {
    if (isPro || !slot || pushedRef.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedRef.current = true;
    } catch {
      // Ad blockers or script-not-loaded cases — silently ignore.
    }
  }, [isPro, slot]);

  if (isPro || !slot) return null;

  return (
    <div className={className} aria-label="광고">
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
