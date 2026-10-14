import { test, expect } from '@playwright/test';
import { TagCategoriesPage, TagsPage } from '../../../fixtures/page-objects';

test.describe('P1 - 标签分类验证', () => {
  let categoriesPage: TagCategoriesPage;

  test.beforeEach(async ({ page }) => {
    categoriesPage = new TagCategoriesPage(page);
    await categoriesPage.goto();
    await categoriesPage.waitForTableLoad();
  });

  test('表单验证 - 空名称', async ({ page }) => {
    await categoriesPage.clickCreate();
    await categoriesPage.fillCreateForm('');
    await categoriesPage.submitCreate();
    
    await expect(page.getByText(/请输入|不能为空|必填/)).toBeVisible({ timeout: 5000 });
  });

  test('删除有子分类的分类应被阻止', async ({ page }) => {
    const timestamp = Date.now();
    const parentName = `父分类_受保护_${timestamp}`;
    const childName = `子分类_受保护_${timestamp}`;
    
    await categoriesPage.createCategory(parentName);
    await categoriesPage.search(parentName);
    await expect(page.getByRole('cell', { name: parentName }).first()).toBeVisible({ timeout: 5000 });
    await categoriesPage.clearSearch();
    
    await page.reload();
    await categoriesPage.waitForTableLoad();
    await page.waitForTimeout(2000);
    
    await categoriesPage.createChildCategory(childName, parentName);
    
    await categoriesPage.search(parentName);
    await page.waitForTimeout(500);
    
    const parentRow = page.getByRole('row', { name: new RegExp(parentName) }).first();
    await expect(parentRow).toBeVisible({ timeout: 3000 });
    
    await parentRow.getByRole('button').filter({ has: page.locator('.anticon-more') }).click();
    await page.waitForTimeout(200);
    
    await page.getByRole('menuitem', { name: /删除/ }).click();
    await page.waitForTimeout(200);
    
    await page.getByRole('button', { name: /确定|确认/ }).click();
    
    await expect(page.getByText(/无法删除|存在子分类|操作失败|删除失败/)).toBeVisible({ timeout: 3000 });
    
    await categoriesPage.clearSearch();
    await categoriesPage.search(parentName);
    await expect(page.getByRole('cell', { name: parentName }).first()).toBeVisible({ timeout: 3000 });
  });

  test('名称边界值 - 超过50字符应失败', async ({ page }) => {
    const longName = 'A'.repeat(51);
    
    await categoriesPage.waitForTableLoad();
    await page.getByRole('button', { name: /新建/ }).click();
    await page.waitForSelector('.ant-drawer', { state: 'visible', timeout: 3000 });
    await page.getByPlaceholder('例如：用户标签').fill(longName);
    await page.locator('.ant-drawer .ant-btn-primary').click();
    
    await expect(page.getByText(/2-50|长度|不能超过/)).toBeVisible({ timeout: 3000 });
    
    await page.keyboard.press('Escape');
    await page.waitForSelector('.ant-drawer', { state: 'hidden', timeout: 2000 }).catch(() => {});
  });

  test('名称边界值 - 50字符应成功', async ({ page }) => {
    const timestamp = Date.now().toString().slice(-6);
    const baseName = '测'.repeat(43);
    const maxLengthName = `${baseName}_${timestamp}`;
    
    await categoriesPage.createCategory(maxLengthName);
    await categoriesPage.search(maxLengthName);
    await expect(page.getByRole('cell', { name: maxLengthName }).first()).toBeVisible({ timeout: 10000 });
    await categoriesPage.clearSearch();
  });

  test('名称边界值 - 特殊字符和Emoji应成功', async ({ page }) => {
    const specialName = `测试@#$%_${Date.now()}_😀🎉`;
    
    await categoriesPage.createCategory(specialName);
    await categoriesPage.search(specialName);
    await expect(page.getByRole('cell', { name: specialName }).first()).toBeVisible({ timeout: 10000 });
    await categoriesPage.clearSearch();
  });

  test('名称边界值 - 纯空格应失败', async ({ page }) => {
    await categoriesPage.clickCreate();
    await categoriesPage.fillCreateForm('   ');
    
    const responsePromise = page.waitForResponse(resp => 
      resp.url().includes('/api/tag-categories') && resp.request().method() === 'POST'
    );
    await categoriesPage.submitCreate();
    const response = await responsePromise;
    
    expect(response.status()).toBe(400);

    await page.keyboard.press('Escape');
    await page.waitForSelector('.ant-drawer', { state: 'hidden', timeout: 2000 }).catch(() => {});
  });

  test('删除被标签使用的分类应被阻止', async ({ page }) => {
    const timestamp = Date.now();
    const categoryName = `标签关联分类_${timestamp}`;
    
    await categoriesPage.createCategory(categoryName);
    await categoriesPage.search(categoryName);
    await expect(page.getByRole('cell', { name: categoryName }).first()).toBeVisible({ timeout: 15000 });
    await categoriesPage.clearSearch();
    
    const tagsPage = new TagsPage(page);
    await tagsPage.goto();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    const tagName = `测试标签_${timestamp}`;
    await tagsPage.createTag(tagName, categoryName);
    
    await categoriesPage.goto();
    await categoriesPage.waitForTableLoad();
    
    const categoryRow = categoriesPage.getRowByName(categoryName);
    await categoriesPage.deleteCategory(categoryRow);
    
    await page.reload();
    await categoriesPage.waitForTableLoad();
    await categoriesPage.search(categoryName);
    
    await expect(page.getByRole('cell', { name: categoryName }).first()).toBeVisible({ timeout: 5000 });
  });
});
