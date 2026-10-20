import {afterEach,describe,expect,it,vi} from 'vitest';
import {companyDefinitions,getCompany,getDefaultCompany,companyPostgresUrl,companyClickHouse,listCompanies} from '@/platform/company/registry';
import {runWithCompany,requireCompanyContext,getCompanyContext,clearTestCompanyContext,configureTestCompanyContext,companyCacheKey} from '@/platform/company/context';
import {canAccess} from '@/modules/identity/contracts/local';

const organizations=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
function fixture(){
 const companies=['alpha','beta'].map((code,index)=>({code,name:code,organizationId:organizations[index],databaseUrlEnv:code.toUpperCase()+'_PG',clickhouse:{hostEnv:code.toUpperCase()+'_HOST',portEnv:code.toUpperCase()+'_PORT',userEnv:code.toUpperCase()+'_USER',passwordEnv:code.toUpperCase()+'_PASSWORD',databaseEnv:code.toUpperCase()+'_DATABASE'}}));
 vi.stubEnv('COMPANY_REGISTRY_JSON',JSON.stringify(companies));vi.stubEnv('DEFAULT_COMPANY_CODE','alpha');
 for(const code of ['ALPHA','BETA']){vi.stubEnv(code+'_PG','postgresql://fixture:fixture@127.0.0.1:25432/'+code.toLowerCase()+'_test');vi.stubEnv(code+'_HOST','127.0.0.1');vi.stubEnv(code+'_PORT','28123');vi.stubEnv(code+'_USER',code.toLowerCase());vi.stubEnv(code+'_PASSWORD','fixture');vi.stubEnv(code+'_DATABASE',code.toLowerCase()+'_test');}
 return companies;
}
afterEach(()=>{clearTestCompanyContext();vi.unstubAllEnvs();});
describe('公司注册表与受控异步上下文',()=>{
 it('公开公司列表不包含机构编号、连接或凭据',()=>{fixture();expect(listCompanies()).toEqual({companies:[{code:'alpha',name:'alpha'},{code:'beta',name:'beta'}],defaultCompanyCode:'alpha'});});
 it('并发公司请求不会污染相邻请求；缺上下文拒绝数据访问',async()=>{
  fixture();clearTestCompanyContext();expect(()=>requireCompanyContext()).toThrow('拒绝');
  const seen=await Promise.all(['alpha','beta'].map(code=>runWithCompany(code,async()=>{await Promise.resolve();await new Promise(resolve=>setTimeout(resolve,2));return requireCompanyContext().company.code;})));
  expect(seen).toEqual(['alpha','beta']);expect(getCompanyContext()).toBeUndefined();
 });
 it('拒绝伪造身份、未知公司和重复公司编号',()=>{const companies=fixture();expect(()=>runWithCompany('alpha',()=>{}, {userId:'x',organizationId:organizations[1],role:'admin'})).toThrow('不一致');expect(()=>getCompany('missing')).toThrow('不存在');companies[1].organizationId=organizations[0];vi.stubEnv('COMPANY_REGISTRY_JSON',JSON.stringify(companies));expect(()=>companyDefinitions()).toThrow('不能重复');});
 it('不同公司不允许共用 PG 或 ClickHouse 数据库，即使账号不同',()=>{fixture();vi.stubEnv('BETA_PG','postgresql://other:other@127.0.0.1:25432/alpha_test');expect(()=>companyPostgresUrl(getCompany('alpha'))).toThrow('同一 PostgreSQL');vi.stubEnv('BETA_PG','postgresql://fixture:fixture@127.0.0.1:25432/beta_test');vi.stubEnv('BETA_DATABASE','alpha_test');expect(()=>companyClickHouse(getCompany('alpha'))).toThrow('同一 ClickHouse');});
 it('显式测试上下文只能连接两个专用 _test 库',()=>{fixture();configureTestCompanyContext('alpha');expect(requireCompanyContext().company.code).toBe('alpha');clearTestCompanyContext();vi.stubEnv('ALPHA_DATABASE','production');expect(()=>configureTestCompanyContext('alpha')).toThrow('_test');vi.stubEnv('NODE_ENV','production');expect(()=>configureTestCompanyContext('alpha')).toThrow('_test');});
 it('缓存键包含公司与账号，默认公司不存在时不静默回退',()=>{fixture();const a=runWithCompany('alpha',()=>companyCacheKey('same'),{userId:'user-a',organizationId:organizations[0],role:'viewer'});const b=runWithCompany('beta',()=>companyCacheKey('same'),{userId:'user-a',organizationId:organizations[1],role:'viewer'});expect(a).not.toBe(b);expect(a).toContain('user:user-a');vi.stubEnv('DEFAULT_COMPANY_CODE','missing');expect(()=>getDefaultCompany()).toThrow('DEFAULT_COMPANY_CODE');});
 it('注册表不能直接填写连接凭据；只读角色允许问答而不能确认计划',()=>{const companies=fixture();(companies[0] as Record<string,unknown>).password='do-not-publish';vi.stubEnv('COMPANY_REGISTRY_JSON',JSON.stringify(companies));expect(()=>companyDefinitions()).toThrow('字段');expect(canAccess('viewer','POST','/api/agent/runs')).toBe(true);expect(canAccess('viewer','POST','/api/agent/actions/confirm')).toBe(false);});
});
