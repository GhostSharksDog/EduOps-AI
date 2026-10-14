import { Page, Locator } from '@playwright/test';
import { BaseDashboardPage } from './BaseDashboardPage';

export class TagsMonitorPage extends BaseDashboardPage {
  readonly statusTab: Locator;
  readonly errorsTab: Locator;
  readonly statusFilter: Locator;
  readonly searchInput: Locator;
  readonly refreshButton: Locator;

  constructor(page: Page) {
    super(page, '/dashboard/tags/monitor', 'MV 监控');
    this.statusTab = page.getByRole('tab', { name: 'MV 状态' });
    this.errorsTab = page.getByRole('tab', { name: '异常日志' });
    this.statusFilter = page.getByRole('combobox');
    this.searchInput = page.getByPlaceholder('搜索标签名称');
    this.refreshButton = page.getByRole('button', { name: /刷新/ });
  }

  async selectStatusFilter(status: 'all' | 'healthy' | 'warning' | 'error') {
    await this.statusFilter.click();
    await this.page.getByRole('option', { name: status === 'all' ? '全部状态' : status === 'healthy' ? '正常' : status === 'warning' ? '警告' : '错误' }).click();
  }

  async switchToErrorsTab() {
    await this.errorsTab.click();
  }

  async switchToStatusTab() {
    await this.statusTab.click();
  }

  async clickRefresh() {
    await this.refreshButton.click();
  }

  getStatusTableRows(): Locator {
    return this.page.locator('.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)');
  }

  async getStatusRowCount(): Promise<number> {
    return await this.getStatusTableRows().count();
  }
}
