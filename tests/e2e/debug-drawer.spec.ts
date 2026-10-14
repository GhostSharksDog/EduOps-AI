import { test } from './fixtures/auth';

test('Debug drawer issue', async ({ page }) => {
  await page.goto('/dashboard/tags/categories');
  await page.waitForLoadState('networkidle');
  
  // 点击按钮
  await page.getByRole('button', { name: /新建/ }).click();
  
  // 等待 React 状态更新
  await page.waitForTimeout(2000);
  
  // 检查 drawer
  const drawer = page.locator('.ant-drawer');
  const drawerCount = await drawer.count();
  console.log('Drawer count:', drawerCount);
  
  // 检查页面 HTML
  const html = await page.content();
  console.log('HTML contains ant-drawer:', html.includes('ant-drawer'));
  
  // 截图
  await page.screenshot({ path: 'debug-drawer.png', fullPage: true });
});
