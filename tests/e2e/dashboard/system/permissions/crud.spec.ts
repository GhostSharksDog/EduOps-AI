import {test, expect} from '@playwright/test';
import {LoginPage} from '../../../fixtures/page-objects/LoginPage';

test('本地管理员查看账号和固定角色', async ({page}) => {
  await new LoginPage(page).loginFlow();
  await page.goto('/dashboard/system/permissions');
  await expect(page.getByRole('heading', {name: '账号与权限', exact: true})).toBeVisible();
  await expect(page.getByRole('columnheader', {name: '用户名', exact: true})).toBeVisible();
  await expect(page.getByRole('columnheader', {name: '角色', exact: true})).toBeVisible();
  await expect(page.getByRole('cell', {name: process.env.TEST_USERNAME!, exact: true})).toBeVisible();
  await expect(page.locator('.ant-alert-error')).toHaveCount(0);
});
