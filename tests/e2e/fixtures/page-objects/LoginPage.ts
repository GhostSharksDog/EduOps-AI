import { Page, Locator, expect } from '@playwright/test';

/**
 * 登录页 Page Object
 */
export class LoginPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly loginButton: Locator;
  readonly cardTitle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', {name:'教培运营分析辅助系统'});
    this.subtitle = page.getByText('使用机构账号登录，查看运营数据与分析建议。');
    this.cardTitle = page.getByLabel('用户名', {exact:true});
    this.loginButton = page.getByRole('button', {name:/^登\s*录$/});
  }

  /**
   * 导航到登录页
   */
  async goto() {
    const base=process.env.TEST_BASE_URL;
    let testDatabase=false;try{testDatabase=new URL(process.env.TEST_DATABASE_URL??'').pathname.slice(1).endsWith('_test');}catch{}
    if(!base&&!testDatabase)throw new Error('端到端登录只允许明确配置测试服务或 _test 数据库');
    if(base&&!['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname))throw new Error('端到端测试服务必须为本机地址');
    await this.page.goto(base?new URL('/auth/login',base).href:'/auth/login');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * 执行登录操作
   */
  async login() {
    const username=process.env.TEST_USERNAME,password=process.env.TEST_PASSWORD;
    if(!username||!password)throw new Error('请配置 TEST_USERNAME 和 TEST_PASSWORD 测试账号');
    await this.page.getByLabel('用户名',{exact:true}).fill(username);
    await this.page.getByLabel('密码',{exact:true}).fill(password);
    await this.loginButton.click();
    // 等待跳转到仪表盘
    await this.page.waitForURL(/\/dashboard/, { timeout: 10000 });
  }

  /**
   * 完整登录流程（导航 + 登录）
   */
  async loginFlow() {
    await this.goto();
    await this.login();
  }

  /**
   * 检查是否已登录（通过 localStorage 中的 token）
   */
  async isLoggedIn(): Promise<boolean> {
    const token = await this.page.evaluate(() => localStorage.getItem('auth_token'));
    return !!token;
  }

  /**
   * 清除登录状态
   */
  async logout() {
    await this.page.evaluate(() => {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    });
  }

  /**
   * 清除所有本地存储
   */
  async clearStorage() {
    await this.page.evaluate(() => localStorage.clear());
  }

  /**
   * 获取存储的 token
   */
  async getToken(): Promise<string | null> {
    return await this.page.evaluate(() => localStorage.getItem('auth_token'));
  }

  /**
   * 获取存储的用户信息
   */
  async getUserInfo(): Promise<any | null> {
    const userInfoStr = await this.page.evaluate(() => localStorage.getItem('auth_user'));
    if (userInfoStr) {
      try {
        return JSON.parse(userInfoStr);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * 验证登录页面元素
   */
  async verifyLoginPageElements() {
    await expect(this.heading).toBeVisible();
    await expect(this.subtitle).toBeVisible();
    await expect(this.cardTitle).toBeVisible();
    await expect(this.loginButton).toBeVisible();
  }
}
