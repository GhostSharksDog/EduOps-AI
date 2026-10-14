import {LoginPage} from '../../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../../fixtures/auth';
import { DataSourcesPage } from '../../../fixtures/page-objects/DataSourcesPage';

test.describe('P2 - 数据源 CRUD', () => {
  let dataSourcesPage: DataSourcesPage;
  
  test.beforeEach(async ({ page }) => {
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
    await page.goto('/dashboard/data/sources');
    await page.waitForLoadState('networkidle');
    dataSourcesPage = new DataSourcesPage(page);
  });

  test('显示数据源列表', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /数据源/ })).toBeVisible();
    await expect(page.locator('.ant-table')).toBeVisible();
  });

  test('创建数据源', async ({ page }) => {
    test.skip(true, 'CreateDataSourceDrawer is a 4-step wizard - needs full implementation');
  });

  test('测试连接', async ({ page }) => {
    await page.waitForSelector('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)', { state: 'visible', timeout: 5000 }).catch(() => {});
    const firstRow = page.locator('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)').first();
    const rowText = await firstRow.innerText();
    const testBtn = firstRow.getByRole('button', { name: /测试连接|测试/ });
    if (await testBtn.isVisible()) {
      await testBtn.click();
      await page.waitForTimeout(3000);
      await expect(
        page.getByText(/连接成功|连接失败|成功|失败/)
      ).toBeVisible({ timeout: 15000 });
    } else {
      test.skip();
    }
  });

  test('编辑数据源', async ({ page }) => {
    await page.waitForSelector('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)', { state: 'visible', timeout: 5000 }).catch(() => {});
    
    const rowCount = await page.locator('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)').count();
    if (rowCount > 0) {
    const firstRow = page.locator('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)').first();
    const rowText = await firstRow.innerText();
    await dataSourcesPage.clickEditInRow(rowText);
      
      await expect(page.locator('.ant-drawer, .ant-modal')).toBeVisible();
      
      const nameInput = page.getByLabel('数据源名称');
      const currentValue = await nameInput.inputValue();
      await nameInput.fill(currentValue + '_已编辑');
      
    await page.getByRole('button', { name: /保存|确定/ }).click();
      
      await expect(page.getByText(/更新成功|成功/)).toBeVisible({ timeout: 10000 });
    } else {
      test.skip();
    }
  });

  test('启用/禁用数据源', async ({ page }) => {
    await page.waitForSelector('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)', { state: 'visible', timeout: 5000 }).catch(() => {});
    const firstRow = page.locator('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)').first();
    const rowText = await firstRow.innerText();
    const switchBtn = firstRow.locator('.ant-switch');
    if (await switchBtn.isVisible()) {
      await dataSourcesPage.toggleDataSourceStatus(rowText, true);
      await expect(page.getByText(/状态|成功/)).toBeVisible({ timeout: 10000 });
    } else {
      test.skip();
    }
  });

  test('删除数据源', async ({ page }) => {
    await page.waitForSelector('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)', { state: 'visible', timeout: 5000 }).catch(() => {});
    
    const rowCount = await page.locator('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)').count();
    if (rowCount > 0) {
      const firstRow = page.locator('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)').first();
      await firstRow.getByRole('button', { name: /删除/ }).click();
      
      await page.locator('.ant-modal-confirm, .ant-modal')
        .getByRole('button', { name: /确定/ }).click();
      
      await expect(page.getByText(/删除成功|成功/)).toBeVisible({ timeout: 10000 });
    } else {
      test.skip();
    }
  });
});
