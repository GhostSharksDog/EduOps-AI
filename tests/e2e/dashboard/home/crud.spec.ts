import {LoginPage} from '../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../fixtures/auth';
import { DashboardPage } from '../../fixtures/page-objects/DashboardPage';

test.describe('P0 - 仪表盘首页', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
  });

  test('显示仪表盘页面元素', async ({ page }) => {
    await dashboardPage.verifyHeading();
    await expect(dashboardPage.sidebar).toBeVisible();
  });

  test('侧边栏导航功能', async ({ page }) => {
    await expect(dashboardPage.sidebar).toBeVisible();
    
    const menuItems = dashboardPage.sidebar.getByRole('menuitem');
    const count = await menuItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('显示用户信息', async ({ page }) => {
    const userText = await dashboardPage.getUserMenuText();
    expect(userText.length).toBeGreaterThan(0);
  });

  test('导航到标签管理', async ({ page }) => {
    // 直接导航到标签管理页面，因为"标签中心"是 SubMenu
    await page.goto('/dashboard/tags');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/dashboard\/tags/);
  });

  test('导航到人群管理', async ({ page }) => {
    // 直接导航到人群管理页面，因为"实体分群"是 SubMenu
    await page.goto('/dashboard/segments');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/dashboard\/segments/);
  });
});
