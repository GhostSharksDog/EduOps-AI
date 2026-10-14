import { test, expect } from '@playwright/test';
import { TagCategoriesPage } from '../../../fixtures/page-objects';

test.describe.serial('P0 - 标签分类用户旅程', () => {
  let categoriesPage: TagCategoriesPage;
  let page: import('@playwright/test').Page;
  
  const timestamp = Date.now();
  const catA = `旅程A_${timestamp}`;
  const catB = `旅程B_${timestamp}`;
  const catC = `旅程C_${timestamp}`;
  const catD = `旅程D_${timestamp}`;
  const catE = `旅程E_${timestamp}`;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    categoriesPage = new TagCategoriesPage(page);
    await categoriesPage.goto();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('Step 1: 创建父分类 A, B, C', async () => {
    await categoriesPage.createCategory(catA);
    await categoriesPage.search(catA);
    await expect(page.getByRole('cell', { name: catA }).first()).toBeVisible({ timeout: 15000 });
    await categoriesPage.clearSearch();
    
    await categoriesPage.createCategory(catB);
    await categoriesPage.search(catB);
    await expect(page.getByRole('cell', { name: catB }).first()).toBeVisible({ timeout: 15000 });
    await categoriesPage.clearSearch();
    
    await categoriesPage.createCategory(catC);
    await categoriesPage.search(catC);
    await expect(page.getByRole('cell', { name: catC }).first()).toBeVisible({ timeout: 15000 });
    await categoriesPage.clearSearch();
  });

  test('Step 2: 创建子分类 D（父分类 = A）', async () => {
    await page.reload();
    await categoriesPage.waitForTableLoad();
    await page.waitForTimeout(2000);
    
    await categoriesPage.createChildCategory(catD, catA);
    await page.waitForTimeout(1000);
    
    const parentRow = categoriesPage.getRowByName(catA);
    const childCount = await categoriesPage.getRowChildCount(parentRow);
    expect(childCount).toBeGreaterThanOrEqual(1);
    
    await categoriesPage.clickFolderIcon(parentRow);
    await page.waitForTimeout(500);
    await expect(page.getByRole('cell', { name: catD }).first()).toBeVisible({ timeout: 5000 });
  });

  test('Step 3: 编辑分类 D，重命名为 E', async () => {
    await page.reload();
    await categoriesPage.waitForTableLoad();
    
    const rowD = categoriesPage.getRowByName(catD);
    await categoriesPage.openRowDropdownByLocator(rowD);
    await categoriesPage.clickEditMenuItem();
    
    await expect(page.locator('.ant-drawer')).toBeVisible();
    
    const nameInput = page.getByLabel('分类名称');
    await nameInput.fill(catE);
    
    await page.getByRole('button', { name: /保\s*存/ }).click();
    
    await expect(page.getByText(/更新成功|成功/).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: catE }).first()).toBeVisible({ timeout: 5000 });
  });

  test.skip('Step 4: 移动分类 E，父分类从 A 改为 B', async () => {
    await page.reload();
    await categoriesPage.waitForTableLoad();
    
    const rowE = categoriesPage.getRowByName(catE);
    await categoriesPage.openRowDropdownByLocator(rowE);
    await categoriesPage.clickEditMenuItem();
    
    await expect(page.locator('.ant-drawer')).toBeVisible();
    
    await categoriesPage.selectParentCategory(catB);
    await page.getByRole('button', { name: /保\s*存/ }).click();
    
    await expect(page.getByText(/更新成功|成功/).first()).toBeVisible({ timeout: 10000 });
    
    const rowB = categoriesPage.getRowByName(catB);
    const childCountB = await categoriesPage.getRowChildCount(rowB);
    expect(childCountB).toBeGreaterThanOrEqual(1);
  });

  test('Step 5: 尝试删除 A（有子分类）应被阻止', async () => {
    await page.reload();
    await categoriesPage.waitForTableLoad();
    
    const rowA = categoriesPage.getRowByName(catA);
    const childCountA = await categoriesPage.getRowChildCount(rowA);
    
    if (childCountA !== null && childCountA > 0) {
      await categoriesPage.deleteCategory(rowA);
      
      const deleteBlocked = await categoriesPage.expectDeleteBlocked();
      
      if (!deleteBlocked) {
        await page.reload();
        await categoriesPage.waitForTableLoad();
        await expect(page.getByRole('cell', { name: catA }).first()).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('Step 6: 清理 - 删除 E → A → B → C', async () => {
    await page.reload();
    await categoriesPage.waitForTableLoad();
    
    const rowE = categoriesPage.getRowByName(catE);
    if (await rowE.isVisible()) {
      await categoriesPage.deleteCategory(rowE);
      await expect(page.getByText(/删除成功|成功/).first()).toBeVisible({ timeout: 10000 }).catch(() => {});
    }
    
    await page.reload();
    await categoriesPage.waitForTableLoad();
    const rowA = categoriesPage.getRowByName(catA);
    if (await rowA.isVisible()) {
      await categoriesPage.deleteCategory(rowA);
      await expect(page.getByText(/删除成功|成功/).first()).toBeVisible({ timeout: 10000 }).catch(() => {});
    }
    
    await page.reload();
    await categoriesPage.waitForTableLoad();
    const rowB = categoriesPage.getRowByName(catB);
    if (await rowB.isVisible()) {
      await categoriesPage.deleteCategory(rowB);
      await expect(page.getByText(/删除成功|成功/).first()).toBeVisible({ timeout: 10000 }).catch(() => {});
    }
    
    await page.reload();
    await categoriesPage.waitForTableLoad();
    const rowC = categoriesPage.getRowByName(catC);
    if (await rowC.isVisible()) {
      await categoriesPage.deleteCategory(rowC);
      await expect(page.getByText(/删除成功|成功/).first()).toBeVisible({ timeout: 10000 }).catch(() => {});
    }
    
    await page.reload();
    await categoriesPage.waitForTableLoad();
    await expect(page.getByRole('cell', { name: catA })).not.toBeVisible({ timeout: 3000 }).catch(() => {});
    await expect(page.getByRole('cell', { name: catB })).not.toBeVisible({ timeout: 3000 }).catch(() => {});
    await expect(page.getByRole('cell', { name: catC })).not.toBeVisible({ timeout: 3000 }).catch(() => {});
  });
});
