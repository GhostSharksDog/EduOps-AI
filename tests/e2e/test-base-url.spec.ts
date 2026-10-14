import { test, expect } from '@playwright/test';

test('baseURL test', async ({ page }) => {
  console.log('Navigating to /auth/login');
  await page.goto('/auth/login');
  console.log('Current URL:', page.url());
  await expect(page).toHaveURL(/\/auth\/login/);
});
