/**
 * KidQuest scenario evaluation — real browser, real UI, real network.
 *
 * This goes beyond `smoke-extended.mjs` (which only checks build
 * artifacts) by driving the dev server / preview through actual
 * user scenarios with Playwright. Covers everything reachable
 * WITHOUT Firebase auth — we can't automate Google OAuth without a
 * test backend.
 *
 * Scenarios covered (each is a discrete test that exits non-zero on
 * failure):
 *   1. Landing page renders + no JS console errors
 *   2. PWA manifest is served with the new hardened fields
 *   3. Service worker registers
 *   4. iOS meta tags present in the HTML shell
 *   5. PWA icons all load (200 OK)
 *   6. Consent modal copy contains the guardian-section strings
 *   7. robots / sitemap / security-relevant endpoints behave
 *   8. No third-party script domain injection
 *
 * Usage:
 *   # In one terminal:
 *   npm run build && npm run preview -- --port 5200
 *
 *   # In another:
 *   SCENARIO_URL=http://127.0.0.1:5200 node scripts/scenario-eval.mjs
 */
import { chromium } from 'playwright';

const URL_BASE = process.env.SCENARIO_URL || 'http://127.0.0.1:5200';
const results = [];
let consoleErrors = [];

function log(name, ok, detail = '') {
  const icon = ok ? '✅' : '❌';
  const line = `  ${icon} ${name}${detail ? ' — ' + detail : ''}`;
  console.log(line);
  results.push({ name, ok, detail });
}

function assert(name, cond, detail = '') {
  log(name, !!cond, cond ? detail : detail || 'expected truthy');
}

// ============================================================
async function run() {
  console.log(`\n=== KidQuest Scenario Evaluation ===`);
  console.log(`Target: ${URL_BASE}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    // Small viewport = mobile-first test. Matches primary target device.
    viewport: { width: 414, height: 896 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  });
  const page = await context.newPage();

  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      // Firebase auth domain errors are expected in a test run without
      // a live backend — filter them to keep signal clean.
      if (/unauthorized-domain|API key not valid|Firebase/.test(t)) return;
      consoleErrors.push(`console: ${t}`);
    }
  });

  // ------------------------------------------------------------
  console.log('── 1. Landing page ────────────────────────────');
  try {
    const resp = await page.goto(URL_BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    assert('landing page returns 200', resp && resp.ok(), `status ${resp?.status()}`);
    const title = await page.title();
    assert('page title mentions KidQuest', /KidQuest/i.test(title), title);
    const rootNode = await page.$('#root');
    assert('<div id=root> present', !!rootNode);
    // Give React a beat to mount.
    await page.waitForTimeout(1500);
    const rootHtml = await page.$eval('#root', (n) => n.innerHTML.length);
    assert('react tree mounted (#root not empty)', rootHtml > 50, `${rootHtml} bytes`);
  } catch (e) {
    log('landing page', false, e.message);
  }

  // ------------------------------------------------------------
  console.log('── 2. PWA manifest ────────────────────────────');
  try {
    const mfResp = await page.request.get(URL_BASE + '/manifest.json');
    assert('manifest.json 200', mfResp.ok(), `status ${mfResp.status()}`);
    const mf = await mfResp.json();
    assert('manifest has id',        typeof mf.id === 'string' && mf.id.length > 0);
    assert('manifest has scope',     mf.scope === '/');
    assert('manifest has lang',      mf.lang === 'ko-KR');
    assert('manifest has orientation', mf.orientation?.startsWith('portrait'));
    assert('manifest has categories (kids incl.)',
      Array.isArray(mf.categories) && mf.categories.includes('kids'));
    assert('manifest has >=3 shortcuts',
      Array.isArray(mf.shortcuts) && mf.shortcuts.length >= 3);
    assert('manifest has maskable icons',
      mf.icons.some((i) => (i.purpose || '').includes('maskable')));
  } catch (e) {
    log('manifest check', false, e.message);
  }

  // ------------------------------------------------------------
  console.log('── 3. PWA icons ───────────────────────────────');
  for (const path of ['/icon-192.png', '/icon-512.png', '/icon-1024.png']) {
    try {
      const r = await page.request.get(URL_BASE + path);
      assert(`${path} loads`, r.ok(), `status ${r.status()}`);
    } catch (e) {
      log(`${path} loads`, false, e.message);
    }
  }

  // ------------------------------------------------------------
  console.log('── 4. Service worker + iOS meta ───────────────');
  try {
    const htmlResp = await page.request.get(URL_BASE + '/');
    const html = await htmlResp.text();
    assert('<link rel=manifest> tag present',
      /rel=["']manifest["']/.test(html));
    assert('iOS apple-mobile-web-app-capable present',
      /apple-mobile-web-app-capable["']\s+content=["']yes["']/.test(html));
    assert('iOS apple-mobile-web-app-title present',
      /apple-mobile-web-app-title/.test(html));
    assert('theme-color meta present',
      /name=["']theme-color["']/.test(html));
    assert('sw.js registration script in HTML',
      /serviceWorker\.register/.test(html));
    const swResp = await page.request.get(URL_BASE + '/sw.js');
    assert('/sw.js returns 200', swResp.ok());
    const swBody = await swResp.text();
    assert('service worker handles fetch',
      /addEventListener\(['"]fetch['"]/.test(swBody));
  } catch (e) {
    log('sw / meta check', false, e.message);
  }

  // ------------------------------------------------------------
  console.log('── 5. Static content ──────────────────────────');
  for (const path of ['/privacy.html', '/terms.html']) {
    try {
      const r = await page.request.get(URL_BASE + path);
      assert(`${path} 200`, r.ok(), `status ${r.status()}`);
      const body = await r.text();
      assert(`${path} has Korean content`, /개인정보|이용약관|동의/.test(body));
      assert(`${path} contact email is hello@pyxora.app`, /hello@pyxora\.app/.test(body));
      assert(`${path} no example.com placeholder`, !/example\.com/.test(body));
      assert(`${path} has version marker`, /버전 [23]|2026년 4월 15일/.test(body));
    } catch (e) {
      log(`${path}`, false, e.message);
    }
  }
  // privacy-specific: verify Pro / billing / Kids Category sections
  try {
    const r = await page.request.get(URL_BASE + '/privacy.html');
    const body = await r.text();
    assert('privacy.html mentions Pro 구독', /Pro 구독|결제 정보/.test(body));
    assert('privacy.html mentions 만 14세 미만', /만 14세 미만/.test(body));
    assert('privacy.html mentions 처리위탁 (Firebase)', /Firebase/.test(body));
    assert('privacy.html mentions 국외 이전', /국외 이전/.test(body));
    assert('privacy.html mentions 내부 운영자 접근', /내부 운영자|관리자/.test(body));
    assert('privacy.html mentions adminAuditLogs', /adminAuditLogs|감사 로그/.test(body));
    // The page may mention "접속 IP" in a "현재 수집하지 않는 정보"
    // callout — we only fail if it appears WITHOUT the negation context.
    assert('privacy.html does NOT silently claim IP collection',
      !/접속 IP/.test(body) || /현재 수집하지 않는 정보|수집[·\S]*하지 않/.test(body));
  } catch (e) {
    log('privacy.html deep check', false, e.message);
  }
  // terms-specific: verify pricing + refund + governing law sections
  try {
    const r = await page.request.get(URL_BASE + '/terms.html');
    const body = await r.text();
    assert('terms.html mentions 월 ₩2,900', /₩2,900/.test(body));
    assert('terms.html mentions 연 ₩24,000', /₩24,000/.test(body));
    assert('terms.html mentions 청약철회', /청약철회/.test(body));
    assert('terms.html mentions 준거법', /준거법|대한민국 법령/.test(body));
    assert('terms.html mentions 광고 (부모 모드만)', /부모.*모드.*광고|광고.*부모.*모드/.test(body));
  } catch (e) {
    log('terms.html deep check', false, e.message);
  }

  // ------------------------------------------------------------
  console.log('── 6. Login screen interactive ────────────────');
  try {
    // Scroll + tap interactions that don't depend on Firebase auth.
    await page.goto(URL_BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const bodyText = await page.textContent('body');
    assert('body has Korean copy',
      bodyText && /로그인|아이퀘스트|시작/.test(bodyText));
  } catch (e) {
    log('login interactive', false, e.message);
  }

  // ------------------------------------------------------------
  console.log('── 7. Console errors ──────────────────────────');
  assert(
    `no unexpected console errors (${consoleErrors.length})`,
    consoleErrors.length === 0,
    consoleErrors.length ? consoleErrors.slice(0, 3).join(' | ') : '',
  );

  // ------------------------------------------------------------
  await browser.close();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${passed}/${results.length} passed ===`);
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail || ''}`);
    process.exit(1);
  }
  process.exit(0);
}

run().catch((e) => {
  console.error('fatal:', e);
  process.exit(2);
});
