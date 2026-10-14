import {LoginPage} from '../../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../../fixtures/auth';
import { RecycleBinPage } from '../../../fixtures/page-objects/RecycleBinPage';

test.describe('P1 - 回收站验证', () => {
  let recycleBinPage: RecycleBinPage;

  test.beforeEach(async ({ page }) => {
    recycleBinPage = new RecycleBinPage(page);
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
    await recycleBinPage.goto();
  });

  test.describe('确认弹窗', () => {
    test('恢复操作应显示确认弹窗', async ({ page }) => {
      await recycleBinPage.waitForTableLoad();
      const rowCount = await recycleBinPage.getRowCount();
      
      if (rowCount > 0) {
        const firstRow = recycleBinPage.getFirstRow();
        const restoreBtn = firstRow.getByRole('button', { name: /恢复/ });
        
        if (await restoreBtn.isVisible()) {
          await restoreBtn.click();
          
          await expect(page.locator('.ant-modal-confirm, .ant-modal')).toBeVisible();
          await expect(page.getByRole('heading', { name: /确认恢复/ })).toBeVisible();
          await recycleBinPage.cancelDelete();
        } else {
          test.skip();
        }
      } else {
        test.skip();
      }
    });

    test('永久删除操作应显示确认弹窗', async ({ page }) => {
      await recycleBinPage.waitForTableLoad();
      const rowCount = await recycleBinPage.getRowCount();
      
      if (rowCount > 0) {
        const firstRow = recycleBinPage.getFirstRow();
        const deleteBtn = firstRow.getByRole('button', { name: /永久删除/ });
        
        if (await deleteBtn.isVisible()) {
          await deleteBtn.click();
          
          await expect(page.locator('.ant-modal-confirm, .ant-modal')).toBeVisible();
          await expect(page.getByRole('heading', { name: /永久删除/ })).toBeVisible();
          await recycleBinPage.cancelDelete();
        } else {
          test.skip();
        }
      } else {
        test.skip();
      }
    });

    test('取消恢复操作应不执行恢复', async ({ page }) => {
      await recycleBinPage.waitForTableLoad();
      const rowCount = await recycleBinPage.getRowCount();
      
      if (rowCount > 0) {
        const firstRow = recycleBinPage.getFirstRow();
        const restoreBtn = firstRow.getByRole('button', { name: /恢复/ });
        
        if (await restoreBtn.isVisible()) {
          await restoreBtn.click();
          await recycleBinPage.cancelDelete();
          await expect(page.locator('.ant-message-success')).not.toBeVisible({ timeout: 2000 });
        } else {
          test.skip();
        }
      } else {
        test.skip();
      }
    });

    test('取消永久删除操作应不执行删除', async ({ page }) => {
      await recycleBinPage.waitForTableLoad();
      const rowCount = await recycleBinPage.getRowCount();
      
      if (rowCount > 0) {
        const firstRow = recycleBinPage.getFirstRow();
        const deleteBtn = firstRow.getByRole('button', { name: /永久删除/ });
        
        if (await deleteBtn.isVisible()) {
          await deleteBtn.click();
          await recycleBinPage.cancelDelete();
          await expect(page.locator('.ant-message-success')).not.toBeVisible({ timeout: 2000 });
        } else {
          test.skip();
        }
      } else {
        test.skip();
      }
    });
  });

  test.describe('批量操作', () => {
    test('未选择数据时批量操作按钮不可见', async () => {
      await recycleBinPage.waitForTableLoad();
      const rowCount = await recycleBinPage.getRowCount();

      if (rowCount >= 1) {
        const batchRestoreVisible = await recycleBinPage.batchRestoreButton.isVisible().catch(() => false);
        const batchDeleteVisible = await recycleBinPage.batchDeleteButton.isVisible().catch(() => false);

        expect(batchRestoreVisible || batchDeleteVisible).toBeFalsy();
      } else {
        test.skip();
      }
    });

    test('全选功能', async () => {
      await recycleBinPage.waitForTableLoad();
      const rowCount = await recycleBinPage.getRowCount();

      if (rowCount >= 2) {
        await recycleBinPage.selectAll();
        const rows = recycleBinPage.getAllRows();
        const count = await rows.count();
        for (let i = 0; i < Math.min(count, 3); i++) {
          const checkbox = rows.nth(i).locator('.ant-checkbox-input');
          expect(await checkbox.isChecked()).toBeTruthy();
        }
      } else {
        test.skip();
      }
    });
  });

  test.describe('空状态', () => {
    test('空回收站应显示空状态提示', async ({ page }) => {
      await recycleBinPage.search('不存在的数据_xyz123');
      await page.waitForTimeout(500);

      const rowCount = await recycleBinPage.getRowCount();
      if (rowCount === 0) {
        await expect(
          page.locator('.ant-empty, .ant-table-placeholder').first()
        ).toBeVisible();
      } else {
        test.skip();
      }
    });
  });
});
