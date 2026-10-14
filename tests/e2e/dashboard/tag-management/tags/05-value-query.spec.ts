import { test, expect } from '../../../fixtures/auth';
import { TagsPage } from '../../../fixtures/page-objects/TagsPage';
import { TagTestDataFactory, TagApiHelper } from './fixtures/tag-test-data';

test.describe('P1 - 标签值查询', () => {
  let tagsPage: TagsPage;
  let apiHelper: TagApiHelper;

  test.beforeEach(async ({ authenticatedPage, request }) => {
    tagsPage = new TagsPage(authenticatedPage);
    const pageUrl = authenticatedPage.url();
    const baseUrl = new URL('/', pageUrl).origin;
    apiHelper = new TagApiHelper(request, baseUrl);
    await tagsPage.goto();
  });

  test.afterEach(async () => {
    await apiHelper.cleanupTestTags('值查询');
  });

  test('打开值查询抽屉 - 仅 ACTIVE 状态可用', async () => {
    const tag = await apiHelper.createTag(
      TagTestDataFactory.createBooleanTag({ name: TagTestDataFactory.generateName('值查询_激活') })
    );
    await apiHelper.activateTag(tag.id);
    
    await tagsPage.goto();
    const row = await tagsPage.waitForTag(tag.name);
    
    await tagsPage.openValueQueryDrawer(row);
    
    const drawer = tagsPage.page.locator('.ant-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(/查询标签值/)).toBeVisible();
  });

  test('值查询 - 无效 UUID 格式应显示错误', async () => {
    const tag = await apiHelper.createTag(
      TagTestDataFactory.createBooleanTag({ name: TagTestDataFactory.generateName('值查询_无效UUID') })
    );
    await apiHelper.activateTag(tag.id);
    
    await tagsPage.goto();
    const row = await tagsPage.waitForTag(tag.name);
    await tagsPage.openValueQueryDrawer(row);
    
    await tagsPage.page.getByPlaceholder(/输入.*ID|UUID/).fill('not-a-valid-uuid');
    await tagsPage.page.getByRole('button', { name: /查询/ }).click();
    
    await expect(tagsPage.page.getByText(/格式错误|UUID|无效/i)).toBeVisible({ timeout: 5000 });
  });

  test('值查询 - 有效 UUID 但无数据', async () => {
    const tag = await apiHelper.createTag(
      TagTestDataFactory.createBooleanTag({ name: TagTestDataFactory.generateName('值查询_无数据') })
    );
    await apiHelper.activateTag(tag.id);
    
    await tagsPage.goto();
    const row = await tagsPage.waitForTag(tag.name);
    await tagsPage.openValueQueryDrawer(row);
    
    const validUUID = TagTestDataFactory.generateUUID();
    await tagsPage.page.getByPlaceholder(/输入.*ID|UUID/).fill(validUUID);
    await tagsPage.page.getByRole('button', { name: /查询/ }).click();
    
    await expect(tagsPage.page.getByText(/未找到|无值|空/)).toBeVisible({ timeout: 5000 });
  });
});
