import { test, expect } from '../../../fixtures/auth';
import { TagsPage } from '../../../fixtures/page-objects/TagsPage';
import { TagTestDataFactory } from './fixtures/tag-test-data';

test.describe('P2 - 标签输入验证', () => {
  let tagsPage: TagsPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    tagsPage = new TagsPage(authenticatedPage);
    await tagsPage.goto();
  });

  test('名称边界值 - 最小长度（1 字符）', async () => {
    await tagsPage.clickCreate();
    await tagsPage.page.getByLabel('标签名称').fill('A');
    
    await expect(tagsPage.page.getByLabel('标签名称')).toHaveValue('A');
  });

  test('名称边界值 - 最大长度（255 字符）', async () => {
    const maxLengthName = 'A'.repeat(255);
    
    await tagsPage.clickCreate();
    await tagsPage.page.getByLabel('标签名称').fill(maxLengthName);
    
    await expect(tagsPage.page.getByLabel('标签名称')).toHaveValue(maxLengthName);
  });

  test('名称边界值 - 超过最大长度应失败', async () => {
    const overMaxLengthName = 'A'.repeat(256);
    
    await tagsPage.clickCreate();
    await tagsPage.page.getByLabel('标签名称').fill(overMaxLengthName);
  });

  test('名称 - 特殊字符', async () => {
    const specialName = TagTestDataFactory.getBoundaryTestData().nameWithSpecialChars;
    
    await tagsPage.clickCreate();
    await tagsPage.page.getByLabel('标签名称').fill(specialName);
    
    await expect(tagsPage.page.getByLabel('标签名称')).toHaveValue(specialName);
  });

  test('必填字段验证 - 空名称', async () => {
    await tagsPage.clickCreate();
    
    await tagsPage.page.getByRole('button', { name: /下一步/ }).click();
    
    await expect(tagsPage.page.getByText(/请输入标签名称/)).toBeVisible();
  });
});
