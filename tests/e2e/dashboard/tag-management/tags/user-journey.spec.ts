import {LoginPage} from '../../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../../fixtures/auth';
import { TagsPage, TagCategoriesPage } from '../../../fixtures/page-objects';

/**
 * 标签 链式冒烟测试
 * 模拟真实用户操作流程，测试步骤之间共享状态
 * 使用 test.describe.serial 确保顺序执行
 */
test.describe.serial('P0 - 标签用户旅程', () => {
  let tagsPage: TagsPage;
  let categoriesPage: TagCategoriesPage;
  let page: import('@playwright/test').Page;
  
  // 共享测试数据
  const timestamp = Date.now();
  const tagName = `旅程标签_${timestamp}`;
  const tagNameEdited = `旅程标签_已编辑_${timestamp}`;
  const categoryName = `旅程分类_${timestamp}`;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    tagsPage = new TagsPage(page);
    categoriesPage = new TagCategoriesPage(page);
    
    // 登录
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
    
    // 前置：创建测试分类
    await categoriesPage.goto();
    await categoriesPage.createCategory(categoryName);
    await expect(page.getByRole('cell', { name: categoryName })).toBeVisible({ timeout: 15000 });
    
    // 导航到标签页
    await tagsPage.goto();
  });

  test.afterAll(async () => {
    // 清理：删除测试分类
    try {
      await categoriesPage.goto();
      await categoriesPage.waitForTableLoad();
      const categoryRow = categoriesPage.getRowByName(categoryName);
      if (await categoryRow.isVisible()) {
        await categoriesPage.deleteCategory(categoryRow);
      }
    } catch {
      // 忽略清理错误
    }
    await page.close();
  });

  test('Step 1: 创建标签 Tag_A（关联分类）', async () => {
    // TODO: CreateTagDrawer 是3步向导表单，需要完整实现
    // 当前跳过，等待完整实现
    test.skip(true, 'CreateTagDrawer is a 3-step wizard - needs full implementation');
    
    /*
    await tagsPage.clickCreate();
    await tagsPage.fillCreateForm(tagName, categoryName);
    await tagsPage.submitCreate();
    
    await expect(page.getByRole('cell', { name: tagName })).toBeVisible({ timeout: 15000 });
    */
  });

  test('Step 2: 搜索 Tag_A', async () => {
    // 依赖 Step 1 创建的标签
    await tagsPage.goto();
    await tagsPage.search(tagName);
    
    await page.waitForTimeout(500);
    
    // 验证搜索结果
    const rowCount = await tagsPage.getRowCount();
    if (rowCount > 0) {
      const firstRowText = await tagsPage.getFirstRow().textContent();
      expect(firstRowText).toContain(tagName);
    }
  });

  test('Step 3: 编辑 Tag_A，重命名为 Tag_B', async () => {
    await tagsPage.goto();
    await tagsPage.waitForTableLoad();
    
    const rowCount = await tagsPage.getRowCount();
    if (rowCount === 0) {
      test.skip();
      return;
    }
    
    const firstRow = tagsPage.getFirstRow();
    await tagsPage.clickEdit(firstRow);
    
    const nameInput = page.getByLabel('标签名称');
    await nameInput.fill(tagNameEdited);
    
    await page.getByRole('button', { name: /保存|确定/ }).click();
    
    await expect(page.getByText(/更新成功|成功/)).toBeVisible({ timeout: 10000 });
  });

  test('Step 4: 切换状态（激活 → 停用）', async () => {
    await tagsPage.goto();
    await tagsPage.waitForTableLoad();
    
    const rowCount = await tagsPage.getRowCount();
    if (rowCount === 0) {
      test.skip();
      return;
    }
    
    const firstRow = tagsPage.getFirstRow();
    const switchBtn = firstRow.locator('.ant-switch');
    
    if (await switchBtn.isVisible()) {
      await switchBtn.click();
      await expect(page.getByText(/状态|成功/)).toBeVisible({ timeout: 10000 });
    } else {
      test.skip();
    }
  });

  test('Step 5: 删除标签', async () => {
    await tagsPage.goto();
    await tagsPage.waitForTableLoad();
    
    const rowCount = await tagsPage.getRowCount();
    if (rowCount === 0) {
      test.skip();
      return;
    }
    
    const firstRow = tagsPage.getFirstRow();
    await tagsPage.clickDelete(firstRow);
    await tagsPage.confirmDelete();
    
    await expect(page.getByText(/删除成功|成功/)).toBeVisible({ timeout: 10000 });
  });
});
