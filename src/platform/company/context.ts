import 'server-only';
import {AsyncLocalStorage} from 'node:async_hooks';
import {getCompany,companyPostgresUrl,companyClickHouse,type CompanyDefinition,CompanyConfigurationError} from './registry';

export interface CompanyActor {userId:string;organizationId:string;role:string;}
export interface CompanyContext {company:CompanyDefinition;actor?:CompanyActor;}
const globalState=globalThis as typeof globalThis&{eduOpsCompanyStorage?:AsyncLocalStorage<CompanyContext>;eduOpsTestCompany?:CompanyContext};
const storage=globalState.eduOpsCompanyStorage??=new AsyncLocalStorage<CompanyContext>();
export function getCompanyContext(){return storage.getStore()??(process.env.NODE_ENV==='test'?globalState.eduOpsTestCompany:undefined);}
// 仅测试入口可显式安装专用库上下文；应用运行绝不隐式选择数据库。
export function configureTestCompanyContext(code:string){
 const company=getCompany(code);
 if(process.env.NODE_ENV!=='test'||!new URL(companyPostgresUrl(company)).pathname.endsWith('_test')||!companyClickHouse(company).database.endsWith('_test'))throw new CompanyConfigurationError('测试上下文仅允许专用 PostgreSQL 与 ClickHouse _test 数据库');
 globalState.eduOpsTestCompany={company};
}
export function clearTestCompanyContext(){if(process.env.NODE_ENV==='test')delete globalState.eduOpsTestCompany;}
export function requireCompanyContext():CompanyContext {
 const context=getCompanyContext();if(!context)throw new CompanyConfigurationError('缺少已验证的公司上下文，数据访问已拒绝');return context;
}
export function runWithCompany<T>(code:string,work:()=>T,actor?:CompanyActor):T {
 const company=getCompany(code);if(actor&&actor.organizationId!==company.organizationId)throw new CompanyConfigurationError('身份与公司不一致，数据访问已拒绝');
 return storage.run({company,actor},work);
}
export function companyCacheKey(key:string):string {
 const {company,actor}=requireCompanyContext();return `company:${company.code}:user:${actor?.userId??'service'}:${key}`;
}
