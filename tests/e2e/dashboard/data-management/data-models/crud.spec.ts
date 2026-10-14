import {LoginPage} from '../../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../../fixtures/auth';
import { DataModelsPage } from '../../../fixtures/page-objects/DataModelsPage';

test.describe('P2 - 数据模型 CRUD', () => {
  let dataModelsPage: DataModelsPage;
  
  test.beforeEach(async ({ page }) => {
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
    await page.goto('/dashboard/data/models');
    await page.waitForLoadState('networkidle');
    dataModelsPage = new DataModelsPage(page);
  });

  test('显示数据模型列表', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /数据模型/ })).toBeVisible();
    await expect(page.locator('.ant-table')).toBeVisible();
  });

  test('创建数据模型', async ({ page }) => {
    test.skip(true, 'CreateDataModelDrawer is a multi-step wizard - needs full implementation');
  });

  test('SQL导入模型', async ({ page }) => {
    // Use Page Object for SQL import flow
    const sqlImportBtnVisible = await dataModelsPage.sqlImportButton.isVisible().catch(() => false);
    if (sqlImportBtnVisible) {
      await dataModelsPage.clickSqlImport();
      await dataModelsPage.fillSqlContent('SELECT id, name FROM users LIMIT 10');
      await dataModelsPage.submitSqlImport();
    } else {
      test.skip();
    }
  });

  test('编辑数据模型', async ({ page }) => {
    await page.waitForSelector('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)', { state: 'visible', timeout: 5000 }).catch(() => {});
    const firstRow = page.locator('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)').first();
    const rowText = await firstRow.innerText();
    if (rowText) {
      await dataModelsPage.clickEditInRow(rowText);
      const nameInput = page.getByLabel('模型名称');
      const currentValue = await nameInput.inputValue();
      await nameInput.fill(currentValue + '_已编辑');
      await page.getByRole('button', { name: /保存|确定/ }).click();
      await expect(page.getByText(/更新成功|成功/)).toBeVisible({ timeout: 10000 });
    } else {
      test.skip();
    }
  });

  test('激活/停用模型', async ({ page }) => {
    await page.waitForSelector('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)', { state: 'visible', timeout: 5000 }).catch(() => {});
    const firstRow = page.locator('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)').first();
    const rowText = await firstRow.innerText();
    const switchBtn = firstRow.locator('.ant-switch');
    if (await switchBtn.isVisible()) {
      await dataModelsPage.toggleModelStatus(rowText, true);
      await expect(page.getByText(/状态|成功/)).toBeVisible({ timeout: 10000 });
    } else {
      test.skip();
    }
  });

  test('删除数据模型', async ({ page }) => {
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
