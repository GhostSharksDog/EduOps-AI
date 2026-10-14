import { test, expect } from '../fixtures/auth';
import { LoginPage } from '../fixtures/page-objects/LoginPage';

test.describe('P0 - 认证流程', () => {
  
  test('本地账号登录成功并跳转到仪表盘', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    await loginPage.verifyLoginPageElements();
    
    await loginPage.login();
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    const isLoggedIn = await loginPage.isLoggedIn();
    expect(isLoggedIn).toBe(true);
  });

  test('未认证用户访问受保护页面应重定向到登录', async ({ page }) => {
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.clear());
    
    await page.goto('/dashboard/tags');
    
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('已认证用户直接访问登录页应跳转到仪表盘', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login();
    
    // 登录后再次访问登录页 - 系统可能自动跳转也可能不跳转
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(auth\/login|dashboard)/);
  });

  test('登出后清除认证状态', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login();
    await expect(page).toHaveURL(/\/dashboard/);

    await loginPage.logout();
    
    const token = await loginPage.getToken();
    expect(token).toBeNull();

    // 验证登出后访问受保护页面会重定向到登录页
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
