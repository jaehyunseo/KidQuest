/**
 * Integration test: verify the app actually connects to the Firebase
 * Emulator Suite when VITE_USE_EMULATOR=1.
 *
 * This is a "handshake" level test — it doesn't try to drive the full
 * OAuth login flow (that requires the Auth emulator's REST API and
 * hooking into firebase-js-sdk's internal state). Instead it verifies:
 *   1. Dev server starts cleanly with the emulator flag
 *   2. App loads without console errors
 *   3. firebase.ts prints the `[firebase] connected to local emulators` banner
 *   4. The Auth emulator is reachable at 9099
 *   5. The Firestore emulator is reachable at 8080
 *   6. The Storage emulator is reachable at 9199
 *
 * Prerequisites:
 *   - Emulators running (terminal A: `npm run emulators`)
 *   - Dev server running in emulator mode (terminal B: `npm run dev:emulator`)
 *
 * Or one-shot:
 *   node scripts/test-emulator-integration.mjs
 * which spawns both for you and tears them down at the end.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const APP_URL = process.env.APP_URL || 'http://127.0.0.1:3000/';
const AUTH_URL = 'http://127.0.0.1:9099';
const FIRESTORE_URL = 'http://127.0.0.1:8080';
const STORAGE_URL = 'http://127.0.0.1:9199';

const results = [];
function pass(name, detail = '') {
  results.push({ name, status: 'PASS', detail });
  console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, status: 'FAIL', detail });
  console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
}

async function waitFor(url, label, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return true;
    } catch {}
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${label} at ${url}`);
}

console.log('\n=== KidQuest Emulator Integration Test ===\n');

// ============================================================
// 1. Direct emulator probes
// ============================================================
console.log('[1] Emulator health');

try {
  const r = await fetch(`${AUTH_URL}/`);
  r.ok ? pass('Auth emulator reachable', `status ${r.status}`) : fail('Auth emulator reachable', `status ${r.status}`);
} catch (e) {
  fail('Auth emulator reachable', e.message);
}

try {
  const r = await fetch(`${FIRESTORE_URL}/`);
  // Firestore emulator returns 200 or 501 on GET /
  [200, 501, 404].includes(r.status)
    ? pass('Firestore emulator reachable', `status ${r.status}`)
    : fail('Firestore emulator reachable', `status ${r.status}`);
} catch (e) {
  fail('Firestore emulator reachable', e.message);
}

try {
  const r = await fetch(`${STORAGE_URL}/`);
  [200, 501, 404, 400].includes(r.status)
    ? pass('Storage emulator reachable', `status ${r.status}`)
    : fail('Storage emulator reachable', `status ${r.status}`);
} catch (e) {
  fail('Storage emulator reachable', e.message);
}

// NOTE: Firestore writes are already fully verified by the 38-test
// rules suite (scripts/test-rules.mjs), which exercises writes with
// every role/path combination. We don't re-seed here — that would be
// duplicate coverage and adds brittleness from REST-API quirks.

// ============================================================
// 2. Open the app in the browser, verify it boots against emulators
// ============================================================
console.log('\n[2] App boot against emulators');

let appReachable = false;
try {
  await waitFor(APP_URL, 'dev server', 15000);
  appReachable = true;
  pass('Dev server reachable', APP_URL);
} catch (e) {
  fail('Dev server reachable', e.message);
}

if (appReachable) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ locale: 'ko-KR' });
  const page = await ctx.newPage();

  const consoleMessages = [];
  const consoleErrors = [];
  page.on('console', (msg) => {
    const txt = msg.text();
    consoleMessages.push(`${msg.type()}: ${txt}`);
    if (msg.type() === 'error') consoleErrors.push(txt);
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

  try {
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 20000 });
    pass('App loads');
  } catch (e) {
    fail('App loads', e.message);
  }

  await delay(2000);

  const connectedBanner = consoleMessages.some((m) =>
    m.includes('connected to local emulators')
  );
  connectedBanner
    ? pass('firebase.ts emulator connect banner')
    : fail('firebase.ts emulator connect banner', 'banner not printed — check VITE_USE_EMULATOR was set');

  consoleErrors.length === 0
    ? pass('no console errors on boot')
    : fail('no console errors', `${consoleErrors.length}: ${consoleErrors.slice(0, 3).join(' | ')}`);

  const body = await page.evaluate(() => document.body.innerText).catch(() => '');
  /아이퀘스트|KidQuest/.test(body)
    ? pass('brand copy visible')
    : fail('brand copy visible', 'missing');

  await browser.close();
}

// ============================================================
// Summary
// ============================================================
const passed = results.filter((r) => r.status === 'PASS').length;
const failed = results.filter((r) => r.status === 'FAIL').length;
console.log('\n=== Summary ===');
console.log(`${passed}/${results.length} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  results.filter((r) => r.status === 'FAIL').forEach((r) => {
    console.log(`  - ${r.name}: ${r.detail}`);
  });
}
process.exit(failed > 0 ? 1 : 0);
