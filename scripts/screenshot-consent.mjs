import { chromium } from 'playwright';

const URL = 'http://localhost:5174/';
const OUT = 'scripts/consent-modal.png';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  locale: 'ko-KR',
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(800);

// Click Google login button
await page.getByRole('button', { name: /Google 계정으로 계속하기/ }).click();
await page.waitForTimeout(600);

// Expand the privacy section (first item) only
const privacyRow = page.locator('div:has-text("개인정보 수집 및 이용 동의")').first();
const chevron = privacyRow.locator('button:has(svg.lucide-chevron-down)').first();
await chevron.click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(600);

// Scroll modal content to top
await page.evaluate(() => {
  const scrollable = document.querySelector('.overflow-y-auto');
  if (scrollable) scrollable.scrollTop = 0;
});
await page.waitForTimeout(200);

await page.screenshot({ path: OUT, fullPage: true });
console.log('privacy screenshot saved:', OUT);

// Also capture the terms section
await page.locator('button:has(svg.lucide-chevron-down)').nth(1).click().catch(() => {});
await page.waitForTimeout(400);
await page.screenshot({ path: 'scripts/consent-modal-terms.png', fullPage: true });
console.log('terms screenshot saved');

await browser.close();
