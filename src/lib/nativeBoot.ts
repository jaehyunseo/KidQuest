// Capacitor native bootstrap. Imported once from main.tsx and runs
// only when actually inside the Android shell — on the web build
// these calls are cheap no-ops because the dynamic imports resolve
// to the JS shims that just return when no native runtime exists.

import { isNativeApp, nativePlatform } from './platform';

export async function bootNative() {
  if (!isNativeApp()) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Default });
    if (nativePlatform() === 'android') {
      // Match the yellow theme color so the bar blends in.
      await StatusBar.setBackgroundColor({ color: '#facc15' });
      await StatusBar.setOverlaysWebView({ overlay: false });
    }
  } catch (err) {
    console.warn('[native] StatusBar setup failed:', err);
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    // Hide as soon as React has mounted — capacitor.config.ts sets
    // launchAutoHide:true so this is just a safety net for cold
    // starts where React mounts before the auto-hide timer fires.
    setTimeout(() => SplashScreen.hide().catch(() => {}), 100);
  } catch (err) {
    console.warn('[native] SplashScreen hide failed:', err);
  }

  try {
    const { App } = await import('@capacitor/app');
    // Wire Android hardware back button to browser history. Without
    // this, pressing Back closes the app even when the user is
    // mid-navigation inside React Router-less single-screen flow.
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
  } catch (err) {
    console.warn('[native] App listener setup failed:', err);
  }
}
