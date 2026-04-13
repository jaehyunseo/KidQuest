import { chromium } from 'playwright';

const URL = process.env.SMOKE_URL || 'http://localhost:5174/';
const errors = [];
const warnings = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'ko-KR' });
const page = await ctx.newPage();

page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
page.on('console', (msg) => {
  const type = msg.type();
  const text = msg.text();
  if (type === 'error') errors.push(`console.error: ${text}`);
  else if (type === 'warning') warnings.push(`console.warning: ${text}`);
});
page.on('requestfailed', (req) => {
  errors.push(`requestfailed: ${req.url()} ${req.failure()?.errorText}`);
});

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 20000 });
} catch (e) {
  errors.push(`goto failed: ${e.message}`);
}

// Give React a beat to mount and useAuth to fire
await page.waitForTimeout(2500);

const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
const hasLoginUI = /로그인|Google|KidQuest|아이퀘스트|가족/.test(bodyText);

console.log('=== Errors ===');
errors.forEach((e) => console.log(e));
console.log('=== Warnings (first 10) ===');
warnings.slice(0, 10).forEach((w) => console.log(w));
console.log('=== Rendered text (first 400 chars) ===');
console.log(bodyText.slice(0, 400));
console.log('=== Summary ===');
console.log(`errors=${errors.length} warnings=${warnings.length} hasExpectedText=${hasLoginUI}`);

await browser.close();
process.exit(errors.length > 0 ? 1 : 0);
