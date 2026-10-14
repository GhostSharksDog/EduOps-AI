import {LoginPage} from '../../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../../fixtures/auth';
import { BitmapManagementPage } from '../../../fixtures/page-objects/BitmapPage';

test.describe('P1 - Bitmap 表 CRUD', () => {
  let bitmapPage: BitmapManagementPage;

  test.beforeEach(async ({ page }) => {
    bitmapPage = new BitmapManagementPage(page);
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
    await bitmapPage.goto();
  });

  test('显示 Bitmap 表列表', async () => {
    await bitmapPage.verifyHeading();
    await expect(bitmapPage.table).toBeVisible();
  });

  test('创建 Bitmap 表 - 最小位数(8)', async ({ page }) => {
    const timestamp = Date.now();
    const entityType = `TEST_${timestamp}`;
    
    await bitmapPage.createBitmapTable(entityType, 8, true);
    
    await bitmapPage.search(entityType);
    await expect(bitmapPage.getRowByEntityType(entityType)).toBeVisible({ timeout: 10000 });
    await bitmapPage.clearSearch();
  });

  test('创建 Bitmap 表 - 最大位数(256)', async ({ page }) => {
    const timestamp = Date.now();
    const entityType = `TEST_256_${timestamp}`;
    
    await bitmapPage.createBitmapTable(entityType, 256, true);
    
    await bitmapPage.search(entityType);
    const row = bitmapPage.getRowByEntityType(entityType);
    await expect(row).toBeVisible({ timeout: 10000 });
    
    const usage = await bitmapPage.getRowUsage(row);
    expect(usage.total).toBe(256);
    
    await bitmapPage.clearSearch();
  });

  test('停用表状态', async ({ page }) => {
    const timestamp = Date.now();
    const entityType = `TEST_DEACTIVATE_${timestamp}`;
    
    await bitmapPage.createBitmapTable(entityType, 64, true);
    await bitmapPage.search(entityType);
    
    const row = bitmapPage.getRowByEntityType(entityType);
    await expect(row).toBeVisible({ timeout: 10000 });
    
    expect(await bitmapPage.getRowStatus(row)).toBe('ACTIVE');
    
    await bitmapPage.toggleTableStatus(row);
    
    await page.waitForTimeout(500);
    expect(await bitmapPage.getRowStatus(row)).toBe('INACTIVE');
    
    await bitmapPage.clearSearch();
  });

  test('激活表状态', async ({ page }) => {
    const timestamp = Date.now();
    const entityType = `TEST_ACTIVATE_${timestamp}`;
    
    await bitmapPage.createBitmapTable(entityType, 64, true);
    await bitmapPage.search(entityType);
    
    const row = bitmapPage.getRowByEntityType(entityType);
    await expect(row).toBeVisible({ timeout: 10000 });
    
    await bitmapPage.toggleTableStatus(row);
    await page.waitForTimeout(500);
    expect(await bitmapPage.getRowStatus(row)).toBe('INACTIVE');
    
    await bitmapPage.toggleTableStatus(row);
    await page.waitForTimeout(500);
    expect(await bitmapPage.getRowStatus(row)).toBe('ACTIVE');
    
    await bitmapPage.clearSearch();
  });

  test('查看表详情', async ({ page }) => {
    const timestamp = Date.now();
    const entityType = `TEST_DETAIL_${timestamp}`;
    
    await bitmapPage.createBitmapTable(entityType, 64, true);
    await bitmapPage.search(entityType);
    
    const row = bitmapPage.getRowByEntityType(entityType);
    await expect(row).toBeVisible({ timeout: 10000 });
    
    await bitmapPage.openDetailDrawer(row);
    
    await expect(bitmapPage.detailDrawer).toBeVisible();
    
    const stats = await bitmapPage.getDrawerStats();
    expect(stats.total).toBe(64);
    expect(stats.used).toBe(0);
    expect(stats.available).toBe(64);
    
    await bitmapPage.closeDetailDrawer();
    await bitmapPage.clearSearch();
  });
});
