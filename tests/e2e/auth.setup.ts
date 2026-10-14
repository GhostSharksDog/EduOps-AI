import {test as setup,expect} from '@playwright/test';
import {LoginPage} from './fixtures/page-objects/LoginPage';
setup('本地测试账号登录',async({page, request})=>{
 const health=await request.get('/api/health');
 if(!(await health.json()).testMode)throw new Error('只允许隔离的测试应用');
 const login=new LoginPage(page);await login.goto();await login.login();expect(await login.isLoggedIn()).toBe(true);
 await page.context().storageState({path:'.auth/user.json'});
});
