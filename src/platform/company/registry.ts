import 'server-only';

export interface CompanyDefinition {
 code:string;name:string;organizationId:string;databaseUrlEnv:string;
 clickhouse:{hostEnv:string;portEnv:string;userEnv:string;passwordEnv:string;databaseEnv:string;clusterEnv?:string;replicatedDbEnv?:string};
}
export interface CompanyClickHouse {host:string;port:number;user:string;password:string;database:string;cluster:string;replicatedDb:boolean;}
export class CompanyConfigurationError extends Error {
 readonly code='COMPANY_CONFIGURATION_ERROR';
 constructor(message='公司数据库配置未就绪，请联系管理员'){super(message);this.name='CompanyConfigurationError';}
}
const legacyOrganizationId='6f40f555-5f1b-4d1f-807c-b209e817bfdd';
const reference=/^[A-Z][A-Z0-9_]*$/;
const companyCode=/^[a-z][a-z0-9_-]{0,63}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hostIdentity=(host:string)=>['localhost','127.0.0.1','[::1]','::1'].includes(host.toLowerCase())?'loopback':host.toLowerCase();

// 注册表只保存配置引用，禁止在 JSON 内携带连接值或密钥。
export function companyDefinitions(environment:NodeJS.ProcessEnv=process.env):CompanyDefinition[]{
 if(!environment.COMPANY_REGISTRY_JSON){const organizationId=(environment.SYSTEM_USER_ID||legacyOrganizationId).toLowerCase();if(!uuid.test(organizationId))throw new CompanyConfigurationError('默认公司的机构编号必须是有效 UUID');return [{code:'main',name:environment.DEFAULT_COMPANY_NAME?.trim()||'默认机构',organizationId,databaseUrlEnv:'DATABASE_URL',clickhouse:{hostEnv:'CLICKHOUSE_HOST',portEnv:'CLICKHOUSE_PORT',userEnv:'CLICKHOUSE_USER',passwordEnv:'CLICKHOUSE_PASSWORD',databaseEnv:'CLICKHOUSE_DATABASE',clusterEnv:'CLICKHOUSE_CLUSTER',replicatedDbEnv:'CLICKHOUSE_REPLICATED_DB'}}];}
 let raw:unknown;try{raw=JSON.parse(environment.COMPANY_REGISTRY_JSON);}catch{throw new CompanyConfigurationError('公司注册表格式不正确');}
 if(!Array.isArray(raw)||!raw.length||raw.length>100)throw new CompanyConfigurationError('公司注册表需要一至一百家公司');
 const codes=new Set<string>(),organizations=new Set<string>();
 return raw.map(value=>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new CompanyConfigurationError('公司注册表内容不正确');
  const item=value as Record<string,unknown>,ch=item.clickhouse;
  if(Object.keys(item).some(key=>!['code','name','organizationId','databaseUrlEnv','clickhouse'].includes(key))||typeof item.code!=='string'||!companyCode.test(item.code)||typeof item.name!=='string'||!item.name.trim()||item.name.length>100||typeof item.organizationId!=='string'||!uuid.test(item.organizationId)||typeof item.databaseUrlEnv!=='string'||!reference.test(item.databaseUrlEnv)||!ch||typeof ch!=='object'||Array.isArray(ch))throw new CompanyConfigurationError('公司注册表字段不正确');
  const fields=ch as Record<string,unknown>,required=['hostEnv','portEnv','userEnv','passwordEnv','databaseEnv'];
  if(Object.keys(fields).some(key=>![...required,'clusterEnv','replicatedDbEnv'].includes(key))||required.some(key=>typeof fields[key]!=='string'||!reference.test(fields[key] as string))||['clusterEnv','replicatedDbEnv'].some(key=>fields[key]!==undefined&&(typeof fields[key]!=='string'||!reference.test(fields[key] as string))))throw new CompanyConfigurationError('公司连接必须使用服务端环境配置引用');
  if(codes.has(item.code)||organizations.has(item.organizationId.toLowerCase()))throw new CompanyConfigurationError('公司代码和机构编号不能重复');
  codes.add(item.code);organizations.add(item.organizationId.toLowerCase());return {...item,name:item.name.trim(),organizationId:item.organizationId.toLowerCase()} as unknown as CompanyDefinition;
 });
}
export function getDefaultCompany(environment:NodeJS.ProcessEnv=process.env):CompanyDefinition {
 const entries=companyDefinitions(environment),code=environment.DEFAULT_COMPANY_CODE||'main',company=entries.find(item=>item.code===code);
 if(!company)throw new CompanyConfigurationError('请配置注册表中存在的 DEFAULT_COMPANY_CODE');return company;
}
export function getCompany(code:string,environment:NodeJS.ProcessEnv=process.env):CompanyDefinition {
 const company=companyDefinitions(environment).find(item=>item.code===code);if(!company)throw new CompanyConfigurationError('所选公司不存在或尚未配置');return company;
}
export function getCompanyByOrganization(organizationId:string,environment:NodeJS.ProcessEnv=process.env):CompanyDefinition {
 const company=companyDefinitions(environment).find(item=>item.organizationId===organizationId.toLowerCase());if(!company)throw new CompanyConfigurationError('账号所属公司未登记');return company;
}
export function listCompanies(){return {companies:companyDefinitions().map(({code,name})=>({code,name})),defaultCompanyCode:getDefaultCompany().code};}
function required(environment:NodeJS.ProcessEnv,key:string){const value=environment[key]?.trim();if(!value)throw new CompanyConfigurationError();return value;}
export function companyPostgresUrl(company:CompanyDefinition,environment:NodeJS.ProcessEnv=process.env):string {
 const value=required(environment,company.databaseUrlEnv);let parsed:URL;try{parsed=new URL(value);}catch{throw new CompanyConfigurationError();}
 if(!['postgres:','postgresql:'].includes(parsed.protocol)||!parsed.hostname||parsed.pathname.length<2||['host','port','database','dbname','user','password'].some(key=>parsed.searchParams.has(key)))throw new CompanyConfigurationError();
 const identity=(url:URL)=>`${hostIdentity(url.hostname)}:${url.port||5432}${decodeURIComponent(url.pathname)}`;
 // 不同用户或参数指向同一库仍然不是独立公司数据库。
 for(const other of companyDefinitions(environment)){if(other.code===company.code)continue;const otherValue=environment[other.databaseUrlEnv];if(!otherValue)continue;try{if(identity(new URL(otherValue))===identity(parsed))throw new CompanyConfigurationError('不同公司不能配置为同一 PostgreSQL 数据库');}catch(error){if(error instanceof CompanyConfigurationError)throw error;}}
 return value;
}
export function companyClickHouse(company:CompanyDefinition,environment:NodeJS.ProcessEnv=process.env):CompanyClickHouse {
 const references=company.clickhouse,legacy=!environment.COMPANY_REGISTRY_JSON;
 const host=environment[references.hostEnv]?.trim()||(legacy?'localhost':required(environment,references.hostEnv));
 const port=Number(environment[references.portEnv]||(legacy?'8123':required(environment,references.portEnv)));
 const user=environment[references.userEnv]?.trim()||(legacy?'default':required(environment,references.userEnv));
 const database=environment[references.databaseEnv]?.trim()||(legacy?'default':required(environment,references.databaseEnv));
 if(!Number.isInteger(port)||port<1||port>65535||!/^[A-Za-z_][A-Za-z0-9_]*$/.test(database)||environment[references.passwordEnv]===undefined&&!legacy)throw new CompanyConfigurationError();
 const endpoint=(h:string,p:number,d:string)=>{let url:URL;try{url=new URL(/^https?:\/\//.test(h)?h:`http://${h}:${p}`);}catch{throw new CompanyConfigurationError();}if(url.username||url.password||url.search||url.hash||!['http:','https:'].includes(url.protocol))throw new CompanyConfigurationError();return `${url.protocol}//${hostIdentity(url.hostname)}:${url.port||(url.protocol==='https:'?'443':'80')}/${d}`;};
 const selected=endpoint(host,port,database);
 for(const other of companyDefinitions(environment)){if(other.code===company.code)continue;const r=other.clickhouse,otherHost=environment[r.hostEnv],otherPort=Number(environment[r.portEnv]),otherDatabase=environment[r.databaseEnv];if(otherHost&&otherPort&&otherDatabase&&endpoint(otherHost,otherPort,otherDatabase)===selected)throw new CompanyConfigurationError('不同公司不能配置为同一 ClickHouse 数据库');}
 return {host,port,user,password:environment[references.passwordEnv]??'',database,cluster:references.clusterEnv?environment[references.clusterEnv]??'':'',replicatedDb:!!references.replicatedDbEnv&&environment[references.replicatedDbEnv]==='true'};
}
