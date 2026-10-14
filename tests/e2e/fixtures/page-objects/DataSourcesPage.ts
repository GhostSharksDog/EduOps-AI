import { Page, Locator } from '@playwright/test';
import { BaseDashboardPage } from './BaseDashboardPage';

export class DataSourcesPage extends BaseDashboardPage {
  readonly testConnectionButton: Locator;
  readonly wizardSteps: Locator;
  readonly nextStepButton: Locator;
  readonly prevStepButton: Locator;

  constructor(page: Page) {
    super(page, '/dashboard/data/sources', /数据源|Data Source/i);
    this.testConnectionButton = page.getByRole('button', { name: /测试连接|Test Connection|测试/i });
    this.wizardSteps = page.locator('.ant-steps');
    this.nextStepButton = page.getByRole('button', { name: /下一步|Next|继续/i });
    this.prevStepButton = page.getByRole('button', { name: /上一步|Previous|Back/i });
  }

  async clickTestConnection(): Promise<void> {
    await this.testConnectionButton.click();
  }

  async startCreateWizard(): Promise<void> {
    await this.clickCreate();
    await this.waitForDrawer();
  }

  async fillWizardStep(stepData: Record<string, string>): Promise<void> {
    for (const [label, value] of Object.entries(stepData)) {
      await this.page.getByLabel(label).fill(value);
    }
  }

  async nextWizardStep(): Promise<void> {
    await this.nextStepButton.click();
  }

  async prevWizardStep(): Promise<void> {
    await this.prevStepButton.click();
  }

  async completeWizard(): Promise<void> {
    await this.createButton.click();
    await this.waitForSuccessToast(/成功|Success/i);
  }

  async clickEditInRow(rowText: string | RegExp): Promise<void> {
    const row = this.getRowByText(rowText);
    await row.getByRole('button', { name: /编辑|Edit/i }).click();
    await this.waitForDrawer();
  }

  async toggleDataSourceStatus(rowText: string | RegExp, enabled: boolean): Promise<void> {
    await this.toggleSwitchInRow(rowText, enabled);
  }
}
