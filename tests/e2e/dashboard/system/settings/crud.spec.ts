import { test, expect } from '@playwright/test';
import { SettingsPage } from '../../../fixtures/page-objects';

test.describe('P1 - 系统设置 CRUD', () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);
    await settingsPage.goto();
  });

  test('显示设置页面', async ({ page }) => {
    await settingsPage.verifyHeading();
    await expect(settingsPage.generalTab).toBeVisible();
    await expect(settingsPage.securityTab).toBeVisible();
    await expect(settingsPage.notificationTab).toBeVisible();
  });

  test('切换到通用 Tab', async ({ page }) => {
    await settingsPage.switchToGeneralTab();
    await expect(page.getByRole('tab', { name: /通用|General/i })).toHaveAttribute('aria-selected', 'true');
  });

  test('切换到安全 Tab', async ({ page }) => {
    await settingsPage.switchToSecurityTab();
    await expect(page.getByRole('tab', { name: /安全|Security/i })).toHaveAttribute('aria-selected', 'true');
  });

  test('切换到通知 Tab', async ({ page }) => {
    await settingsPage.switchToNotificationTab();
    await expect(page.getByRole('tab', { name: /通知|Notification/i })).toHaveAttribute('aria-selected', 'true');
  });

  test('显示保存按钮', async ({ page }) => {
    await expect(settingsPage.saveButton).toBeVisible();
  });

  test('修改设置并保存', async ({ page }) => {
    test.setTimeout(60000);
    
    await settingsPage.switchToGeneralTab();
    
    const formInputs = page.locator('input:not([type="hidden"]), textarea');
    const inputCount = await formInputs.count();
    
    if (inputCount > 0) {
      const firstInput = formInputs.first();
      const inputLabel = await firstInput.getAttribute('aria-label') || await firstInput.getAttribute('name') || 'setting';
      
      await firstInput.fill('E2E测试值_' + Date.now());
      
      await settingsPage.saveSettings();
    } else {
      test.skip();
    }
  });
});
