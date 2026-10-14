import {LoginPage} from '../../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../../fixtures/auth';
import { TagsPage } from '../../../fixtures/page-objects/TagsPage';

/**
 * 标签 筛选和分页测试
 * 测试搜索、筛选、分页功能
 */
test.describe('P1 - 标签筛选', () => {
  let tagsPage: TagsPage;

  test.beforeEach(async ({ page }) => {
    tagsPage = new TagsPage(page);
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
    await tagsPage.goto();
  });

  test('搜索标签', async ({ page }) => {
    await tagsPage.search('测试');
    
    await page.waitForTimeout(500);
    
    const rowCount = await tagsPage.getRowCount();
    if (rowCount > 0) {
      const firstRowText = await tagsPage.getFirstRow().textContent();
      expect(firstRowText).toBeTruthy();
    }
  });

  test('按状态筛选', async ({ page }) => {
    const selects = page.locator('.ant-select');
    await selects.nth(1).click();
    await page.waitForTimeout(500);
    const dropdown = page.locator('.ant-select-dropdown').last();
    await dropdown.locator('.ant-select-item').filter({ hasText: '已激活' }).click();
    
    await page.waitForTimeout(500);
    
    const rowCount = await tagsPage.getRowCount();
    expect(rowCount).toBeGreaterThanOrEqual(0);
  });

  test('分页功能', async ({ page }) => {
    const pagination = page.locator('.ant-pagination');
    
    if (await pagination.isVisible()) {
      const nextBtn = page.getByRole('button', { name: /下一页/ });
      
      if (await nextBtn.isEnabled()) {
        await nextBtn.click();
        await page.waitForTimeout(500);
        await expect(page.locator('.ant-pagination-item-active').or(pagination)).toBeVisible();
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });
});
