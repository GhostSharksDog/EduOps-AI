import { Page, Locator } from '@playwright/test';
import { BaseDashboardPage } from './BaseDashboardPage';

export class SystemPage extends BaseDashboardPage {
  readonly dbBrowserTab: Locator;
  readonly logsTab: Locator;
  readonly healthTab: Locator;
  readonly executeButton: Locator;
  readonly queryInput: Locator;
  readonly queryResult: Locator;

  constructor(page: Page) {
    super(page, '/dashboard/system', /系统|System/i);
    this.dbBrowserTab = page.getByRole('tab', { name: /数据库|Database|DB/i });
    this.logsTab = page.getByRole('tab', { name: /日志|Log/i });
    this.healthTab = page.getByRole('tab', { name: /健康|Health|状态|Status/i });
    this.executeButton = page.getByRole('button', { name: /执行|Execute|运行|Run/i });
    this.queryInput = page.locator('.sql-editor textarea, .monaco-editor textarea');
    this.queryResult = page.locator('.query-result, .result-table');
  }

  async switchToDbBrowser(): Promise<void> {
    await this.dbBrowserTab.click();
  }

  async switchToLogs(): Promise<void> {
    await this.logsTab.click();
  }

  async switchToHealth(): Promise<void> {
    await this.healthTab.click();
  }

  async executeQuery(sql: string): Promise<void> {
    await this.queryInput.fill(sql);
    await this.executeButton.click();
    await this.queryResult.waitFor({ state: 'visible' });
  }

  async getQueryResult(): Promise<string> {
    return await this.queryResult.textContent() || '';
  }

  async getHealthStatus(): Promise<string> {
    await this.switchToHealth();
    return await this.page.locator('.health-status, .status-indicator').textContent() || '';
  }
}
