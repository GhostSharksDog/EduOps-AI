import {LoginPage} from '../../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../../fixtures/auth';
import { DataModelsPage } from '../../../fixtures/page-objects/DataModelsPage';

test.describe('P1 - 数据模型详情', () => {
  let dataModelsPage: DataModelsPage;

  test.beforeEach(async ({ page }) => {
    dataModelsPage = new DataModelsPage(page);
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
    await dataModelsPage.goto();
  });

  test('打开详情抽屉', async ({ page }) => {
    await dataModelsPage.waitForTableLoad();
    const rowCount = await dataModelsPage.getRowCount();
    if (rowCount > 0) {
      const firstRow = dataModelsPage.getFirstRow();
      const rowText = await firstRow.textContent();
      if (rowText) {
        await dataModelsPage.clickViewDetailInRow(rowText);
        await expect(page.locator('.ant-drawer')).toBeVisible();
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('显示基本信息', async ({ page }) => {
    await dataModelsPage.waitForTableLoad();
    const rowCount = await dataModelsPage.getRowCount();
    if (rowCount > 0) {
      const firstRow = dataModelsPage.getFirstRow();
      const rowText = await firstRow.textContent();
      if (rowText) {
        await dataModelsPage.clickViewDetailInRow(rowText);
        await dataModelsPage.waitForDetailDrawer();
        const drawerContent = page.locator('.ant-drawer');
        await expect(drawerContent).toBeVisible();
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('关闭详情抽屉', async ({ page }) => {
    await dataModelsPage.waitForTableLoad();
    const rowCount = await dataModelsPage.getRowCount();
    if (rowCount > 0) {
      const firstRow = dataModelsPage.getFirstRow();
      const rowText = await firstRow.textContent();
      if (rowText) {
        await dataModelsPage.clickViewDetailInRow(rowText);
        await dataModelsPage.waitForDetailDrawer();
        await dataModelsPage.closeDetailDrawer();
        const drawerHidden = !(await page.locator('.ant-drawer').isVisible().catch(() => false));
        expect(drawerHidden).toBe(true);
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });
});
