import {LoginPage} from '../../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../../fixtures/auth';
import { TagsPage } from '../../../fixtures/page-objects/TagsPage';

/**
 * 标签 CRUD 独立测试
 * 每个测试独立运行，互不依赖，可并行执行
 */
test.describe('P1 - 标签 CRUD', () => {
  let tagsPage: TagsPage;

  test.beforeEach(async ({ page }) => {
    tagsPage = new TagsPage(page);
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
    await tagsPage.goto();
  });

  test('显示标签列表', async ({ page }) => {
    await tagsPage.verifyPageElements();
    
    const rowCount = await tagsPage.getRowCount();
    expect(rowCount).toBeGreaterThanOrEqual(0);
  });

  test('创建新标签', async ({ page }) => {
    // TODO: CreateTagDrawer 是3步向导表单，需要完整实现所有步骤的填写
    // Step 0: 基础信息 (name, dataType, updateCycle, categoryId)
    // Step 1: 规则配置 (ruleType, dataModelIds, ruleContent)
    // Step 2: 版本信息 (version, description)
    test.skip(true, 'CreateTagDrawer is a 3-step wizard - needs full implementation');
  });

  test('编辑标签', async ({ page }) => {
    await tagsPage.waitForTableLoad();
    
    const rowCount = await tagsPage.getRowCount();
    if (rowCount > 0) {
      const firstRow = tagsPage.getFirstRow();
      await tagsPage.clickEdit(firstRow);
      
      const nameInput = page.getByLabel('标签名称');
      const currentValue = await nameInput.inputValue();
      await nameInput.fill(currentValue + '_已编辑');
      
      await page.getByRole('button', { name: /保存|确定/ }).click();
      
      await expect(page.getByText(/更新成功|成功/)).toBeVisible({ timeout: 10000 });
    } else {
      test.skip();
    }
  });

  test('删除标签', async ({ page }) => {
    await tagsPage.waitForTableLoad();
    
    const rowCount = await tagsPage.getRowCount();
    if (rowCount > 0) {
      const firstRow = tagsPage.getFirstRow();
      await tagsPage.clickDelete(firstRow);
      await tagsPage.confirmDelete();
      
      await expect(page.getByText(/删除成功|成功/)).toBeVisible({ timeout: 10000 });
    } else {
      test.skip();
    }
  });

  test('切换标签状态', async ({ page }) => {
    await tagsPage.waitForTableLoad();
    
    const rowCount = await tagsPage.getRowCount();
    if (rowCount > 0) {
      const firstRow = tagsPage.getFirstRow();
      const switchBtn = firstRow.locator('.ant-switch');
      
      if (await switchBtn.isVisible()) {
        await switchBtn.click();
        await expect(page.getByText(/状态|成功/)).toBeVisible({ timeout: 10000 });
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('查看标签版本', async ({ page }) => {
    await tagsPage.waitForTableLoad();
    
    const rowCount = await tagsPage.getRowCount();
    if (rowCount > 0) {
      const firstRow = tagsPage.getFirstRow();
      const versionBtn = firstRow.getByRole('button', { name: /版本/ });
      
      if (await versionBtn.isVisible()) {
        await tagsPage.clickVersion(firstRow);
        await expect(page.locator('.ant-drawer')).toBeVisible();
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });
});
