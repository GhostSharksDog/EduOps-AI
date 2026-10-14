import { Page, Locator, expect } from '@playwright/test';
import { BaseDashboardPage } from './BaseDashboardPage';

/**
 * 标签列表页 Page Object
 * 继承 BaseDashboardPage，复用通用表格操作
 */
export class TagsPage extends BaseDashboardPage {
  constructor(page: Page) {
    super(page, '/dashboard/tags', '标签管理');
  }

  // ==================== 表单操作 ====================

  /**
   * 填写创建表单（Step 0: 基础信息）
   */
  async fillCreateForm(name: string, categoryId?: string) {
    await this.page.getByLabel('标签名称').fill(name);
    
    if (categoryId) {
      const formItem = this.page.locator('.ant-form-item').filter({ hasText: '所属分类' });
      const treeSelect = formItem.locator('.ant-select');

      // 重试逻辑：等待分类出现在树中
      const maxRetries = 3;
      for (let retry = 0; retry < maxRetries; retry++) {
        await treeSelect.click();
        await this.page.waitForTimeout(500);

        const tree = this.page.getByRole('tree');
        await tree.waitFor({ state: 'visible', timeout: 5000 });
        const treeitem = tree.getByRole('treeitem').filter({ hasText: categoryId }).first();

        if (await treeitem.isVisible({ timeout: 2000 }).catch(() => false)) {
          await treeitem.click();
          await this.page.waitForTimeout(300);
          return;
        }

        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(2000);
      }

      // 最后一次尝试
      await treeSelect.click();
      await this.page.waitForTimeout(500);
      await this.page.getByRole('tree').waitFor({ state: 'visible', timeout: 5000 });
      const treeitem = this.page.getByRole('treeitem').filter({ hasText: categoryId }).first();
      await treeitem.click({ timeout: 10000 });
    }
  }

  /**
   * 提交创建表单（完成按钮）
   */
  async submitCreate() {
    const dialog = this.page.getByRole('dialog');
    const nextBtn = dialog.getByRole('button', { name: /下一步/ });
    let maxSteps = 10;
    
    while (maxSteps-- > 0 && await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      const dataModelSelect = dialog.getByRole('combobox', { name: /数据模型/ });
      if (await dataModelSelect.isVisible({ timeout: 500 }).catch(() => false)) {
        await dataModelSelect.click();
        await this.page.waitForTimeout(500);
        await this.page.getByRole('option').first().click();
        await this.page.waitForTimeout(300);
        
        const ruleContent = dialog.locator('.cm-content').first();
        if (await ruleContent.isVisible({ timeout: 500 }).catch(() => false)) {
          await ruleContent.fill('SELECT 1');
        }
      }
      
      await nextBtn.click();
      await this.page.waitForTimeout(800);
    }
    
    await dialog.getByRole('button', { name: /完成/ }).click();
  }

  /**
   * 创建标签（完整流程 - 仅 Step 0）
   */
  async createTag(name: string, categoryId?: string) {
    await this.clickCreate();
    await this.waitForDrawer();
    await this.fillCreateForm(name, categoryId);
    await this.submitCreate();
  }

  // ==================== 行操作 ====================

  /**
   * 点击编辑按钮
   */
  async clickEdit(row: Locator) {
    await row.getByRole('button', { name: /编辑/ }).click();
    await this.waitForDrawer();
  }

  /**
   * 点击删除按钮
   */
  async clickDelete(row: Locator) {
    await row.getByRole('button', { name: /删除/ }).click();
    await this.waitForModal();
  }

  /**
   * 点击状态开关
   */
  async clickStatusSwitch(row: Locator) {
    await row.locator('.ant-switch').click();
  }

  /**
   * 点击版本按钮
   */
  async clickVersion(row: Locator) {
    await row.getByRole('button', { name: /版本/ }).click();
    await this.waitForDrawer();
  }

  /**
   * 验证页面元素
   */
  async verifyPageElements() {
    await expect(this.heading).toBeVisible();
    await expect(this.table).toBeVisible();
  }

  // ==================== 生命周期方法 ====================

  /**
   * 激活标签（通过下拉菜单）
   */
  async activateTag(row: Locator): Promise<void> {
    await row.getByRole('button').filter({ has: this.page.locator('.anticon-more') }).click();
    await this.page.getByRole('menuitem', { name: /激活/ }).click();
    const confirmBtn = this.page.getByRole('button', { name: /确定|确认/ });
    if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmBtn.click();
    }
    await this.waitForSuccessToast(/激活成功|已激活/);
  }

  /**
   * 停用标签（通过下拉菜单）
   */
  async deactivateTag(row: Locator): Promise<void> {
    await row.getByRole('button').filter({ has: this.page.locator('.anticon-more') }).click();
    await this.page.getByRole('menuitem', { name: /停用/ }).click();
    const confirmBtn = this.page.getByRole('button', { name: /确定|确认/ });
    if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmBtn.click();
    }
    await this.waitForSuccessToast(/停用成功|已停用/);
  }

  /**
   * 获取标签状态
   */
  async getTagStatus(row: Locator): Promise<'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'DEPRECATED'> {
    const statusBadge = row.locator('.ant-badge-status-text');
    const statusText = await statusBadge.textContent();
    
    if (statusText?.includes('已激活')) return 'ACTIVE';
    if (statusText?.includes('已停用')) return 'INACTIVE';
    if (statusText?.includes('草稿')) return 'DRAFT';
    if (statusText?.includes('废弃')) return 'DEPRECATED';
    
    const statusColor = await row.locator('.ant-badge-status-dot').getAttribute('class');
    if (statusColor?.includes('success')) return 'ACTIVE';
    if (statusColor?.includes('warning')) return 'INACTIVE';
    if (statusColor?.includes('error')) return 'DEPRECATED';
    
    return 'DRAFT';
  }

  // ==================== 版本管理方法 ====================

  /**
   * 打开版本抽屉
   */
  async openVersionDrawer(row: Locator): Promise<void> {
    await row.getByRole('button', { name: /版本/ }).click();
    await this.waitForDrawer();
  }

  /**
   * 获取版本列表
   */
  async getVersionList(): Promise<Array<{ version: number; status: string }>> {
    const rows = this.page.locator('.version-list-item, [class*="version"]');
    const count = await rows.count();
    const versions: Array<{ version: number; status: string }> = [];
    
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).textContent() || '';
      const versionMatch = text.match(/v?(\d+)/);
      if (versionMatch) {
        versions.push({
          version: parseInt(versionMatch[1]),
          status: text.includes('当前') ? '当前' : '历史'
        });
      }
    }
    return versions;
  }

  // ==================== 值查询方法 ====================

  /**
   * 打开值查询抽屉
   */
  async openValueQueryDrawer(row: Locator): Promise<void> {
    await row.getByRole('button').filter({ has: this.page.locator('.anticon-more') }).click();
    await this.page.getByRole('menuitem', { name: /查询值/ }).click();
    await this.waitForDrawer();
  }

  /**
   * 查询标签值
   */
  async queryTagValue(entityId: string): Promise<{ entityId: string; value: string } | null> {
    await this.page.getByPlaceholder(/输入.*ID|UUID/).fill(entityId);
    await this.page.getByRole('button', { name: /查询/ }).click();
    await this.page.waitForTimeout(500);
    
    const resultRow = this.page.locator('.ant-table-tbody tr').first();
    if (await resultRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      const entityId = await resultRow.locator('td').first().textContent();
      const value = await resultRow.locator('td').nth(1).textContent();
      return { entityId: entityId || '', value: value || '' };
    }
    return null;
  }

  // ==================== 行定位方法 ====================

  /**
   * 根据名称获取行
   */
  getRowByName(name: string): Locator {
    return this.tableBody.locator('tr:not([aria-hidden]):not(.ant-table-placeholder)')
      .filter({ has: this.page.getByRole('cell', { name: new RegExp(`^${name}$`) }) })
      .first();
  }

  /**
   * 等待标签出现
   */
  async waitForTag(name: string, timeout = 15000): Promise<Locator> {
    const row = this.getRowByName(name);
    await row.waitFor({ state: 'visible', timeout });
    return row;
  }
}
