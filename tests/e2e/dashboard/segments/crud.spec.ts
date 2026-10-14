import {test, expect} from '@playwright/test';
import {LoginPage} from '../../fixtures/page-objects/LoginPage';

test('人群列表进入人工确认的风险人群', async ({page}) => {
  await new LoginPage(page).loginFlow();
  await page.goto('/dashboard/segments');
  await expect(page.getByRole('heading', {name: /人群管理$/})).toBeVisible();
  await page.getByRole('button', {name: '出勤风险人群', exact: true}).click();
  await expect(page.getByRole('heading', {name: '出勤风险人群', exact: true})).toBeVisible();
  await expect(page.getByRole('columnheader', {name: '标签版本', exact: true})).toBeVisible();
  await expect(page.getByRole('columnheader', {name: '人数', exact: true})).toBeVisible();
  await expect(page.locator('.ant-alert-error')).toHaveCount(0);
});
