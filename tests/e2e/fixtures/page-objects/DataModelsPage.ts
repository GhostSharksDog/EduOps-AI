import { Page, Locator } from '@playwright/test';
import { BaseDashboardPage } from './BaseDashboardPage';

export class DataModelsPage extends BaseDashboardPage {
  readonly sqlImportButton: Locator;
  readonly editButton: Locator;
  readonly deleteButton: Locator;
  readonly monacoEditor: Locator;
  readonly createSubmitButton: Locator;
  readonly editSubmitButton: Locator;
  readonly sqlParseButton: Locator;
  readonly drawerCloseButton: Locator;
  readonly createButton: Locator;
  readonly viewDetailButton: Locator;

  readonly statusFilterSelect: Locator;
  readonly datasourceFilterSelect: Locator;
  readonly clearFiltersButton: Locator;
  readonly confirmModal: Locator;
  readonly confirmOkButton: Locator;
  readonly confirmCancelButton: Locator;

  constructor(page: Page) {
    super(page, '/dashboard/data/models', /数据模型|Data Model/i);
    this.sqlImportButton = page.getByRole('button', { name: /SQL导入|导入|Import|SQL/i });
    this.editButton = page.getByRole('button', { name: /编辑|Edit/i });
    this.deleteButton = page.getByRole('button', { name: /删除|Delete/i });
    this.monacoEditor = page.locator('.monaco-editor textarea');
    this.createSubmitButton = page.locator('.ant-drawer button[type="primary"]').filter({ hasText: /创建/ });
    this.editSubmitButton = page.locator('.ant-drawer button[type="primary"]').filter({ hasText: /保存/ });
    this.sqlParseButton = page.getByRole('button', { name: /解析|Parse/i });
    this.drawerCloseButton = page.locator('.ant-drawer .ant-drawer-close');
    this.createButton = page.getByRole('button', { name: /新建|新增|Create|New/i });
    this.viewDetailButton = page.locator('.anticon-eye');

    this.statusFilterSelect = page.locator('.ant-select').filter({ hasText: /状态|Status/i }).first();
    this.datasourceFilterSelect = page.locator('.ant-select').filter({ hasText: /数据源|DataSource/i }).first();
    this.clearFiltersButton = page.getByRole('button', { name: /重置|清除|Clear|Reset/i });
    this.confirmModal = page.locator('.ant-modal');
    this.confirmOkButton = this.confirmModal.locator('button.ant-btn-primary');
    this.confirmCancelButton = this.confirmModal.locator('button:not(.ant-btn-primary)');
  }

  async clickSqlImport(): Promise<void> {
    await this.sqlImportButton.click();
    await this.waitForDrawer();
  }

  async fillSqlContent(sql: string): Promise<void> {
    await this.monacoEditor.fill(sql);
  }

  async submitSqlImport(): Promise<void> {
    await this.editSubmitButton.click();
    await this.waitForSuccessToast(/成功|Success/i);
  }

  async clickCreate(): Promise<void> {
    await this.createButton.click();
    await this.waitForDrawer();
  }

  async fillCreateForm(values: { name?: string; description?: string; datasourceName?: string }): Promise<void> {
    if (values.name) {
      const nameInput = this.page.getByLabel(/模型名称|Name/i);
      await nameInput.fill(values.name);
    }
    if (values.description) {
      const descInput = this.page.getByLabel(/描述|Description/i);
      await descInput.fill(values.description);
    }
    if (values.datasourceName) {
      const datasourceSelect = this.page.locator('.ant-select').filter({ hasText: /数据源|DataSource/i });
      await datasourceSelect.click();
      await this.page.locator('.ant-select-dropdown').getByText(values.datasourceName).click();
    }
  }

  async submitCreate(): Promise<void> {
    await this.page.getByRole('button', { name: '创 建' }).click();
    await this.waitForSuccessToast(/成功|Success/i);
    await this.waitForDrawer({ state: 'hidden' });
  }

  async clickEditInRow(rowText: string | RegExp): Promise<void> {
    const row = this.getRowByText(rowText);
    await row.getByRole('button', { name: /编辑|Edit/i }).click();
    await this.waitForDrawer();
  }

  async fillEditForm(values: { name?: string; description?: string }): Promise<void> {
    if (values.name) {
      const nameInput = this.page.getByLabel(/模型名称|Name/i);
      await nameInput.fill(values.name);
    }
    if (values.description) {
      const descInput = this.page.getByLabel(/描述|Description/i);
      await descInput.fill(values.description);
    }
  }

  async submitEdit(): Promise<void> {
    await this.page.getByRole('button', { name: '保 存' }).click();
    await this.waitForSuccessToast(/成功|Success/i);
    await this.waitForDrawer({ state: 'hidden' });
  }

  async toggleModelStatus(rowText: string | RegExp, enabled: boolean): Promise<void> {
    await this.toggleSwitchInRow(rowText, enabled);
  }

  async clickStatusSwitchInRow(rowText: string | RegExp): Promise<void> {
    const row = this.getRowByText(rowText);
    await row.locator('.ant-switch').click();
    await this.waitForModal();
  }

  async confirmStatusChange(): Promise<void> {
    await this.confirmOkButton.click();
    await this.waitForModal({ state: 'hidden' });
    await this.waitForSuccessToast(/成功|Success/i);
  }

  async cancelStatusChange(): Promise<void> {
    await this.confirmCancelButton.click();
    await this.waitForModal({ state: 'hidden' });
  }

  async clickDeleteInRow(rowText: string | RegExp): Promise<void> {
    const row = this.getRowByText(rowText);
    await row.getByRole('button', { name: /删除|Delete|移除|Remove/i }).click();
    await this.waitForModal();
  }

  async confirmDelete(): Promise<void> {
    await this.confirmOkButton.click();
    await this.waitForModal({ state: 'hidden' });
    await this.waitForSuccessToast(/成功|Success/i);
  }

  async cancelDelete(): Promise<void> {
    await this.confirmCancelButton.click();
    await this.waitForModal({ state: 'hidden' });
  }

  async clickViewDetailInRow(rowText: string | RegExp): Promise<void> {
    const row = this.getRowByText(rowText);
    await row.locator('.anticon-eye').click();
    await this.waitForDrawer();
  }

  async waitForDetailDrawer(): Promise<void> {
    await this.page.locator('.ant-drawer').filter({ hasText: /详情|Detail|模型信息|Model Info/i }).waitFor({ state: 'visible' });
  }

  async closeDetailDrawer(): Promise<void> {
    await this.drawerCloseButton.click();
    await this.page.locator('.ant-drawer').waitFor({ state: 'hidden' });
  }

  async selectStatusFilter(status: 'all' | 'active' | 'inactive'): Promise<void> {
    const statusMap = {
      'all': /全部|All/,
      'active': /激活|Active/,
      'inactive': /停用|Inactive/
    };
    await this.statusFilterSelect.click();
    await this.page.locator('.ant-select-dropdown').getByText(statusMap[status]).click();
    await this.waitForTableLoad();
  }

  async selectDatasourceFilter(datasourceName: string): Promise<void> {
    await this.datasourceFilterSelect.click();
    await this.page.locator('.ant-select-dropdown').getByText(datasourceName).click();
    await this.waitForTableLoad();
  }

  async clearAllFilters(): Promise<void> {
    const hasClearButton = await this.clearFiltersButton.isVisible().catch(() => false);
    if (hasClearButton) {
      await this.clearFiltersButton.click();
      await this.waitForTableLoad();
    }
  }

  async waitForDrawer(options?: { state: 'visible' | 'hidden' }): Promise<void> {
    const state = options?.state || 'visible';
    await this.page.waitForSelector('.ant-drawer', { state });
  }

  async waitForModal(options?: { state: 'visible' | 'hidden' }): Promise<void> {
    const state = options?.state || 'visible';
    await this.page.waitForSelector('.ant-modal', { state });
  }
}
