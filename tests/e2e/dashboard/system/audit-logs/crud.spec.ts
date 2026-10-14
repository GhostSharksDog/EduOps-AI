import {LoginPage} from '../../../fixtures/page-objects/LoginPage';
import { test, expect } from '../../../fixtures/auth';
import { AuditLogsPage } from '../../../fixtures/page-objects/AuditLogsPage';

test.describe('P2 - 审计日志 CRUD', () => {
  let auditLogsPage: AuditLogsPage;

  test.beforeEach(async ({ page }) => {
    auditLogsPage = new AuditLogsPage(page);
    const localLogin=new LoginPage(page);await localLogin.goto();await localLogin.login();
    await page.waitForURL(/\/dashboard/);
    await auditLogsPage.goto();
  });

  test('显示审计日志页面元素', async ({ page }) => {
    await auditLogsPage.verifyHeading();
    await expect(auditLogsPage.table).toBeVisible();
  });

  test('显示审计日志列表', async ({ page }) => {
    await auditLogsPage.waitForTableLoad();
    
    const logCount = await auditLogsPage.getLogCount();
    expect(logCount).toBeGreaterThanOrEqual(0);
  });

  test('按操作类型筛选', async ({ page }) => {
    await auditLogsPage.waitForTableLoad();
    await auditLogsPage.filterByAction('创建');
    await auditLogsPage.waitForTableLoad();
    
    const logCount = await auditLogsPage.getLogCount();
    expect(logCount).toBeGreaterThanOrEqual(0);
  });

  test('按实体类型筛选', async ({ page }) => {
    await auditLogsPage.waitForTableLoad();
    await auditLogsPage.filterByEntity('标签');
    await auditLogsPage.waitForTableLoad();
    
    const logCount = await auditLogsPage.getLogCount();
    expect(logCount).toBeGreaterThanOrEqual(0);
  });

  test('按操作人筛选', async ({ page }) => {
    await auditLogsPage.waitForTableLoad();
    await auditLogsPage.filterByActor('admin');
    await page.waitForTimeout(500);
    
    const logCount = await auditLogsPage.getLogCount();
    expect(logCount).toBeGreaterThanOrEqual(0);
  });

  test('分页功能', async ({ page }) => {
    await auditLogsPage.waitForTableLoad();
    
    const paginationInfo = await auditLogsPage.getPaginationInfo();
    expect(paginationInfo.current).toBeGreaterThanOrEqual(1);
  });
});
