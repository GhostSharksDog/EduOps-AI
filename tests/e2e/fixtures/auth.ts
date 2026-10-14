import { test as base, Page, expect, APIRequestContext } from '@playwright/test';
import { LoginPage } from './page-objects/LoginPage';

/**
 * 扩展的测试 fixture，提供自动认证功能
 */
export const test = base.extend<{
  /**
   * 已认证的页面（自动登录）
   */
  authenticatedPage: Page;
  
  /**
   * 登录页 Page Object
   */
  loginPage: LoginPage;
  
  /**
   * API 请求上下文（用于 API 调用）
   */
  request: APIRequestContext;
}>({
  authenticatedPage: async ({ page }, use) => {
    // 执行登录
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login();
    
    // 等待页面稳定
    await page.waitForLoadState('networkidle');
    
    // 使用已认证的页面
    await use(page);
  },
  
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },
  
  request: async ({ request: baseRequest }, use) => {
    await use(baseRequest);
  },
});

export { expect };

/**
 * 测试辅助函数：检查是否已登录
 */
export async function checkAuth(page: Page): Promise<boolean> {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  return !!token;
}

/**
 * 测试辅助函数：清除认证状态
 */
export async function clearAuth(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  });
}

/**
 * 测试辅助函数：设置认证 token（用于模拟已登录状态）
 */
export async function setAuthToken(page: Page, token: string, userInfo?: any): Promise<void> {
  await page.evaluate(
    ({ token, userInfo }) => {
      localStorage.setItem('auth_token', token);
      if (userInfo) {
        localStorage.setItem('auth_user', JSON.stringify(userInfo));
      }
    },
    { token, userInfo }
  );
}
