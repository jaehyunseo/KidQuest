import { chromium } from 'playwright';

const URL = 'http://localhost:5174/';
const logs = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'ko-KR' });
const page = await ctx.newPage();

page.on('pageerror', (err) => logs.push(`PAGEERROR: ${err.message}`));
page.on('console', (msg) => {
  logs.push(`${msg.type().toUpperCase()}: ${msg.text()}`);
});
page.on('requestfailed', (req) => {
  logs.push(`REQUESTFAILED: ${req.url()} ${req.failure()?.errorText}`);
});

console.log('Step 1: goto');
await page.goto(URL, { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(1500);

console.log('Step 2: check localStorage before click');
const lsBefore = await page.evaluate(() =>
  JSON.stringify(Object.fromEntries(Object.entries(localStorage)))
);
console.log('  localStorage:', lsBefore);

console.log('Step 3: find login button');
const buttons = await page.locator('button').allTextContents();
console.log('  buttons on page:', buttons.filter(Boolean).slice(0, 10));

const loginBtn = page.getByRole('button', { name: /Google 계정으로 계속하기|계속하기/ });
const count = await loginBtn.count();
console.log('  matched login buttons:', count);

if (count > 0) {
  console.log('Step 4: click login button');
  await loginBtn.first().click({ timeout: 5000 }).catch((e) => {
    logs.push(`CLICK ERROR: ${e.message}`);
  });
  await page.waitForTimeout(1500);

  console.log('Step 5: check if consent modal is open');
  const modalText = await page.locator('text=아이퀘스트 이용 동의').count();
  console.log('  "아이퀘스트 이용 동의" count:', modalText);

  const consentVisible = await page.locator('text=개인정보 수집').count();
  console.log('  "개인정보 수집" count:', consentVisible);
}

console.log('\n=== Console logs captured ===');
logs.forEach((l) => console.log(' ', l));

await browser.close();
