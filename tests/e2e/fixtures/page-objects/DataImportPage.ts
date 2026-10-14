import { Page, Locator } from '@playwright/test';
import { BaseDashboardPage } from './BaseDashboardPage';

/**
 * 数据导入页 Page Object
 * Route: /dashboard/data/import
 */
export class DataImportPage extends BaseDashboardPage {
  readonly downloadTemplateButton: Locator;
  readonly stepIndicator: Locator;
  readonly dataTypeSelector: Locator;
  readonly fileUploader: Locator;
  readonly uploadButton: Locator;
  readonly startImportButton: Locator;
  readonly progressBar: Locator;
  readonly historyTable: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    super(page, '/dashboard/data/import', /批量导入|Batch Import|数据导入|Data Import/i);
    this.downloadTemplateButton = page.getByRole('button', { name: /下载模板|Download Template/i });
    this.stepIndicator = page.locator('.ant-steps');
    this.dataTypeSelector = page.getByRole('combobox', { name: /数据类型|Data Type/i });
    this.fileUploader = page.locator('.ant-upload-drag, .ant-upload-select');
    this.uploadButton = page.getByRole('button', { name: /上传|Upload/i });
    this.startImportButton = page.getByRole('button', { name: /开始导入|Start Import/i });
    this.progressBar = page.locator('.ant-progress');
    this.historyTable = page.locator('.import-history .ant-table, .history-table');
    this.successMessage = page.locator('.ant-message-success, .import-success');
  }

  async goto(): Promise<void> {
    await this.page.goto('/dashboard/data/import');
    await this.page.waitForLoadState('networkidle');
  }

  async downloadTemplate(): Promise<void> {
    await this.downloadTemplateButton.click();
  }

  async selectDataType(dataType: 'user' | 'device' | 'behavior' | 'transaction'): Promise<void> {
    await this.dataTypeSelector.click();
    const typeMap = {
      user: /用户|User/i,
      device: /设备|Device/i,
      behavior: /行为|Behavior/i,
      transaction: /交易|Transaction/i,
    };
    await this.page.getByRole('option', { name: typeMap[dataType] }).click();
  }

  async uploadFile(filePath: string): Promise<void> {
    const fileInput = this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
    await this.page.waitForTimeout(1000);
  }

  async clickUpload(): Promise<void> {
    await this.uploadButton.click();
  }

  async startImport(): Promise<void> {
    await this.startImportButton.click();
  }

  async waitForImportComplete(timeout: number = 60000): Promise<void> {
    await this.progressBar.waitFor({ state: 'visible', timeout });
    await this.page.waitForFunction(
      () => {
        const progress = document.querySelector('.ant-progress-text');
        return progress && progress.textContent === '100%';
      },
      { timeout }
    );
  }

  async isImportSuccessful(): Promise<boolean> {
    return await this.successMessage.isVisible();
  }

  async getCurrentStep(): Promise<number> {
    const currentStep = await this.stepIndicator.locator('.ant-steps-item-active').getAttribute('data-step');
    return currentStep ? parseInt(currentStep, 10) : 0;
  }

  async getHistoryRowCount(): Promise<number> {
    const rows = await this.historyTable.locator('tbody tr:not([aria-hidden])').count();
    return rows;
  }

  async getHistoryRowStatus(rowText: string | RegExp): Promise<string> {
    const row = this.historyTable.getByRole('row').filter({ hasText: rowText });
    const status = await row.locator('.ant-tag').textContent();
    return status || '';
  }
}
