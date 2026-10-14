import { Page, Locator, expect } from '@playwright/test';

/**
 * Base class for all dashboard page objects
 * Provides common table operations and CRUD patterns for Ant Design tables
 */
export abstract class BaseDashboardPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly table: Locator;
  readonly tableBody: Locator;
  readonly searchInput: Locator;
  readonly createButton: Locator;
  readonly refreshButton: Locator;

  protected constructor(
    page: Page,
    protected readonly basePath: string,
    headingPattern: RegExp | string
  ) {
    this.page = page;
    this.heading = typeof headingPattern === 'string'
      ? page.getByRole('heading', { name: headingPattern })
      : page.getByRole('heading', { name: headingPattern });
    this.table = page.locator('.ant-table');
    this.tableBody = page.locator('.ant-table-tbody');
    this.searchInput = page.getByPlaceholder(/搜索|查询|Search/i);
    this.createButton = page.getByRole('button', { name: /新建|创建|新增|添加|Create|Add|New/i });
    this.refreshButton = page.getByRole('button', { name: /刷新|Refresh|Reload/i });
  }

  /**
   * Navigate to this page and wait for load
   */
  async goto(): Promise<void> {
    await this.page.goto(this.basePath);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Verify page heading is visible
   */
  async verifyHeading(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  // ==================== Table Operations ====================

  /**
   * Get the first data row (excludes placeholder and hidden rows)
   */
  getFirstRow(): Locator {
    return this.tableBody.locator('tr:not([aria-hidden]):not(.ant-table-placeholder)').first();
  }

  /**
   * Get all data rows
   */
  getAllRows(): Locator {
    return this.tableBody.locator('tr:not([aria-hidden]):not(.ant-table-placeholder)');
  }

  /**
   * Get row count (visible data rows only)
   */
  async getRowCount(): Promise<number> {
    return await this.getAllRows().count();
  }

  async waitForTableLoad(options?: { waitForApi?: string | RegExp }): Promise<void> {
    await this.table.waitFor({ state: 'visible' });

    const hasDataRows = await this.page.locator(
      '.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder)'
    ).count().then(c => c > 0);

    if (!hasDataRows) {
      const loadingSpinner = this.page.locator('.ant-spin, .ant-table-loading');
      const hasLoadingSpinner = await loadingSpinner.isVisible().catch(() => false);

      if (hasLoadingSpinner && options?.waitForApi) {
        const apiPattern = options.waitForApi;
        await this.page.waitForResponse(
          response => {
            const url = response.url();
            return typeof apiPattern === 'string'
              ? url.includes(apiPattern)
              : apiPattern.test(url);
          },
          { timeout: 15000 }
        );
      }

      if (hasLoadingSpinner) {
        try {
          await loadingSpinner.waitFor({ state: 'hidden', timeout: 5000 });
        } catch {
          // Loading indicator might not exist
        }
      }
    }

    await this.page.waitForSelector(
      '.ant-table-tbody tr:not([aria-hidden]):not(.ant-table-placeholder), .ant-empty',
      { timeout: 10000 }
    );
  }

  /**
   * Wait for table to have a specific number of rows
   */
  async waitForRowCount(expectedCount: number, timeout = 10000): Promise<void> {
    await this.page.waitForFunction(
      ({ tableBody, count }) => {
        if (!tableBody) return false;
        const rows = tableBody.querySelectorAll('tr:not([aria-hidden]):not(.ant-table-placeholder)');
        return rows.length === count;
      },
      { tableBody: await this.tableBody.elementHandle(), count: expectedCount },
      { timeout }
    );
  }

  /**
   * Get cell value by row index and column name
   */
  async getCellValue(rowIndex: number, columnName: string): Promise<string> {
    const row = this.getAllRows().nth(rowIndex);
    const cell = row.getByRole('cell', { name: columnName });
    return await cell.textContent() || '';
  }

  /**
   * Get row by text content
   */
  getRowByText(text: string | RegExp): Locator {
    return this.getAllRows().filter({ hasText: text }).first();
  }

  // ==================== Search Operations ====================

  /**
   * Search for items
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Clear search input
   */
  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
    await this.searchInput.press('Enter');
    await this.page.waitForLoadState('networkidle');
  }

  // ==================== CRUD Operations ====================

  /**
   * Click the create/new button
   */
  async clickCreate(): Promise<void> {
    await this.createButton.click();
  }

  /**
   * Wait for drawer to open
   */
  async waitForDrawer(): Promise<void> {
    await this.page.waitForSelector('.ant-drawer', { state: 'visible' });
  }

  /**
   * Wait for modal to open
   */
  async waitForModal(): Promise<void> {
    await this.page.waitForSelector('.ant-modal', { state: 'visible' });
  }

  /**
   * Close drawer
   */
  async closeDrawer(): Promise<void> {
    await this.page.locator('.ant-drawer .ant-drawer-close').click();
    await this.page.waitForSelector('.ant-drawer', { state: 'hidden' });
  }

  /**
   * Close modal
   */
  async closeModal(): Promise<void> {
    await this.page.locator('.ant-modal .ant-modal-close').click();
    await this.page.waitForSelector('.ant-modal', { state: 'hidden' });
  }

  // ==================== Delete Operations ====================

  /**
   * Click delete button in row actions
   */
  async clickDeleteInRow(rowText: string | RegExp): Promise<void> {
    const row = this.getRowByText(rowText);
    await row.getByRole('button', { name: /删除|Delete|移除|Remove/i }).click();
  }

  /**
   * Confirm delete in modal
   */
  async confirmDelete(): Promise<void> {
    const confirmButton = this.page.locator('.ant-modal-confirm')
      .getByRole('button', { name: /确定|确认|OK|Confirm|Yes/i });
    await confirmButton.click();
    await this.page.waitForSelector('.ant-modal-confirm', { state: 'hidden' });
  }

  /**
   * Cancel delete in modal
   */
  async cancelDelete(): Promise<void> {
    const cancelButton = this.page.locator('.ant-modal-confirm, .ant-modal')
      .getByRole('button', { name: /取消|Cancel|No/i }).first();
    await cancelButton.click();
    await this.page.locator('.ant-modal-confirm, .ant-modal').first()
      .waitFor({ state: 'hidden' });
  }

  // ==================== Dropdown Menu Operations ====================

  /**
   * Open row dropdown menu (more button)
   */
  async openRowDropdown(rowText: string | RegExp): Promise<void> {
    const row = this.getRowByText(rowText);
    await row.locator('.anticon-more, .anticon-ellipsis, button[aria-label="more"]').click();
    await this.page.waitForSelector('.ant-dropdown:not(.ant-dropdown-hidden)');
  }

  /**
   * Click menu item in dropdown
   */
  async clickDropdownItem(itemName: string | RegExp): Promise<void> {
    await this.page.locator('.ant-dropdown:not(.ant-dropdown-hidden)')
      .getByRole('menuitem', { name: itemName }).click();
  }

  // ==================== Toast/Message Operations ====================

  /**
   * Wait for success toast
   */
  async waitForSuccessToast(messagePattern?: RegExp): Promise<void> {
    const pattern = messagePattern || /成功|Success|完成|Completed/i;
    await this.page.locator('.ant-message-success, .ant-notification-success')
      .filter({ hasText: pattern }).waitFor({ state: 'visible' });
  }

  /**
   * Wait for error toast
   */
  async waitForErrorToast(): Promise<void> {
    await this.page.locator('.ant-message-error, .ant-notification-error').waitFor({ state: 'visible' });
  }

  // ==================== Pagination Operations ====================

  /**
   * Get pagination info
   */
  async getPaginationInfo(): Promise<{ current: number; total: number }> {
    const pagination = this.page.locator('.ant-pagination');
    const currentText = await pagination.locator('.ant-pagination-item-active').textContent() || '1';
    const totalText = await pagination.locator('.ant-pagination-total-text').textContent() || '';
    const totalMatch = totalText.match(/(\d+)/);
    
    return {
      current: parseInt(currentText, 10),
      total: totalMatch ? parseInt(totalMatch[1], 10) : 0
    };
  }

  /**
   * Go to next page
   */
  async nextPage(): Promise<void> {
    await this.page.getByRole('button', { name: /下一页|Next/i }).click();
    await this.waitForTableLoad();
  }

  /**
   * Go to previous page
   */
  async previousPage(): Promise<void> {
    await this.page.getByRole('button', { name: /上一页|Previous/i }).click();
    await this.waitForTableLoad();
  }

  // ==================== Switch/Toggle Operations ====================

  /**
   * Toggle switch in row
   */
  async toggleSwitchInRow(rowText: string | RegExp, checked: boolean): Promise<void> {
    const row = this.getRowByText(rowText);
    const switchElement = row.locator('.ant-switch');
    const isChecked = await switchElement.isChecked();
    
    if (isChecked !== checked) {
      await switchElement.click();
    }
  }

  // ==================== Selection Operations ====================

  /**
   * Select row checkbox
   */
  async selectRow(rowText: string | RegExp): Promise<void> {
    const row = this.getRowByText(rowText);
    await row.locator('.ant-checkbox-input').check();
  }

  /**
   * Select all rows
   */
  async selectAll(): Promise<void> {
    await this.table.locator('.ant-table-thead .ant-checkbox-input').check();
  }

  /**
   * Clear selection
   */
  async clearSelection(): Promise<void> {
    await this.table.locator('.ant-table-thead .ant-checkbox-input').uncheck();
  }
}
