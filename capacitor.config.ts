import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor configuration for KidQuest Android wrapper.
//
// Important: `appId` is the Android package name and is IMMUTABLE
// once the app is published to Google Play. `app.pyxora.kidquest`
// follows the recommended reverse-DNS convention and matches the
// hosted domain (kidquest.pyxora.app). Don't change after first
// upload to Play Console.
//
// `webDir` points to the Vite production build output. Run
// `npm run build && npx cap sync android` to ship updated web code.
const config: CapacitorConfig = {
  appId: 'app.pyxora.kidquest',
  appName: 'KidQuest',
  webDir: 'dist',
  // Bundled-web mode: Capacitor copies the contents of `dist/` into
  // the Android assets folder and serves them from a local file://
  // origin via WebView. This is the fastest, most reliable mode for
  // Play Store submission and works fully offline once installed.
  // We do NOT use a remote `server.url` because that turns the app
  // into a thin browser shim and Google Play classifies it as a
  // webview wrapper (rejection risk for Kids Category).
  android: {
    // Android prefers a custom WebView host so cookies/storage are
    // properly partitioned from the user's regular browser.
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      // Show the launch image for ~1.5s while the bundle parses.
      // `launchAutoHide: false` lets us hide it programmatically
      // once React has mounted (less white flash).
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#fefce8',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      // Match the yellow theme color on Android status bar.
      style: 'DEFAULT',
      backgroundColor: '#facc15',
      overlaysWebView: false,
    },
  },
};

export default config;
