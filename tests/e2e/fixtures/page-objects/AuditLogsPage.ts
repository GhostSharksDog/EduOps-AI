import { Page, Locator } from '@playwright/test';
import { BaseDashboardPage } from './BaseDashboardPage';

export class AuditLogsPage extends BaseDashboardPage {
  readonly actionFilter: Locator;
  readonly entityFilter: Locator;
  readonly actorFilter: Locator;
  readonly totalRecords: Locator;

  constructor(page: Page) {
    super(page, '/dashboard/system/audit-logs', '审计日志');
    this.actionFilter = page.getByLabel(/操作类型/);
    this.entityFilter = page.getByLabel(/实体类型/);
    this.actorFilter = page.getByPlaceholder(/操作人/);
    this.totalRecords = page.locator('text=/共.*条记录/');
  }

  async filterByAction(action: string) {
    if (await this.actionFilter.isVisible()) {
      await this.actionFilter.click();
      await this.page.getByRole('option', { name: action }).click();
    }
  }

  async filterByEntity(entity: string) {
    if (await this.entityFilter.isVisible()) {
      await this.entityFilter.click();
      await this.page.getByRole('option', { name: entity }).click();
    }
  }

  async filterByActor(actorId: string) {
    await this.actorFilter.fill(actorId);
    await this.page.keyboard.press('Enter');
  }

  async getTotalRecords(): Promise<number> {
    const text = await this.totalRecords.textContent() || '';
    const match = text.match(/共\s*(\d+)\s*条/);
    return match ? parseInt(match[1], 10) : 0;
  }

  getLogRows(): Locator {
    return this.tableBody.locator('tr:not([aria-hidden]):not(.ant-table-placeholder)');
  }

  async getLogCount(): Promise<number> {
    return await this.getLogRows().count();
  }
}
