import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Emulator wiring — opt-in via `VITE_USE_EMULATOR=1` in .env.local so
// local dev + CI can run against the Firebase Emulator Suite without
// touching the real project. Connection is idempotent (guards via
// globalThis flag) in case Vite HMR reloads this module.
const __viteEnv: any = (import.meta as any).env ?? {};
if (__viteEnv.VITE_USE_EMULATOR === '1' || __viteEnv.VITE_USE_EMULATOR === 'true') {
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
