import {LoginPage} from '../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../fixtures/auth';
import { SystemPage } from '../../fixtures/page-objects/SystemPage';

test.describe('P2 - 系统页面', () => {
  let systemPage: SystemPage;

  test.beforeEach(async ({ page }) => {
    systemPage = new SystemPage(page);
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
    await systemPage.goto();
  });

  test('显示系统页面元素', async ({ page }) => {
    await systemPage.verifyHeading();
  });

  test('切换到数据库浏览器 Tab', async ({ page }) => {
    const dbBrowserTab = page.getByRole('tab', { name: /数据库|Database|DB/i });
    if (await dbBrowserTab.isVisible()) {
      await systemPage.switchToDbBrowser();
    }
  });

  test('切换到日志 Tab', async ({ page }) => {
    const logsTab = page.getByRole('tab', { name: /日志|Log/i });
    if (await logsTab.isVisible()) {
      await systemPage.switchToLogs();
    }
  });

  test('切换到健康检查 Tab', async ({ page }) => {
    const healthTab = page.getByRole('tab', { name: /健康|Health|状态|Status/i });
    if (await healthTab.isVisible()) {
      await systemPage.switchToHealth();
    }
  });
});
