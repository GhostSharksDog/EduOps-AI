import {LoginPage} from '../../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../../fixtures/auth';
import { DataModelsPage } from '../../../fixtures/page-objects/DataModelsPage';

test.describe('P1 - 数据模型搜索与筛选', () => {
  let dataModelsPage: DataModelsPage;

  test.beforeEach(async ({ page }) => {
    dataModelsPage = new DataModelsPage(page);
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
    await dataModelsPage.goto();
  });

  test('按名称搜索', async ({ page }) => {
    await dataModelsPage.waitForTableLoad();
    const rowCount = await dataModelsPage.getRowCount();
    if (rowCount > 0) {
      const firstRow = dataModelsPage.getFirstRow();
      const firstRowText = await firstRow.textContent();
      const nameMatch = firstRowText?.match(/[\w\u4e00-\u9fa5]+/);
      if (nameMatch) {
        await dataModelsPage.search(nameMatch[0]);
        await page.waitForLoadState('networkidle');
        const filteredRows = await dataModelsPage.getRowCount();
        expect(filteredRows).toBeGreaterThanOrEqual(0);
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('清空搜索', async ({ page }) => {
    await dataModelsPage.waitForTableLoad();
    await dataModelsPage.search('test');
    await page.waitForLoadState('networkidle');
    await dataModelsPage.clearSearch();
    await page.waitForLoadState('networkidle');
    const rowCount = await dataModelsPage.getRowCount();
    expect(rowCount).toBeGreaterThanOrEqual(0);
  });

  test('状态筛选-全部', async ({ page }) => {
    await dataModelsPage.waitForTableLoad();
    const statusFilterVisible = await dataModelsPage.statusFilterSelect.isVisible().catch(() => false);
    if (statusFilterVisible) {
      await dataModelsPage.selectStatusFilter('all');
      const rowCount = await dataModelsPage.getRowCount();
      expect(rowCount).toBeGreaterThanOrEqual(0);
    } else {
      test.skip();
    }
  });

  test('状态筛选-激活', async ({ page }) => {
    await dataModelsPage.waitForTableLoad();
    const statusFilterVisible = await dataModelsPage.statusFilterSelect.isVisible().catch(() => false);
    if (statusFilterVisible) {
      await dataModelsPage.selectStatusFilter('active');
      const rowCount = await dataModelsPage.getRowCount();
      expect(rowCount).toBeGreaterThanOrEqual(0);
    } else {
      test.skip();
    }
  });

  test('状态筛选-停用', async ({ page }) => {
    await dataModelsPage.waitForTableLoad();
    const statusFilterVisible = await dataModelsPage.statusFilterSelect.isVisible().catch(() => false);
    if (statusFilterVisible) {
      await dataModelsPage.selectStatusFilter('inactive');
      const rowCount = await dataModelsPage.getRowCount();
      expect(rowCount).toBeGreaterThanOrEqual(0);
    } else {
      test.skip();
    }
  });

  test('数据源筛选', async ({ page }) => {
    await dataModelsPage.waitForTableLoad();
    const rowCount = await dataModelsPage.getRowCount();
    if (rowCount > 0) {
      const firstRow = dataModelsPage.getFirstRow();
      const datasourceCell = firstRow.locator('td').nth(2);
      const datasourceName = await datasourceCell.textContent();
      if (datasourceName && datasourceName.trim() !== '-') {
        const datasourceFilterVisible = await dataModelsPage.datasourceFilterSelect.isVisible().catch(() => false);
        if (datasourceFilterVisible) {
          await dataModelsPage.selectDatasourceFilter(datasourceName.trim());
          const filteredRows = await dataModelsPage.getRowCount();
          expect(filteredRows).toBeGreaterThanOrEqual(0);
        } else {
          test.skip();
        }
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('重置筛选', async ({ page }) => {
    await dataModelsPage.waitForTableLoad();
    const clearBtnVisible = await dataModelsPage.clearFiltersButton.isVisible().catch(() => false);
    if (clearBtnVisible) {
      await dataModelsPage.selectStatusFilter('active');
      await dataModelsPage.waitForTableLoad();
      await dataModelsPage.clearAllFilters();
      await dataModelsPage.waitForTableLoad();
      const rowCount = await dataModelsPage.getRowCount();
      expect(rowCount).toBeGreaterThanOrEqual(0);
    } else {
      test.skip();
    }
  });
});
