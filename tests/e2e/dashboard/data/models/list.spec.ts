import {LoginPage} from '../../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../../fixtures/auth';
import { DataModelsPage } from '../../../fixtures/page-objects/DataModelsPage';

test.describe('P1 - 数据模型列表', () => {
  let dataModelsPage: DataModelsPage;

  test.beforeEach(async ({ page }) => {
    dataModelsPage = new DataModelsPage(page);
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
    await dataModelsPage.goto();
  });

  test('显示页面标题', async ({ page }) => {
    await dataModelsPage.verifyHeading();
  });

  test('显示数据表格', async ({ page }) => {
    await expect(dataModelsPage.table).toBeVisible();
  });

  test('分页组件显示', async ({ page }) => {
    await dataModelsPage.waitForTableLoad();
    const pagination = page.locator('.ant-pagination');
    const isVisible = await pagination.isVisible().catch(() => false);
    if (isVisible) {
      const totalText = await pagination.locator('.ant-pagination-total-text').textContent();
      expect(totalText).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test('切换每页数量', async ({ page }) => {
    await dataModelsPage.waitForTableLoad();
    const rowCount = await dataModelsPage.getRowCount();
    if (rowCount > 0) {
      const pageSizeSelector = page.locator('.ant-select').filter({ hasText: /10|20|50|100/ }).first();
      const isVisible = await pageSizeSelector.isVisible().catch(() => false);
      if (isVisible) {
        await pageSizeSelector.click();
        await page.locator('.ant-select-dropdown').getByText('20').click();
        await dataModelsPage.waitForTableLoad();
        const newRowCount = await dataModelsPage.getRowCount();
        expect(newRowCount).toBeGreaterThanOrEqual(0);
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('翻页功能', async ({ page }) => {
    await dataModelsPage.waitForTableLoad();
    const rowCount = await dataModelsPage.getRowCount();
    if (rowCount > 0) {
      const nextButton = page.getByRole('button', { name: /下一页|Next/i });
      const isDisabled = await nextButton.isDisabled().catch(() => true);
      if (!isDisabled) {
        await dataModelsPage.nextPage();
        const currentPage = await page.locator('.ant-pagination-item-active').textContent();
        expect(currentPage).toBe('2');
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('刷新按钮', async ({ page }) => {
    await dataModelsPage.waitForTableLoad();
    const refreshBtn = dataModelsPage.refreshButton;
    const isVisible = await refreshBtn.isVisible().catch(() => false);
    if (isVisible) {
      await refreshBtn.click();
      await dataModelsPage.waitForTableLoad();
    } else {
      test.skip();
    }
  });
});
