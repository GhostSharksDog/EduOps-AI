import { Page, Locator, expect } from '@playwright/test';
import { BaseDashboardPage } from './BaseDashboardPage';

/**
 * 标签分类页 Page Object
 * 继承 BaseDashboardPage，复用通用表格操作
 */
export class TagCategoriesPage extends BaseDashboardPage {
  readonly pagination: Locator;

  constructor(page: Page) {
    super(page, '/dashboard/tags/categories', '标签分类');
    this.pagination = page.locator('.ant-pagination');
  }

  // ==================== 表单操作 ====================

  /**
   * 点击创建按钮（处理已有抽屉的情况）
   */
  override async clickCreate(): Promise<void> {
    const existingDrawer = this.page.locator('.ant-drawer');
    if (await existingDrawer.isVisible()) {
      await this.page.keyboard.press('Escape');
      await this.page.waitForSelector('.ant-drawer', { state: 'hidden', timeout: 3000 }).catch(() => {});
      await this.page.waitForTimeout(300);
    }
    
    await this.createButton.click();
    await this.waitForDrawer();
    await this.page.waitForTimeout(200);
  }

  /**
   * 填写创建表单
   */
  async fillCreateForm(name: string, sortOrder?: number, description?: string) {
    await this.page.waitForSelector('.ant-drawer-body', { state: 'visible', timeout: 3000 });
    await this.page.getByPlaceholder('例如：用户标签').fill(name);
    
    if (sortOrder !== undefined) {
      await this.page.getByPlaceholder('请输入排序索引').fill(sortOrder.toString());
    }
    
    if (description) {
      await this.page.getByPlaceholder('请输入分类描述').fill(description);
    }
  }

  /**
   * 选择上级分类（在创建表单中）
   */
  async selectParentCategory(parentName: string | null) {
    if (parentName === null) {
      return;
    }

    const formItem = this.page.locator('.ant-form-item').filter({ hasText: '上级分类' });
    const treeSelect = formItem.locator('.ant-select');

    for (let retry = 0; retry < 5; retry++) {
      const responsePromise = this.page.waitForResponse(
        resp => resp.url().includes('/api/tag-categories') && resp.request().method() === 'GET',
        { timeout: 10000 }
      ).then(resp => resp.json()).catch(() => null);
      
      await treeSelect.click();
      await this.page.waitForTimeout(500);

      const tree = this.page.getByRole('tree');
      await tree.waitFor({ state: 'visible', timeout: 5000 });
      
      const response = await responsePromise;
      console.log(`Retry ${retry + 1}: API response:`, JSON.stringify(response?.items?.slice(0, 3)));
      
      const treeitem = tree.getByRole('treeitem').filter({ hasText: parentName }).first();
      if (await treeitem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await treeitem.click();
        await this.page.waitForTimeout(300);
        return;
      }

      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(3000);
    }

    throw new Error(`Parent category "${parentName}" not found in TreeSelect`);
  }

  /**
   * 创建带上级分类的子分类
   */
  async createChildCategory(name: string, parentName: string, orderIndex?: number) {
    await this.page.reload();
    await this.waitForTableLoad();
    await this.page.waitForTimeout(2000);
    
    await this.clickCreate();
    await this.selectParentCategory(parentName);
    await this.fillCreateForm(name, orderIndex);
    await this.submitCreate();
    await this.page.reload();
    await this.waitForTableLoad();
  }

  /**
   * 提交创建
   */
  async submitCreate() {
    const btn = this.page.locator('.ant-drawer').getByRole('button', { name: /创\s*建/ });
    await btn.waitFor({ state: 'visible', timeout: 5000 });
    await btn.scrollIntoViewIfNeeded();
    await btn.click({ force: true });
    await this.page.waitForTimeout(1000);
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(500);
    await this.page.waitForSelector('.ant-drawer', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  /**
   * 创建分类（完整流程）
   */
  async createCategory(name: string, orderIndex?: number) {
    await this.clickCreate();
    await this.fillCreateForm(name, orderIndex);
    await this.submitCreate();
    await this.page.reload();
    await this.waitForTableLoad();
  }

  // ==================== 下拉菜单操作 ====================

  /**
   * 打开行操作下拉菜单（通过 Locator）
   */
  async openRowDropdownByLocator(row: Locator) {
    await row.getByRole('button').filter({ has: this.page.locator('.anticon-more') }).click();
    await this.page.waitForSelector('.ant-dropdown:not(.ant-dropdown-hidden)', { state: 'visible', timeout: 3000 });
  }

  /**
   * 点击编辑菜单项（需先调用 openRowDropdown）
   */
  async clickEditMenuItem() {
    await this.page.getByRole('menuitem', { name: /编辑分类|查看详情/ }).click();
    await this.waitForDrawer();
  }

  /**
   * 点击删除菜单项（需先调用 openRowDropdown）
   */
  async clickDeleteMenuItem() {
    await this.page.getByRole('menuitem', { name: /删除/ }).click();
    await this.waitForModal();
  }

  /**
   * 确认删除（在确认弹窗中）
   */
  override async confirmDelete(): Promise<void> {
    const btn = this.page.getByRole('button', { name: /确认删除|确定/ });
    await btn.waitFor({ state: 'visible', timeout: 5000 });
    await this.page.waitForTimeout(300);
    await btn.click({ force: true });
  }

  async editCategory(row: Locator, newName: string) {
    await this.openRowDropdownByLocator(row);
    await this.clickEditMenuItem();
    
    const nameInput = this.page.getByLabel('分类名称');
    await nameInput.fill(newName);
    
    await this.page.getByRole('button', { name: '保存' }).click();
  }

  async deleteCategory(row: Locator) {
    await this.openRowDropdownByLocator(row);
    await this.clickDeleteMenuItem();
    await this.confirmDelete();
    await expect(this.page.getByText(/删除成功|成功/)).toBeVisible({ timeout: 10000 }).catch(() => {});
  }

  // ==================== 行定位方法 ====================

  /**
   * 根据名称获取行
   */
  getRowByName(name: string): Locator {
    return this.tableBody.locator('tr:not([aria-hidden]):not(.ant-table-placeholder)').filter({
      has: this.page.getByRole('cell', { name: new RegExp(`^(folder )?(•\\s*)?${name}$`) })
    }).first();
  }

  /**
   * 获取行排序索引
   */
  async getRowOrderIndex(row: Locator): Promise<string> {
    const orderCell = row.locator('td').nth(2);
    return await orderCell.innerText();
  }

  /**
   * 获取行子分类数量
   */
  async getRowChildCount(row: Locator): Promise<number> {
    await row.waitFor({ state: 'visible', timeout: 5000 });
    
    const badge = row.locator('.ant-badge-count, sup.ant-badge-count');
    if (await badge.isVisible({ timeout: 2000 }).catch(() => false)) {
      const text = await badge.textContent() || '';
      const count = parseInt(text.trim(), 10);
      if (!isNaN(count)) return count;
    }
    
    const cells = row.locator('td');
    const cellCount = await cells.count();
    if (cellCount >= 5) {
      const childCell = cells.nth(4);
      const text = await childCell.textContent() || '';
      if (text.includes('-') || text.trim() === '') {
        return 0;
      }
      const match = text.match(/\d+/);
      if (match) {
        return parseInt(match[0], 10);
      }
    }
    
    return 0;
  }

  /**
   * 点击文件夹图标展开/折叠
   */
  async clickFolderIcon(row: Locator) {
    const folderIcon = row.locator('td').first().locator('span[style*="cursor: pointer"]');
    await folderIcon.click();
  }

  /**
   * 检查是否有文件夹图标
   */
  async hasFolderIcon(row: Locator): Promise<boolean> {
    const folderIcon = row.locator('td').first().locator('span[style*="cursor: pointer"]');
    return await folderIcon.isVisible();
  }

  // ==================== 页面验证 ====================

  /**
   * 验证页面元素（表格或空状态）
   */
  async verifyPageElements() {
    await expect(this.heading).toBeVisible();
    const hasTable = await this.table.isVisible().catch(() => false);
    if (!hasTable) {
      await expect(this.page.getByText('暂无标签分类')).toBeVisible();
    }
  }

  /**
   * 检查是否为空状态
   */
  async isEmptyState(): Promise<boolean> {
    const emptyText = this.page.getByText('暂无标签分类');
    return await emptyText.isVisible();
  }

  // ==================== 分页操作 ====================

  /**
   * 获取当前页码
   */
  async getCurrentPage(): Promise<number> {
    const activeItem = this.pagination.locator('.ant-pagination-item-active');
    if (await activeItem.isVisible()) {
      const text = await activeItem.textContent();
      return parseInt(text || '1', 10);
    }
    return 1;
  }

  /**
   * 获取总页数
   */
  async getTotalPages(): Promise<number> {
    const items = this.pagination.locator('.ant-pagination-item');
    const count = await items.count();
    if (count === 0) return 1;
    
    const lastItem = items.last();
    const text = await lastItem.textContent();
    return parseInt(text || '1', 10);
  }

  /**
   * 跳转到指定页
   */
  async goToPage(pageNumber: number) {
    await this.pagination.locator('.ant-pagination-item', { hasText: String(pageNumber) }).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * 点击下一页
   */
  async clickNextPage() {
    await this.pagination.locator('.ant-pagination-next').click();
    await this.page.waitForTimeout(500);
  }

  /**
   * 检查是否有分页
   */
  async hasPagination(): Promise<boolean> {
    return await this.pagination.isVisible();
  }

  // ==================== 删除相关 ====================

  /**
   * 取消删除确认 Modal
   */
  override async cancelDelete(): Promise<void> {
    const cancelButton = this.page.getByRole('button', { name: /取消/ });
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      await this.page.waitForSelector('.ant-modal', { state: 'hidden' }).catch(() => {});
    }
  }

  /**
   * 检查删除操作是否被阻止（显示错误提示）
   */
  async expectDeleteBlocked(): Promise<boolean> {
    const errorVisible = await this.page.locator('.ant-message-error, .ant-notification-error').isVisible().catch(() => false);
    if (errorVisible) return true;

    const warningModal = this.page.locator('.ant-modal-confirm, .ant-modal-warning');
    return await warningModal.isVisible().catch(() => false);
  }

  /**
   * 获取分类关联的标签数量
   */
  async getCategoryTagCount(row: Locator): Promise<number | null> {
    try {
      const cells = row.locator('td');
      const count = await cells.count();
      for (let i = 0; i < count; i++) {
        const text = await cells.nth(i).textContent();
        if (text) {
          const match = text.match(/(\d+)\s*(个|标签|tag)/i);
          if (match) {
            return parseInt(match[1], 10);
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }
}
