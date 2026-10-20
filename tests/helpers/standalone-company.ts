import {getDefaultCompany,companyPostgresUrl,companyClickHouse} from '../../src/platform/company/registry';
import {runWithCompany} from '../../src/platform/company/context';
/** 独立验收工具必须显式绑定测试公司，不使用应用中的测试回退或正常库连接。 */
export function runStandaloneTestCompany<T>(work:()=>Promise<T>):Promise<T>{
 const company=getDefaultCompany(),url=new URL(companyPostgresUrl(company)),events=companyClickHouse(company);
 if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port!=='25432'||!url.pathname.endsWith('_test')||!['127.0.0.1','localhost'].includes(events.host)||events.port!==28123||!events.database.endsWith('_test'))throw Error('独立验收仅允许25432/28123专用_test公司连接');
 return runWithCompany(company.code,work);
}
