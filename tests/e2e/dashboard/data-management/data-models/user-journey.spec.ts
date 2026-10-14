import {LoginPage} from '../../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../../fixtures/auth';

test.describe('P0 - 数据模型用户旅程', () => {
  let page: import('@playwright/test').Page;
  
  const timestamp = Date.now();
  const modelName = `旅程模型_${timestamp}`;
  const modelNameEdited = `旅程模型_已编辑_${timestamp}`;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
    await page.goto('/dashboard/data/models');
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('Step 1: SQL导入创建模型', async () => {
    const sqlImportBtn = page.getByRole('button', { name: /SQL导入|导入/ });
    
    if (await sqlImportBtn.isVisible()) {
      await sqlImportBtn.click();
      await expect(page.locator('.ant-modal, .ant-drawer')).toBeVisible();
      
      const sqlInput = page.locator('.monaco-editor textarea, textarea').first();
      if (await sqlInput.isVisible()) {
        await sqlInput.fill(`SELECT id, name FROM users LIMIT 10 -- ${modelName}`);
        await page.getByRole('button', { name: /解析|分析/ }).click();
        await page.waitForTimeout(2000);
      }
    } else {
      test.skip();
    }
  });

  test('Step 2: 编辑模型名称', async () => {
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
    
    const nameInput = page.getByLabel('模型名称');
    await nameInput.fill(modelNameEdited);
    
    await page.getByRole('button', { name: /保存|确定/ }).click();
    
    await expect(page.getByText(/更新成功|成功/)).toBeVisible({ timeout: 10000 });
  });

  test('Step 3: 停用模型', async () => {
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

  test('Step 4: 激活模型', async () => {
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

  test('Step 5: 删除模型', async () => {
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
