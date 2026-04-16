import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { bootNative } from './lib/nativeBoot';

// Fire-and-forget — bootNative is a no-op on the web and only hits
// Capacitor APIs when running inside the Android shell.
void bootNative();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
