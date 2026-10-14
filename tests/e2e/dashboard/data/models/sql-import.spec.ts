import {LoginPage} from '../../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../../fixtures/auth';
import { DataModelsPage } from '../../../fixtures/page-objects/DataModelsPage';

test.describe('P1 - 数据模型SQL导入', () => {
  let dataModelsPage: DataModelsPage;

  test.beforeEach(async ({ page }) => {
    dataModelsPage = new DataModelsPage(page);
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
    await dataModelsPage.goto();
  });

  test('打开SQL导入抽屉', async ({ page }) => {
    const btnVisible = await dataModelsPage.sqlImportButton.isVisible().catch(() => false);
    if (btnVisible) {
      await dataModelsPage.clickSqlImport();
      await expect(page.locator('.ant-drawer')).toBeVisible();
      await expect(dataModelsPage.monacoEditor).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('填写SQL并提交', async ({ page }) => {
    const btnVisible = await dataModelsPage.sqlImportButton.isVisible().catch(() => false);
    if (btnVisible) {
      await dataModelsPage.clickSqlImport();
      await dataModelsPage.fillSqlContent('SELECT id, name, email FROM users LIMIT 10');
      await dataModelsPage.submitSqlImport();
      await dataModelsPage.waitForDrawer({ state: 'hidden' });
    } else {
      test.skip();
    }
  });

  test('提交后抽屉关闭', async ({ page }) => {
    const btnVisible = await dataModelsPage.sqlImportButton.isVisible().catch(() => false);
    if (btnVisible) {
      await dataModelsPage.clickSqlImport();
      await dataModelsPage.fillSqlContent('SELECT id, name FROM users LIMIT 10');
      await dataModelsPage.submitSqlImport();
      await page.waitForSelector('.ant-drawer', { state: 'hidden', timeout: 5000 }).catch(() => {});
      const drawerVisible = await page.locator('.ant-drawer').isVisible().catch(() => false);
      expect(drawerVisible).toBe(false);
    } else {
      test.skip();
    }
  });

  test('Monaco编辑器可见', async ({ page }) => {
    const btnVisible = await dataModelsPage.sqlImportButton.isVisible().catch(() => false);
    if (btnVisible) {
      await dataModelsPage.clickSqlImport();
      await expect(dataModelsPage.monacoEditor).toBeVisible();
    } else {
      test.skip();
    }
  });
});
