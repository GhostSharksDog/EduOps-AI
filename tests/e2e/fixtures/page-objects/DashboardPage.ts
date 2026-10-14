import { Page, Locator } from '@playwright/test';
import { BaseDashboardPage } from './BaseDashboardPage';

export class DashboardPage extends BaseDashboardPage {
  readonly sidebar: Locator;
  readonly userInfo: Locator;

  constructor(page: Page) {
    super(page, '/dashboard', /仪表盘|Dashboard|概览/i);
    this.sidebar = page.locator('.ant-layout-sider');
    this.userInfo = page.locator('.ant-dropdown-trigger').filter({ hasText: /.+/ }).first();
  }

  async navigateTo(path: string): Promise<void> {
    await this.page.goto(`/dashboard/${path}`);
    await this.page.waitForLoadState('networkidle');
  }

  async clickSidebarMenu(menuText: string | RegExp): Promise<void> {
    // 使用 .first() 避免 strict mode violation（多个菜单项可能匹配相同文本）
    await this.sidebar.getByRole('menuitem', { name: menuText }).first().click();
    await this.page.waitForLoadState('networkidle');
  }

  async getUserMenuText(): Promise<string> {
    return await this.userInfo.textContent() || '';
  }

  async logout(): Promise<void> {
    await this.userInfo.click();
    await this.page.getByRole('menuitem', { name: /退出|登出|Logout/i }).click();
  }
}
