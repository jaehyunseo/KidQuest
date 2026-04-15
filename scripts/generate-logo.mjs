/**
 * Generate KidQuest app logo PNGs from inline SVG using Playwright.
 *
 * Produces:
 *   public/icon-120.png    (OAuth consent screen)
 *   public/icon-192.png    (PWA / apple-touch-icon)
 *   public/icon-512.png    (PWA splash / large)
 *   public/icon-1024.png   (master, for future use)
 *
 * Usage: node scripts/generate-logo.mjs
 */
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'public');
mkdirSync(outDir, { recursive: true });

// Master SVG — 512 viewBox, renders at any size. Rounded square with
// the brand yellow→orange gradient, a white trophy silhouette, and a
// small "Q" badge. Matches the app's theme_color (#facc15).
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDE047"/>
      <stop offset="50%" stop-color="#FACC15"/>
      <stop offset="100%" stop-color="#F97316"/>
    </linearGradient>
    <linearGradient id="trophy" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#FFF7D1"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="8"/>
    </filter>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#7C2D12" flood-opacity="0.25"/>
    </filter>
  </defs>

  <!-- Rounded square background -->
  <rect x="0" y="0" width="512" height="512" rx="112" ry="112" fill="url(#bg)"/>

  <!-- Soft highlight on top -->
  <ellipse cx="256" cy="80" rx="260" ry="60" fill="#FFFFFF" opacity="0.18"/>

  <!-- Glow behind trophy -->
  <circle cx="256" cy="260" r="150" fill="#FFFFFF" opacity="0.15" filter="url(#glow)"/>

  <!-- Trophy icon (hand-tuned path, roughly following lucide's Trophy) -->
  <g filter="url(#shadow)">
    <!-- Left handle -->
    <path d="M 150 150 Q 90 150 90 210 Q 90 260 150 280"
          fill="none" stroke="url(#trophy)" stroke-width="26" stroke-linecap="round"/>
    <!-- Right handle -->
    <path d="M 362 150 Q 422 150 422 210 Q 422 260 362 280"
          fill="none" stroke="url(#trophy)" stroke-width="26" stroke-linecap="round"/>
    <!-- Cup body -->
    <path d="M 150 120
             L 362 120
             L 362 230
             Q 362 330 256 340
             Q 150 330 150 230 Z"
          fill="url(#trophy)"/>
    <!-- Stem -->
    <rect x="226" y="340" width="60" height="32" rx="6" fill="url(#trophy)"/>
    <!-- Base -->
    <rect x="170" y="372" width="172" height="28" rx="14" fill="url(#trophy)"/>
    <rect x="150" y="400" width="212" height="22" rx="11" fill="url(#trophy)"/>
  </g>

  <!-- Star on the trophy -->
  <g transform="translate(256 225)" filter="url(#shadow)">
    <path d="M 0 -44
             L 13 -14
             L 46 -14
             L 19 6
             L 29 38
             L 0 18
             L -29 38
             L -19 6
             L -46 -14
             L -13 -14 Z"
          fill="#F97316"/>
  </g>
</svg>
`.trim();

const sizes = [120, 192, 512, 1024];

const browser = await chromium.launch();
const context = await browser.newContext({ deviceScaleFactor: 1 });
const page = await context.newPage();

for (const size of sizes) {
  const html = `<!doctype html>
    <html><head><style>
      html,body{margin:0;padding:0;background:transparent;}
      .wrap{width:${size}px;height:${size}px;}
      svg{display:block;width:100%;height:100%;}
    </style></head>
    <body><div class="wrap">${svg}</div></body></html>`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html, { waitUntil: 'load' });
  const el = await page.locator('.wrap').elementHandle();
  const buf = await el.screenshot({ omitBackground: true, type: 'png' });
  const outPath = resolve(outDir, `icon-${size}.png`);
  writeFileSync(outPath, buf);
  console.log(`wrote ${outPath} (${buf.length} bytes)`);
}

await browser.close();
console.log('done');
