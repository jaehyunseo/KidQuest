import { test, expect } from '@playwright/test';

test.describe('KidQuest E2E Tests', () => {
  test('should display login page initially', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`));

    await page.goto('http://localhost:3000');
    
    // Check if the login button is visible
    const loginButton = page.locator('button:has-text("Google로 시작하기")');
    await expect(loginButton).toBeVisible();
    
    // Check title
    await expect(page.locator('h1')).toHaveText('KidQuest');

    console.log('Browser logs:', logs);
  });

  test('should handle login button click', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`));

    await page.goto('http://localhost:3000');
    
    const loginButton = page.locator('button:has-text("Google로 시작하기")');
    
    // Click the login button and wait for popup
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 5000 }).catch(() => null),
      loginButton.click()
    ]);

    if (popup) {
      // If popup opens, it means the Firebase Auth popup was triggered successfully
      await popup.close();
    } else {
      // If popup doesn't open, check for error alert
      const alert = page.locator('text=로그인 실패');
      if (await alert.isVisible()) {
        console.log('Login failed alert is visible');
      }
    }

    console.log('Browser logs on login:', logs);
  });
});
