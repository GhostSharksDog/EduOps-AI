import { Page, Locator } from '@playwright/test';
import { BaseDashboardPage } from './BaseDashboardPage';

export class SettingsPage extends BaseDashboardPage {
  readonly generalTab: Locator;
  readonly securityTab: Locator;
  readonly notificationTab: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    super(page, '/dashboard/system/settings', /设置|Setting/i);
    this.generalTab = page.getByRole('tab', { name: /通用|General/i });
    this.securityTab = page.getByRole('tab', { name: /安全|Security/i });
    this.notificationTab = page.getByRole('tab', { name: /通知|Notification/i });
    this.saveButton = page.getByRole('button', { name: /保存|Save/i });
  }

  async switchToGeneralTab(): Promise<void> {
    await this.generalTab.click();
  }

  async switchToSecurityTab(): Promise<void> {
    await this.securityTab.click();
  }

  async switchToNotificationTab(): Promise<void> {
    await this.notificationTab.click();
  }

  async updateSetting(key: string, value: string): Promise<void> {
    await this.page.getByLabel(key).fill(value);
  }

  async saveSettings(): Promise<void> {
    await this.saveButton.click();
    await this.waitForSuccessToast(/成功|Success/i);
  }
}
