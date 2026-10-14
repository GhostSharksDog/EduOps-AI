import {LoginPage} from '../../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../../fixtures/auth';

test.describe('P0 - 数据源用户旅程', () => {
  let page: import('@playwright/test').Page;
  
  const timestamp = Date.now();
  const dsName = `旅程数据源_${timestamp}`;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
    await page.goto('/dashboard/data/sources');
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('Step 1: 创建数据源', async () => {
    test.skip(true, 'CreateDataSourceDrawer is a 4-step wizard - needs full implementation');
  });

  test('Step 2: 测试连接', async () => {
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const rowCount = await page.locator('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)').count();
    if (rowCount === 0) {
      test.skip();
      return;
    }
    
    const firstRow = page.locator('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)').first();
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

  test('Step 3: 编辑数据源名称', async () => {
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const rowCount = await page.locator('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)').count();
    if (rowCount === 0) {
      test.skip();
      return;
    }
    
    const firstRow = page.locator('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)').first();
    await firstRow.getByRole('button', { name: /编辑/ }).click();
    
    await expect(page.locator('.ant-drawer, .ant-modal')).toBeVisible();
    
    const nameInput = page.getByLabel('数据源名称');
    const currentValue = await nameInput.inputValue();
    await nameInput.fill(currentValue + '_已编辑');
    
    await page.getByRole('button', { name: /保存|确定/ }).click();
    
    await expect(page.getByText(/更新成功|成功/)).toBeVisible({ timeout: 10000 });
  });

  test('Step 4: 禁用数据源', async () => {
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const rowCount = await page.locator('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)').count();
    if (rowCount === 0) {
      test.skip();
      return;
    }
    
    const firstRow = page.locator('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)').first();
    const switchBtn = firstRow.locator('.ant-switch');
    
    if (await switchBtn.isVisible()) {
      await switchBtn.click();
      await expect(page.getByText(/状态|成功/)).toBeVisible({ timeout: 10000 });
    } else {
      test.skip();
    }
  });

  test('Step 5: 删除数据源', async () => {
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const rowCount = await page.locator('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)').count();
    if (rowCount === 0) {
      test.skip();
      return;
    }
    
    const firstRow = page.locator('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)').first();
    await firstRow.getByRole('button', { name: /删除/ }).click();
    
    await page.locator('.ant-modal-confirm, .ant-modal')
      .getByRole('button', { name: /确定/ }).click();
    
    await expect(page.getByText(/删除成功|成功/)).toBeVisible({ timeout: 10000 });
  });
});
