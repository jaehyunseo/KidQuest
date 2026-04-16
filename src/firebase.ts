import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// App Check — gates all Firebase backend traffic (Firestore, Storage,
// callable functions) behind a reCAPTCHA v3 token. Blocks requests
// from clients that aren't running the official web app, which is the
// main mitigation for Storage's looser per-path rules. Configured via
// VITE_APPCHECK_SITE_KEY in `.env.local` / deployment env.
//
// Setup checklist:
//   1. Firebase Console → App Check → Register web app with
//      reCAPTCHA v3 and copy the site key.
//   2. Add VITE_APPCHECK_SITE_KEY=... to .env.local (dev) and to the
//      hosting deployment env (prod).
//   3. Enforce App Check for Firestore + Storage in Firebase Console.
//
// We initialize early, before getAuth/getFirestore are called, so the
// very first request carries a token. Emulator mode skips App Check
// because local emulators don't enforce it.
const __viteEnv: any = (import.meta as any).env ?? {};
const __inEmulator =
  __viteEnv.VITE_USE_EMULATOR === '1' || __viteEnv.VITE_USE_EMULATOR === 'true';
const __appCheckKey: string | undefined = __viteEnv.VITE_APPCHECK_SITE_KEY;
if (!__inEmulator && __appCheckKey && typeof window !== 'undefined') {
  try {
    // Allow an auto-generated debug token on localhost (for dev)
    // without breaking production: the SDK reads
    // `self.FIREBASE_APPCHECK_DEBUG_TOKEN` BEFORE initializeAppCheck.
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(__appCheckKey),
      isTokenAutoRefreshEnabled: true,
    });
    // eslint-disable-next-line no-console
    console.info('[firebase] App Check initialized (reCAPTCHA v3)');
  } catch (err) {
    console.warn('[firebase] App Check init failed:', err);
  }
} else if (!__inEmulator && !__appCheckKey && typeof window !== 'undefined') {
  console.warn(
    '[firebase] App Check NOT initialized — set VITE_APPCHECK_SITE_KEY in env to enforce',
  );
}

export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Emulator wiring — opt-in via `VITE_USE_EMULATOR=1` in .env.local so
// local dev + CI can run against the Firebase Emulator Suite without
// touching the real project. Connection is idempotent (guards via
// globalThis flag) in case Vite HMR reloads this module.
if (__inEmulator) {
  const flag = '__kidquest_emulator_connected__';
  if (!(globalThis as any)[flag]) {
    try {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
      connectStorageEmulator(storage, '127.0.0.1', 9199);
      (globalThis as any)[flag] = true;
      // eslint-disable-next-line no-console
      console.info('[firebase] connected to local emulators (auth:9099, firestore:8080, storage:9199)');
    } catch (err) {
      console.warn('[firebase] failed to connect emulators:', err);
    }
  }
}
