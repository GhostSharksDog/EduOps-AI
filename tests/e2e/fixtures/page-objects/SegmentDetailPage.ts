import { Page, Locator } from '@playwright/test';
import { BaseDashboardPage } from './BaseDashboardPage';

/**
 * 分群详情页 Page Object
 * Route: /dashboard/segments/[id]
 */
export class SegmentDetailPage extends BaseDashboardPage {
  readonly backButton: Locator;
  readonly editButton: Locator;
  readonly memberListTab: Locator;
  readonly portraitTab: Locator;
  readonly configTab: Locator;
  readonly breadcrumb: Locator;
  readonly detailCard: Locator;
  readonly exportButton: Locator;
  readonly memberTable: Locator;

  constructor(page: Page, segmentId: string) {
    super(page, `/dashboard/segments/${segmentId}`, '分群详情');
    this.backButton = page.getByRole('button', { name: /返回|Back/i });
    this.editButton = page.getByRole('button', { name: /编辑|Edit/i });
    this.memberListTab = page.getByRole('tab', { name: /成员列表|Members/i });
    this.portraitTab = page.getByRole('tab', { name: /画像分析|Portrait/i });
    this.configTab = page.getByRole('tab', { name: /配置详情|Config/i });
    this.breadcrumb = page.locator('.ant-breadcrumb');
    this.detailCard = page.locator('.ant-card').first();
    this.exportButton = page.getByRole('button', { name: /导出|Export/i });
    this.memberTable = page.locator('.ant-table');
  }

  async navigateTo(segmentId: string): Promise<void> {
    await this.page.goto(`/dashboard/segments/${segmentId}`);
    await this.page.waitForLoadState('networkidle');
  }

  async goBack(): Promise<void> {
    await this.backButton.click();
  }

  async clickEdit(): Promise<void> {
    await this.editButton.click();
    await this.waitForDrawer();
  }

  async switchToMemberList(): Promise<void> {
    await this.memberListTab.click();
  }

  async switchToPortrait(): Promise<void> {
    await this.portraitTab.click();
  }

  async switchToConfig(): Promise<void> {
    await this.configTab.click();
  }

  async exportMembers(): Promise<void> {
    await this.exportButton.click();
  }

  async getMemberCount(): Promise<string> {
    const countText = await this.page.locator('.member-count, .total-count').textContent();
    return countText || '0';
  }

  async getSegmentName(): Promise<string> {
    const title = await this.page.locator('.ant-page-header-heading-title').textContent();
    return title || '';
  }

  async getSegmentStatus(): Promise<string> {
    const status = await this.page.locator('.ant-tag').first().textContent();
    return status || '';
  }
}
