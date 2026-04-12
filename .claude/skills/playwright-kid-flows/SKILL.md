---
name: playwright-kid-flows
description: KidQuest Playwright E2E 테스트 패턴. 로그인 → 가족 생성/참가 → 퀘스트 추가/완료 → 보상 교환 시나리오. E2E 테스트 작성/수정 시 사용.
---

# Playwright E2E 가이드

## 설정
- **패키지**: `@playwright/test` (devDependency)
- **포트**: dev 서버는 3000 (`vite --port=3000`)
- **설정 파일**: 없으면 `playwright.config.ts` 생성 필요

## 권장 config 초안
```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,       // Firebase 상태 공유 → 순차 실행
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile',   use: { ...devices['Pixel 5'] } },  // PWA 타겟
  ],
});
```

## Firebase Emulator 권장
실제 Firebase에 E2E 테스트가 쓰면 데이터 오염 + 쿼터 소모 → **Firebase Local Emulator Suite** 사용.
```bash
firebase emulators:start --only auth,firestore
```
테스트 전 [src/firebase.ts](src/firebase.ts)에서 `connectAuthEmulator` / `connectFirestoreEmulator`를 조건부 호출하도록 수정.

## 핵심 시나리오

### 1. 부모 가입 → 가족 생성
```ts
test('parent creates family', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /구글로 로그인/ }).click();
  // Emulator: 테스트용 계정 주입
  await page.getByRole('button', { name: /부모/ }).click();
  await page.getByLabel(/가족 이름/).fill('우리집');
  await page.getByRole('button', { name: /가족 만들기/ }).click();
  await expect(page.getByText(/초대 코드/)).toBeVisible();
});
```

### 2. 자녀 가입 → 초대 코드로 참가
```ts
test('child joins via invite code', async ({ page }) => {
  // 로그인 후
  await page.getByRole('button', { name: /자녀/ }).click();
  await page.getByLabel(/초대 코드/).fill(inviteCode);
  await page.getByRole('button', { name: /참가/ }).click();
  await expect(page.getByText(/우리집/)).toBeVisible();
});
```

### 3. 퀘스트 추가 (부모) → 완료 (자녀)
```ts
test('quest lifecycle', async ({ page }) => {
  // 부모: 퀘스트 추가
  await page.getByRole('button', { name: /퀘스트 추가/ }).click();
  await page.getByLabel(/제목/).fill('수학 숙제');
  await page.getByLabel(/포인트/).fill('20');
  await page.getByRole('button', { name: /저장/ }).click();

  // 자녀 계정으로 전환 (storageState 교체)
  await page.context().storageState({ path: 'child.json' });
  // ... 퀘스트 완료 버튼 클릭
  await page.getByRole('checkbox', { name: /수학 숙제/ }).check();
  await expect(page.getByText(/\+20/)).toBeVisible();
});
```

### 4. 보상 교환
```ts
test('redeem reward', async ({ page }) => {
  await page.getByRole('tab', { name: /상점/ }).click();
  await page.getByRole('button', { name: /교환/ }).first().click();
  await page.getByRole('button', { name: /확인/ }).click();
  await expect(page.getByText(/인벤토리/)).toBeVisible();
});
```

## 셀렉터 원칙
1. **role + name 우선** — `getByRole('button', { name: /.../ })`
2. **한국어 정규식** — `/퀘스트 추가/` (부분 매칭 허용)
3. **data-testid는 최후수단** — 하지만 confetti/애니메이션으로 숨는 요소에는 필수
4. **금지**: CSS 선택자, XPath

## 애니메이션 대응
Framer Motion 전환 중 요소가 잠깐 `opacity: 0` → `toBeVisible()` 대신 `toHaveText()` 사용하거나 `waitForTimeout` 대신 `expect.poll`.

## 다중 사용자 테스트
부모/자녀 동시 시나리오는 `browser.newContext()` 두 개로:
```ts
const parentCtx = await browser.newContext({ storageState: 'parent.json' });
const childCtx  = await browser.newContext({ storageState: 'child.json' });
```

## 체크리스트
- [ ] Emulator 기동
- [ ] `storageState` 프리셋 (parent.json / child.json)
- [ ] 각 테스트 전 Firestore 초기화 (emulator REST API `/emulator/v1/projects/.../databases/.../documents` DELETE)
- [ ] 한국어 locale (`locale: 'ko-KR'`)
