import {LoginPage} from '../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../fixtures/auth';
import { SegmentDetailPage } from '../../fixtures/page-objects/SegmentDetailPage';

test.describe('P1 - 分群详情页', () => {
  let detailPage: SegmentDetailPage;
  const testSegmentId = 'seg-001';

  test.beforeEach(async ({ page }) => {
    detailPage = new SegmentDetailPage(page, testSegmentId);
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
    await detailPage.goto();
  });

  test('显示分群详情页面元素', async ({ page }) => {
    await detailPage.verifyHeading();
    await expect(detailPage.breadcrumb).toBeVisible();
  });

  test('查看基本信息 Tab', async ({ page }) => {
    await detailPage.switchToConfig();
    await expect(page.getByRole('tab', { name: /基本信息|配置/i })).toHaveAttribute('aria-selected', 'true');
  });

  test('查看成员列表 Tab', async ({ page }) => {
    await detailPage.switchToMemberList();
    await expect(detailPage.memberTable).toBeVisible();
  });

  test('查看画像分析 Tab', async ({ page }) => {
    await detailPage.switchToPortrait();
    await expect(page.locator('.ant-card, .chart-container').first()).toBeVisible();
  });

  test('返回列表', async ({ page }) => {
    await detailPage.goBack();
    await expect(page).toHaveURL(/\/dashboard\/segments$/);
  });

  test('编辑分群', async ({ page }) => {
    await detailPage.clickEdit();
    await expect(page.locator('.ant-drawer, .ant-modal')).toBeVisible();
  });

  test('导出成员', async ({ page }) => {
    await detailPage.switchToMemberList();
    await detailPage.waitForTableLoad();
    
    const rowCount = await detailPage.getMemberCount();
    if (parseInt(rowCount) > 0) {
      await detailPage.exportMembers();
    }
  });
});
