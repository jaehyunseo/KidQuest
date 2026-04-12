import { test, expect } from '@playwright/test';

test('login button click', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Wait for the login button to be visible
  const loginButton = page.locator('button:has-text("Google로 시작하기")');
  await expect(loginButton).toBeVisible();

  // Click the login button
  await loginButton.click();

  // Wait to see if an alert or error appears
  // Since it's a popup, we might need to handle the popup
  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 5000 }).catch(() => null),
  ]);

  if (popup) {
    console.log('Popup opened successfully');
    await popup.close();
  } else {
    console.log('Popup did not open');
    // Check for alert
    const alertText = await page.locator('text=로그인 실패').isVisible();
    if (alertText) {
      console.log('Login failed alert shown');
    }
  }
});
