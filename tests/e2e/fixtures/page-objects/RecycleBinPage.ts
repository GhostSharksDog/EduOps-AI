import { Page, Locator } from '@playwright/test';
import { BaseDashboardPage } from './BaseDashboardPage';

export class RecycleBinPage extends BaseDashboardPage {
  readonly typeFilter: Locator;
  readonly dateFilter: Locator;
  readonly restoreButton: Locator;
  readonly permanentDeleteButton: Locator;
  readonly batchRestoreButton: Locator;
  readonly batchDeleteButton: Locator;
  readonly pagination: Locator;
  readonly nextPageButton: Locator;

  constructor(page: Page) {
    super(page, '/dashboard/system/recycle-bin', '回收站');
    this.typeFilter = page.getByRole('combobox', { name: /类型|Type/i });
    this.dateFilter = page.getByRole('button', { name: /日期|时间|Date|Time/i });
    this.restoreButton = page.getByRole('button', { name: /恢复|Restore/i });
    this.permanentDeleteButton = page.getByRole('button', { name: /彻底删除|永久删除|Permanent Delete/i });
    // 批量按钮包含计数，如 "批量恢复 (2)"
    this.batchRestoreButton = page.getByRole('button', { name: /批量恢复.*\(\d+\)/ });
    this.batchDeleteButton = page.getByRole('button', { name: /批量永久删除.*\(\d+\)/ });
    this.pagination = page.locator('.ant-pagination');
    // 分页按钮可能是 "下一页" 或 "Next Page" 或 right 图标
    this.nextPageButton = page.locator('.ant-pagination-next button');
  }

  async selectType(type: string): Promise<void> {
    await this.typeFilter.click();
    await this.page.getByRole('option', { name: type }).click();
  }

  async selectDateRange(startDate: string, endDate: string): Promise<void> {
    await this.dateFilter.click();
    await this.page.getByPlaceholder(/开始|Start/i).fill(startDate);
    await this.page.getByPlaceholder(/结束|End/i).fill(endDate);
    await this.page.keyboard.press('Enter');
  }

  async clickRestoreInRow(rowText: string | RegExp): Promise<void> {
    const row = this.getRowByText(rowText);
    await row.getByRole('button', { name: /恢复|Restore/i }).click();
  }

  async clickPermanentDeleteInRow(rowText: string | RegExp): Promise<void> {
    const row = this.getRowByText(rowText);
    await row.getByRole('button', { name: /彻底删除|永久删除|Permanent Delete/i }).click();
  }

  async confirmRestore(): Promise<void> {
    await this.confirmDelete();
  }

  async confirmPermanentDelete(): Promise<void> {
    await this.confirmDelete();
  }

  async batchRestore(): Promise<void> {
    await this.batchRestoreButton.click();
    await this.confirmDelete();
  }

  async batchPermanentDelete(): Promise<void> {
    await this.batchDeleteButton.click();
    await this.confirmDelete();
  }

  async hasPagination(): Promise<boolean> {
    return await this.pagination.isVisible();
  }

  async waitForTableLoad(): Promise<void> {
    await super.waitForTableLoad({ waitForApi: /\/api\/recycle-bin/ });
  }
}
