import { test, expect } from '@playwright/test';
import { TagCategoriesPage } from '../../../fixtures/page-objects';

test.describe('P1 - 标签分类 CRUD', () => {
  let categoriesPage: TagCategoriesPage;

  test.beforeEach(async ({ page }) => {
    categoriesPage = new TagCategoriesPage(page);
    await categoriesPage.goto();
  });

  test('显示分类列表', async ({ page }) => {
    await categoriesPage.verifyPageElements();
  });

  test('创建新分类', async ({ page }) => {
    const uniqueName = `E2E测试分类_${Date.now()}`;
    
    await categoriesPage.clickCreate();
    await categoriesPage.fillCreateForm(uniqueName);
    await categoriesPage.submitCreate();
    
    await page.reload();
    await categoriesPage.waitForTableLoad();
    
    await categoriesPage.search(uniqueName);
    await expect(page.getByRole('cell', { name: uniqueName }).first()).toBeVisible({ timeout: 10000 });
    await categoriesPage.clearSearch();
  });

  test('编辑分类', async ({ page }) => {
    await page.waitForSelector('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)', { state: 'visible', timeout: 5000 }).catch(() => {});
    
    const rowCount = await page.locator('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)').count();
    if (rowCount > 0) {
      const firstRow = categoriesPage.getFirstRow();
      
      await categoriesPage.openRowDropdownByLocator(firstRow);
      await categoriesPage.clickEditMenuItem();
      
      await expect(page.locator('.ant-drawer')).toBeVisible();
      
      const nameInput = page.getByLabel('分类名称');
      const currentValue = await nameInput.inputValue();
      await nameInput.fill(currentValue + '_已编辑');
      
      await page.getByRole('button', { name: /保\s*存/ }).click();
      
      await expect(page.getByText(/更新成功|成功/).first()).toBeVisible({ timeout: 10000 });
    } else {
      test.skip();
    }
  });

  test('删除分类', async ({ page }) => {
    const deleteTargetName = `待删除分类_${Date.now()}`;
    await categoriesPage.createCategory(deleteTargetName);
    await categoriesPage.search(deleteTargetName);
    await expect(categoriesPage.getRowByName(deleteTargetName)).toBeVisible({ timeout: 10000 });
    
    const targetRow = categoriesPage.getRowByName(deleteTargetName);
    await categoriesPage.deleteCategory(targetRow);
    
    await expect(page.getByText(/删除成功|分类已删除|成功/).first()).toBeVisible({ timeout: 10000 });
    await categoriesPage.clearSearch();
    await page.waitForTimeout(2000);
    await categoriesPage.search(deleteTargetName);
    await expect(categoriesPage.getRowByName(deleteTargetName)).not.toBeVisible({ timeout: 5000 });
  });

test('创建带上级分类的子分类', async ({ page }) => {
    test.setTimeout(60000);
    const timestamp = Date.now();
    const parentName = `父分类_${timestamp}`;
    const childName = `子分类_${timestamp}`;
    
    await categoriesPage.createCategory(parentName);
    
    await categoriesPage.search(parentName);
    await expect(page.getByRole('cell', { name: parentName }).first()).toBeVisible({ timeout: 10000 });
    await categoriesPage.clearSearch();
    
    await categoriesPage.createChildCategory(childName, parentName);
    await categoriesPage.search(childName);
    await expect(page.getByRole('cell', { name: childName }).first()).toBeVisible({ timeout: 10000 });
  });

  test('验证层级关系显示', async ({ page }) => {
    await categoriesPage.waitForTableLoad();
    
    if (await categoriesPage.isEmptyState()) {
      test.skip();
      return;
    }
    
    const rows = categoriesPage.getAllRows();
    const rowCount = await rows.count();
    
    for (let i = 0; i < Math.min(rowCount, 5); i++) {
      const row = rows.nth(i);
      const hasChildren = await categoriesPage.hasFolderIcon(row);
      
      if (hasChildren) {
        const childCount = await categoriesPage.getRowChildCount(row);
        expect(childCount).toBeGreaterThan(0);
        
        await categoriesPage.clickFolderIcon(row);
        await page.waitForTimeout(500);
        
        const expandedRows = categoriesPage.getAllRows();
        const newRowCount = await expandedRows.count();
        expect(newRowCount).toBeGreaterThan(rowCount);
        break;
      }
    }
  });

  test('验证排序索引排序', async ({ page }) => {
    const timestamp = Date.now();
    const cat1 = `排序A_${timestamp}`;
    const cat2 = `排序B_${timestamp}`;
    const cat3 = `排序C_${timestamp}`;
    
    await categoriesPage.createCategory(cat1, 30);
    await categoriesPage.createCategory(cat2, 10);
    await categoriesPage.createCategory(cat3, 20);
    
    await categoriesPage.search(`排序A_${timestamp}`);
    await expect(page.getByRole('cell', { name: cat1 }).first()).toBeVisible({ timeout: 10000 });
    await categoriesPage.search(`排序B_${timestamp}`);
    await expect(page.getByRole('cell', { name: cat2 }).first()).toBeVisible({ timeout: 10000 });
    await categoriesPage.search(`排序C_${timestamp}`);
    await expect(page.getByRole('cell', { name: cat3 }).first()).toBeVisible({ timeout: 10000 });
    await categoriesPage.clearSearch();
    
    await page.reload();
    await categoriesPage.waitForTableLoad();
    
    await categoriesPage.search(`排序A_${timestamp}`);
    const row1 = categoriesPage.getRowByName(cat1);
    await expect(row1).toBeVisible({ timeout: 5000 });
    const order1 = parseInt(await categoriesPage.getRowOrderIndex(row1), 10);
    
    await categoriesPage.search(`排序B_${timestamp}`);
    const row2 = categoriesPage.getRowByName(cat2);
    await expect(row2).toBeVisible({ timeout: 5000 });
    const order2 = parseInt(await categoriesPage.getRowOrderIndex(row2), 10);
    
    await categoriesPage.search(`排序C_${timestamp}`);
    const row3 = categoriesPage.getRowByName(cat3);
    await expect(row3).toBeVisible({ timeout: 5000 });
    const order3 = parseInt(await categoriesPage.getRowOrderIndex(row3), 10);
    
    expect(order2).toBe(10);
    expect(order3).toBe(20);
    expect(order1).toBe(30);
  });
});
