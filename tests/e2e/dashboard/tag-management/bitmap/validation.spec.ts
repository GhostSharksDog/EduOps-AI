import {LoginPage} from '../../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../../fixtures/auth';
import { BitmapManagementPage } from '../../../fixtures/page-objects/BitmapPage';

test.describe('P2 - Bitmap 表单验证', () => {
  let bitmapPage: BitmapManagementPage;

  test.beforeEach(async ({ page }) => {
    bitmapPage = new BitmapManagementPage(page);
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
    await bitmapPage.goto();
  });

  test('实体类型格式 - 仅大写字母和下划线', async ({ page }) => {
    await bitmapPage.clickCreate();
    await bitmapPage.toggleNewEntityType();
    
    await bitmapPage.inputNewEntityType('lowercase');
    await bitmapPage.inputTotalBits(64);
    await bitmapPage.submitCreate();
    
    await expect(page.getByText(/必须以大写字母开头，仅支持大写字母、数字和下划线/)).toBeVisible();
  });

  test('实体类型格式 - 允许下划线', async ({ page }) => {
    const timestamp = Date.now();
    const entityType = `ORDER_ITEM_${timestamp}`;
    
    await bitmapPage.createBitmapTable(entityType, 64, true);
    
    await bitmapPage.search(entityType);
    await expect(bitmapPage.getRowByEntityType(entityType)).toBeVisible({ timeout: 10000 });
    await bitmapPage.clearSearch();
  });

  test('实体类型格式 - 禁止特殊字符', async ({ page }) => {
    await bitmapPage.clickCreate();
    await bitmapPage.toggleNewEntityType();
    
    await bitmapPage.inputNewEntityType('ORDER-ITEM');
    await bitmapPage.inputTotalBits(64);
    await bitmapPage.submitCreate();
    
    await expect(page.getByText(/必须以大写字母开头，仅支持大写字母、数字和下划线/)).toBeVisible();
  });

  test('总位数最小值验证', async ({ page }) => {
    const timestamp = Date.now();
    const entityType = `TEST_MIN_${timestamp}`;
    
    await bitmapPage.clickCreate();
    await bitmapPage.toggleNewEntityType();
    await bitmapPage.inputNewEntityType(entityType);
    await bitmapPage.inputTotalBits(7);
    await bitmapPage.submitCreate();
    
    await page.waitForTimeout(500);
  });

  test('总位数最大值验证', async ({ page }) => {
    const timestamp = Date.now();
    const entityType = `TEST_MAX_${timestamp}`;
    
    await bitmapPage.clickCreate();
    await bitmapPage.toggleNewEntityType();
    await bitmapPage.inputNewEntityType(entityType);
    await bitmapPage.inputTotalBits(257);
    await bitmapPage.submitCreate();
    
    await page.waitForTimeout(500);
  });

  test('必填字段验证 - 实体类型为空', async ({ page }) => {
    await bitmapPage.clickCreate();
    await bitmapPage.toggleNewEntityType();
    await bitmapPage.inputTotalBits(64);
    await bitmapPage.submitCreate();
    
    await expect(page.getByText(/请输入实体类型名称/)).toBeVisible();
  });
});
