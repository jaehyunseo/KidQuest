// Tiny runtime helper for "where are we running?" checks. Avoids
// importing @capacitor/core at module-init time on the web build
// (the package is bundled regardless, but the Capacitor object is
// only present when actually running inside a WebView).

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  // Capacitor exposes `Capacitor` on window when running inside the
  // native shell. The `isNativePlatform` helper is the canonical way
  // to detect it; we use a defensive guard so it works even if the
  // SDK hasn't initialized yet.
  const cap = (window as any).Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function') {
    return !!cap.isNativePlatform();
  }
  return false;
}

export function nativePlatform(): 'android' | 'ios' | 'web' {
  if (typeof window === 'undefined') return 'web';
  const cap = (window as any).Capacitor;
  if (cap && typeof cap.getPlatform === 'function') {
    const p = cap.getPlatform();
    if (p === 'android' || p === 'ios') return p;
  }
  return 'web';
}
