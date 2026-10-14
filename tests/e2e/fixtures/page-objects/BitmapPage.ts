import { Page, Locator, expect } from '@playwright/test';
import { BaseDashboardPage } from './BaseDashboardPage';

/**
 * Bitmap 管理页 Page Object
 * 用于测试 /dashboard/tags/bitmap 页面
 */
export class BitmapManagementPage extends BaseDashboardPage {
  // 筛选器
  readonly entityTypeFilter: Locator;
  readonly statusFilter: Locator;
  
  // 抽屉
  readonly createDrawer: Locator;
  readonly detailDrawer: Locator;
  
  constructor(page: Page) {
    super(page, '/dashboard/tags/bitmap', 'Bitmap 管理');
    
    // 筛选器 - 基于 BitmapManagementView.tsx 的 Select placeholder
    // 使用更精确的选择器：通过父容器定位筛选区
    const filterArea = page.locator('.ant-space').filter({ has: page.locator('.ant-select') }).first();
    this.entityTypeFilter = filterArea.locator('.ant-select').first();
    this.statusFilter = filterArea.locator('.ant-select').nth(1);
    
    // 抽屉 - 简化选择器，直接通过标题文本匹配
    this.createDrawer = page.locator('.ant-drawer-content-wrapper').filter({
      hasText: '创建 Bitmap 表'
    });
    this.detailDrawer = page.locator('.ant-drawer-content-wrapper').filter({
      hasText: '位详情'
    });
  }

  // ==================== Table Operations ====================

  /**
   * 根据表名获取行
   */
  getRowByTableName(name: string): Locator {
    return this.getAllRows().filter({
      has: this.page.getByRole('cell', { name: new RegExp(`^${name}$`) })
    }).first();
  }

  /**
   * 根据实体类型获取行
   */
  getRowByEntityType(type: string): Locator {
    return this.getAllRows().filter({
      has: this.page.locator('.ant-tag', { hasText: new RegExp(`^${type}$`) })
    }).first();
  }

  /**
   * 获取行状态
   */
  async getRowStatus(row: Locator): Promise<'ACTIVE' | 'INACTIVE'> {
    const statusTag = row.locator('.ant-tag').last();
    const text = await statusTag.textContent();
    return text?.includes('活跃') ? 'ACTIVE' : 'INACTIVE';
  }

  /**
   * 获取行使用率
   */
  async getRowUsage(row: Locator): Promise<{ used: number; total: number; percentage: number }> {
    // 从 Progress 组件获取百分比
    const progress = row.locator('.ant-progress');
    const ariaValue = await progress.getAttribute('aria-valuenow');
    const percentage = parseInt(ariaValue || '0', 10);
    
    // 从 "已用" 列获取数字 - BitmapTable.tsx: dataIndex: 'usedBits'
    const cells = row.locator('td');
    // 列顺序: 表名、实体类型、总位数、已用、使用率、状态、操作
    const totalCell = cells.nth(2);
    const usedCell = cells.nth(3);
    
    const totalText = await totalCell.textContent() || '64';
    const usedText = await usedCell.textContent() || '0';
    
    const total = parseInt(totalText.trim(), 10);
    const used = parseInt(usedText.trim(), 10);
    
    return { used, total, percentage };
  }

  /**
   * 点击表名打开详情抽屉
   */
  async openDetailDrawer(row: Locator): Promise<void> {
    const tableNameLink = row.locator('a').first();
    await tableNameLink.click();
    await this.detailDrawer.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * 打开详情抽屉（通过表名）
   */
  async openDetailDrawerByTableName(name: string): Promise<void> {
    const row = this.getRowByTableName(name);
    await this.openDetailDrawer(row);
  }

  // ==================== Create Drawer Operations ====================

  /**
   * 点击创建按钮
   */
  async clickCreate(): Promise<void> {
    await this.createButton.waitFor({ state: 'visible', timeout: 5000 });
    await this.createButton.click();
    await this.page.waitForSelector('.ant-drawer-content-wrapper', { state: 'visible', timeout: 5000 });
  }

  /**
   * 选择已有实体类型
   */
  async selectEntityType(type: string): Promise<void> {
    const select = this.createDrawer.locator('.ant-select').first();
    await select.click();
    await this.page.waitForTimeout(300);
    await this.page.getByRole('option', { name: type }).click();
  }

  /**
   * 切换到新建实体类型模式
   */
  async toggleNewEntityType(): Promise<void> {
    await this.createDrawer.getByRole('button', { name: /\+ 新建实体类型|选择已有类型/ }).click();
    await this.page.waitForTimeout(200);
  }

  /**
   * 输入新实体类型名称
   */
  async inputNewEntityType(type: string): Promise<void> {
    const input = this.createDrawer.getByPlaceholder(/例如.*ORDER.*PRODUCT/);
    await input.fill(type);
  }

  /**
   * 输入新实体类型ID (UUID)
   */
  async inputNewEntityTypeId(uuid: string): Promise<void> {
    const input = this.createDrawer.getByPlaceholder(/例如.*550e8400/);
    await input.fill(uuid);
  }

  /**
   * 输入总位数
   */
  async inputTotalBits(bits: number): Promise<void> {
    // 通过 Form.Item label 定位 InputNumber
    const formItem = this.createDrawer.locator('.ant-form-item').filter({
      has: this.page.locator('.ant-form-item-label', { hasText: '总位数' })
    });
    const input = formItem.locator('.ant-input-number-input');
    await input.fill(bits.toString());
  }

  /**
   * 提交创建表单
   */
  async submitCreate(): Promise<void> {
    const form = this.createDrawer.locator('form');
    // Ant Design 按钮文本可能包含空格，如 "创 建"
    await form.getByRole('button', { name: /创\s*建/ }).click();
    await this.page.waitForTimeout(500);
  }

  async cancelCreate(): Promise<void> {
    await this.createDrawer.getByRole('button', { name: /取\s*消/ }).click();
    await this.createDrawer.waitFor({ state: 'hidden' });
  }

  /**
   * 创建 Bitmap 表（完整流程）
   */
  async createBitmapTable(entityType: string, totalBits: number, isNewType = false): Promise<void> {
    await this.clickCreate();
    
    if (isNewType) {
      await this.toggleNewEntityType();
      await this.inputNewEntityType(entityType);
      // 生成有效的 UUID v4 格式: 8-4-4-4-12
      const ts = Date.now();
      const uuid = [
        ts.toString(16).padStart(8, '0').slice(-8),
        '4000',
        '8000',
        'a1b2',
        ts.toString(16).padStart(12, '0').slice(-12)
      ].join('-');
      await this.inputNewEntityTypeId(uuid);
    } else {
      await this.selectEntityType(entityType);
    }
    
    await this.inputTotalBits(totalBits);
    await this.submitCreate();
    
    // 等待成功消息或错误消息
    try {
      await this.page.waitForSelector('.ant-message-success, .ant-message-error', { timeout: 10000 });
      const errorMsg = await this.page.locator('.ant-message-error').textContent().catch(() => null);
      if (errorMsg) {
        throw new Error(`创建失败: ${errorMsg}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('创建失败')) {
        throw e;
      }
      // 超时但没找到消息，检查抽屉状态
      const drawerVisible = await this.createDrawer.isVisible();
      if (drawerVisible) {
        // 检查表单验证错误
        const formError = await this.createDrawer.locator('.ant-form-item-explain-error').first().textContent().catch(() => null);
        if (formError) {
          throw new Error(`表单验证失败: ${formError}`);
        }
        throw new Error('创建超时：未收到成功或错误消息');
      }
    }
    
    // 等待抽屉关闭
    await this.createDrawer.waitFor({ state: 'hidden', timeout: 5000 });
    
    // 等待表格刷新
    await this.page.waitForTimeout(1500);
  }

  // ==================== Status Toggle Operations ====================

  /**
   * 点击停用/激活按钮
   */
  async clickToggleStatus(row: Locator): Promise<void> {
    const isActive = await this.getRowStatus(row) === 'ACTIVE';
    const buttonText = isActive ? /停用/ : /激活/;
    await row.getByRole('button', { name: buttonText }).click();
  }

  /**
   * 确认状态切换（在 Popconfirm 中）
   */
  async confirmToggle(): Promise<void> {
    await this.page.getByRole('button', { name: /确\s*认/ }).click();
    await this.page.waitForTimeout(500);
  }

  async cancelToggle(): Promise<void> {
    await this.page.getByRole('button', { name: /取\s*消/ }).click();
  }

  /**
   * 切换表状态（完整流程）
   */
  async toggleTableStatus(row: Locator): Promise<void> {
    await this.clickToggleStatus(row);
    await this.confirmToggle();
    await this.waitForSuccessToast(/成功/);
  }

  // ==================== Filter Operations ====================

  /**
   * 按实体类型筛选
   */
  async filterByEntityType(type: string): Promise<void> {
    await this.entityTypeFilter.click();
    await this.page.waitForTimeout(300);
    await this.page.getByRole('option', { name: type }).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * 按状态筛选
   */
  async filterByStatus(status: '活跃' | '已停用'): Promise<void> {
    await this.statusFilter.scrollIntoViewIfNeeded();
    await this.statusFilter.click();
    await this.page.waitForTimeout(500);
    
    const option = this.page.getByRole('option', { name: status });
    await option.scrollIntoViewIfNeeded();
    await option.click({ force: true });
    await this.page.waitForTimeout(500);
  }

  /**
   * 清空所有筛选器
   */
  async clearAllFilters(): Promise<void> {
    const clearButtons = this.page.locator('.ant-select-clear, .ant-input-clear');
    const count = await clearButtons.count();
    for (let i = 0; i < count; i++) {
      await clearButtons.nth(i).click({ force: true });
    }
    await this.page.waitForTimeout(300);
  }

  // ==================== Bit Detail Drawer Operations ====================

  /**
   * 关闭详情抽屉
   */
  async closeDetailDrawer(): Promise<void> {
    await this.detailDrawer.locator('.ant-drawer-close').click();
    await this.detailDrawer.waitFor({ state: 'hidden' });
  }

  /**
   * 获取位列表行
   */
  getBitRows(): Locator {
    return this.detailDrawer.locator('.ant-table-tbody tr');
  }

  /**
   * 获取位数量
   */
  async getBitCount(): Promise<number> {
    return await this.getBitRows().count();
  }

  /**
   * 根据位号获取行
   */
  getBitRowByIndex(index: number): Locator {
    return this.detailDrawer.locator('.ant-table-tbody tr').filter({
      has: this.page.locator('.ant-tag', { hasText: String(index) })
    });
  }

  /**
   * 根据标签名称获取位行
   */
  getBitRowByTagName(name: string): Locator {
    return this.detailDrawer.locator('.ant-table-tbody tr').filter({
      hasText: name
    });
  }

  /**
   * 搜索位
   */
  async searchBits(query: string): Promise<void> {
    const searchInput = this.detailDrawer.getByPlaceholder(/搜索标签名称或ID/);
    await searchInput.fill(query);
    await this.page.waitForTimeout(300);
  }

  /**
   * 清空位搜索
   */
  async clearBitSearch(): Promise<void> {
    const searchInput = this.detailDrawer.getByPlaceholder(/搜索标签名称或ID/);
    await searchInput.clear();
    await this.page.waitForTimeout(300);
  }

  /**
   * 释放单个位
   */
  async releaseBit(bitIndex: number): Promise<void> {
    const row = this.getBitRowByIndex(bitIndex);
    await row.getByRole('button', { name: /释放/ }).click();
  }

  /**
   * 确认释放位
   */
  async confirmReleaseBit(): Promise<void> {
    await this.page.getByRole('button', { name: /确认/ }).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * 释放全部未使用的位
   */
  async releaseAllUnusedBits(): Promise<void> {
    await this.detailDrawer.getByRole('button', { name: /释放全部未使用的位/ }).click();
  }

  /**
   * 确认释放全部未使用位
   */
  async confirmReleaseAllUnused(): Promise<void> {
    await this.page.getByRole('button', { name: /确认/ }).click();
    await this.page.waitForTimeout(500);
  }

  async getDrawerStats(): Promise<{ total: number; used: number; available: number }> {
    const tags = this.detailDrawer.locator('.ant-space .ant-tag');
    const count = await tags.count();
    
    const parseTag = async (index: number): Promise<number> => {
      if (index >= count) return 0;
      const text = await tags.nth(index).textContent();
      const match = text?.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };
    
    return {
      total: await parseTag(0),
      used: await parseTag(1),
      available: await parseTag(2),
    };
  }
}
