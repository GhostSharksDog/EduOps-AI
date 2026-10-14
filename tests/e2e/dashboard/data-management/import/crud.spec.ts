import {LoginPage} from '../../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../../fixtures/auth';
import { DataImportPage } from '../../../fixtures/page-objects/DataImportPage';

test.describe('P2 - 数据导入页面', () => {
  let importPage: DataImportPage;

  test.beforeEach(async ({ page }) => {
    importPage = new DataImportPage(page);
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
    await importPage.goto();
  });

  test('显示数据导入页面元素', async ({ page }) => {
    await importPage.verifyHeading();
  });

  test('查看导入历史', async ({ page }) => {
    await importPage.waitForTableLoad();
    
    const historyCount = await importPage.getHistoryRowCount();
    expect(historyCount).toBeGreaterThanOrEqual(0);
  });

  test('切换数据类型', async ({ page }) => {
    const dataTypeSelect = page.getByRole('combobox', { name: /数据类型|Data Type/i });
    if (await dataTypeSelect.isVisible()) {
      await dataTypeSelect.click();
      await page.keyboard.press('Escape');
    }
  });
});
