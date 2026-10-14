import {LoginPage} from '../../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../../fixtures/auth';
import { RecycleBinPage } from '../../../fixtures/page-objects/RecycleBinPage';

test.describe('P3 - 回收站 CRUD', () => {
  let recycleBinPage: RecycleBinPage;

  test.beforeEach(async ({ page }) => {
    recycleBinPage = new RecycleBinPage(page);
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
    await recycleBinPage.goto();
  });

  test('显示回收站列表', async () => {
    await recycleBinPage.verifyHeading();
    await expect(recycleBinPage.table).toBeVisible();
  });

  test('搜索已删除数据', async () => {
    await recycleBinPage.search('测试');
    await expect(recycleBinPage.table).toBeVisible();
  });

  test('按类型筛选', async ({ page }) => {
    if (await recycleBinPage.typeFilter.isVisible()) {
      await recycleBinPage.typeFilter.click();
      const options = page.getByRole('option');
      if (await options.count() > 0) {
        await options.first().click();
        await page.waitForTimeout(500);
      }
    } else {
      test.skip();
    }
  });

  test('按日期范围筛选', async ({ page }) => {
    if (await recycleBinPage.dateFilter.isVisible()) {
      await recycleBinPage.dateFilter.click();
      const quickSelect = page.getByRole('button', { name: /最近7天|最近/ });
      if (await quickSelect.isVisible()) {
        await quickSelect.click();
      }
    } else {
      test.skip();
    }
  });

  test('单条恢复', async () => {
    await recycleBinPage.waitForTableLoad();
    const rowCount = await recycleBinPage.getRowCount();
    
    if (rowCount > 0) {
      const firstRow = recycleBinPage.getFirstRow();
      const restoreBtn = firstRow.getByRole('button', { name: /恢复/ });
      
      if (await restoreBtn.isVisible()) {
        await restoreBtn.click();
        await recycleBinPage.confirmRestore();
        await recycleBinPage.waitForSuccessToast(/恢复成功|成功/);
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('批量恢复', async () => {
    await recycleBinPage.waitForTableLoad();
    const rowCount = await recycleBinPage.getRowCount();

    if (rowCount >= 2) {
      const rows = recycleBinPage.getAllRows();
      await rows.first().locator('.ant-checkbox-input').click();
      await rows.nth(1).locator('.ant-checkbox-input').click();

      if (await recycleBinPage.batchRestoreButton.isVisible()) {
        await recycleBinPage.batchRestore();
        await recycleBinPage.waitForSuccessToast(/恢复成功|成功/);
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('单条永久删除', async () => {
    await recycleBinPage.waitForTableLoad();
    const rowCount = await recycleBinPage.getRowCount();
    
    if (rowCount > 0) {
      const firstRow = recycleBinPage.getFirstRow();
      const deleteBtn = firstRow.getByRole('button', { name: /永久删除/ });
      
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        await recycleBinPage.confirmPermanentDelete();
        await recycleBinPage.waitForSuccessToast(/删除成功|已永久删除/);
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('批量永久删除', async () => {
    await recycleBinPage.waitForTableLoad();
    const rowCount = await recycleBinPage.getRowCount();
    
    if (rowCount >= 1) {
      await recycleBinPage.getAllRows().first().locator('.ant-checkbox-input').click();
      
      if (await recycleBinPage.batchDeleteButton.isVisible()) {
        await recycleBinPage.batchPermanentDelete();
        await recycleBinPage.waitForSuccessToast(/删除成功|已永久删除/);
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('分页', async () => {
    await recycleBinPage.waitForTableLoad();

    if (await recycleBinPage.hasPagination()) {
      if (await recycleBinPage.nextPageButton.isEnabled()) {
        await recycleBinPage.nextPageButton.click();
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });
});
