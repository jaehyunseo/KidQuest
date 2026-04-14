/**
 * Extended smoke test — verifies things that can be checked WITHOUT
 * authenticating with Firebase. Covers:
 *   1. Login page renders, no console errors, key copy present
 *   2. Code-split chunks are actually built and named correctly
 *   3. Lazy chunks lazy-load only on demand (chunk not in initial HTML)
 *   4. Consent modal UI is reachable (if mounted on login)
 *   5. All pages return valid HTML
 */
import { chromium } from 'playwright';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const URL = process.env.SMOKE_URL || 'http://127.0.0.1:5200/';
const results = [];
const errors = [];

function pass(name, detail = '') {
  results.push({ name, status: 'PASS', detail });
  console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, status: 'FAIL', detail });
  errors.push(`${name}: ${detail}`);
  console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
}

console.log('\n=== KidQuest Extended Smoke Test ===\n');

// ============================================================
// 1. Build chunks check — make sure code splitting landed
// ============================================================
console.log('[1] Build output / code splitting');
try {
  const distAssets = join(process.cwd(), 'dist', 'assets');
  const files = readdirSync(distAssets);
  const hasParentChunk   = files.some((f) => f.startsWith('ParentDashboard-') && f.endsWith('.js'));
  const hasFeedChunk     = files.some((f) => f.startsWith('FeedView-') && f.endsWith('.js'));
  const hasCalendarChunk = files.some((f) => f.startsWith('CalendarView-') && f.endsWith('.js'));
  hasParentChunk   ? pass('ParentDashboard chunk split')   : fail('ParentDashboard chunk split', 'not found in dist/assets');
  hasFeedChunk     ? pass('FeedView chunk split')          : fail('FeedView chunk split', 'not found in dist/assets');
  hasCalendarChunk ? pass('CalendarView chunk split')      : fail('CalendarView chunk split', 'not found in dist/assets');

  // Main bundle size guard — should be under 1.5MB raw (we're at ~1MB)
  const mainFile = files.find((f) => f.startsWith('index-') && f.endsWith('.js'));
  if (mainFile) {
    const stat = statSync(join(distAssets, mainFile));
    const kb = Math.round(stat.size / 1024);
    if (stat.size < 1_500_000) pass('Main bundle under 1.5MB', `${kb}KB`);
    else fail('Main bundle under 1.5MB', `${kb}KB — grew too much`);
  } else {
    fail('Main bundle present', 'dist/assets/index-*.js missing — run vite build first');
  }
} catch (e) {
  fail('dist/assets readable', e.message);
}

// ============================================================
// 2. Browser tests
// ============================================================
console.log('\n[2] Browser — login page');
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'ko-KR' });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`);
});

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 20000 });
  pass('page loads');
} catch (e) {
  fail('page loads', e.message);
}

await page.waitForTimeout(1500);

const body = await page.evaluate(() => document.body.innerText).catch(() => '');
/^.*아이퀘스트.*$/m.test(body) || /KidQuest/.test(body) ? pass('brand copy visible') : fail('brand copy visible', 'no 아이퀘스트/KidQuest in body');
/Google 계정으로 계속하기/.test(body) ? pass('login CTA present') : fail('login CTA present', 'missing Google CTA');
/약속|습관|성장|가족/.test(body) ? pass('identity copy (약속/습관/성장/가족)') : fail('identity copy', 'missing');

consoleErrors.length === 0 ? pass('no console errors') : fail('no console errors', `${consoleErrors.length} error(s): ${consoleErrors.slice(0,3).join(' | ')}`);

// ============================================================
// 3. Check that the terms/privacy link exists (consent affordance)
// ============================================================
console.log('\n[3] Consent surface');
const hasTerms   = /개인정보|이용약관|PRIVACY|TERMS/.test(body);
hasTerms ? pass('terms/privacy copy reachable from login') : fail('terms/privacy copy', 'not visible on login');

// ============================================================
// 4. Verify key chunks are NOT eagerly loaded (code split proof)
// ============================================================
console.log('\n[4] Code splitting runtime');
const network = [];
page.on('request', (r) => network.push(r.url()));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const requestedAll = network.join('\n');
// In dev mode (vite), chunks are served as individual modules — we verify
// that ParentDashboard module path has NOT been eagerly requested before
// clicking a login.
// Note: vite dev uses on-demand ES module loading, so any module imported
// statically is requested, any React.lazy module is not.
const eagerLoadedParent = /\/features\/parent\/ParentDashboard/.test(requestedAll);
const eagerLoadedFeed   = /\/features\/feed\/FeedView/.test(requestedAll);
!eagerLoadedParent ? pass('ParentDashboard NOT eagerly fetched') : fail('ParentDashboard NOT eager', 'module was requested before login');
!eagerLoadedFeed   ? pass('FeedView NOT eagerly fetched')        : fail('FeedView NOT eager', 'module was requested before login');

// ============================================================
// 5. Dev server serves valid HTML for root
// ============================================================
console.log('\n[5] HTTP sanity');
const res = await fetch(URL).catch(() => null);
if (res && res.ok) {
  const html = await res.text();
  html.includes('<div id="root"') || html.includes('<div id="root">')
    ? pass('root div in HTML')
    : fail('root div in HTML', 'missing');
  html.includes('</html>') ? pass('valid HTML closes') : fail('valid HTML closes', 'truncated');
} else {
  fail('GET /', `${res?.status ?? 'no response'}`);
}

// ============================================================
// Summary
// ============================================================
await browser.close();
const passed = results.filter((r) => r.status === 'PASS').length;
const failed = results.filter((r) => r.status === 'FAIL').length;
console.log('\n=== Summary ===');
console.log(`${passed}/${results.length} passed, ${failed} failed`);
if (errors.length) {
  console.log('\nFailures:');
  errors.forEach((e) => console.log('  - ' + e));
}
process.exit(failed > 0 ? 1 : 0);
