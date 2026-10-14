import { test, expect } from '../../../fixtures/auth';
import { TagsPage } from '../../../fixtures/page-objects/TagsPage';
import { TagTestDataFactory, TagApiHelper } from './fixtures/tag-test-data';

test.describe('P0 - 标签生命周期', () => {
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
    await apiHelper.cleanupTestTags('生命周期');
  });

  test('DRAFT → ACTIVE: 激活标签', async () => {
    const tag = await apiHelper.createTag(
      TagTestDataFactory.createBooleanTag({ name: TagTestDataFactory.generateName('生命周期_激活') })
    );
    
    await tagsPage.goto();
    const row = await tagsPage.waitForTag(tag.name);
    
    expect(await tagsPage.getTagStatus(row)).toBe('DRAFT');
    
    await tagsPage.activateTag(row);
    
    expect(await tagsPage.getTagStatus(row)).toBe('ACTIVE');
  });

  test('ACTIVE → INACTIVE: 停用标签', async () => {
    const tag = await apiHelper.createTag(
      TagTestDataFactory.createBooleanTag({ name: TagTestDataFactory.generateName('生命周期_停用') })
    );
    await apiHelper.activateTag(tag.id);
    
    await tagsPage.goto();
    const row = await tagsPage.waitForTag(tag.name);
    
    expect(await tagsPage.getTagStatus(row)).toBe('ACTIVE');
    
    await tagsPage.deactivateTag(row);
    
    expect(await tagsPage.getTagStatus(row)).toBe('INACTIVE');
  });
});
