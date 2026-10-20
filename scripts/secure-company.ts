import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {readFile,writeFile,rename,unlink,lstat,realpath} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {config as loadEnv} from 'dotenv';
import {Pool} from 'pg';
import {companyDefinitions,companyPostgresUrl,companyClickHouse,getCompany,type CompanyDefinition,type CompanyClickHouse} from '../src/platform/company/registry';

class SecurityFailure extends Error {constructor(message:string){super(message);this.name='SecurityFailure';}}
const scriptFile=typeof __filename==='string'?__filename:resolve(process.cwd(),'scripts/secure-company.ts');
const pgIdentifier=(value:string)=>{if(!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(value))throw new SecurityFailure('数据库及运行账号名称须使用简单标识符');return '"'+value+'"';};
const chIdentifier=(value:string)=>{if(!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(value))throw new SecurityFailure('数据库及运行账号名称须使用简单标识符');return '`'+value+'`';};
const literal=(value:string)=>"'"+value.replaceAll('\\','\\\\').replaceAll("'","''")+"'";
const sameHost=(a:string,b:string)=>{const normalized=(s:string)=>['localhost','127.0.0.1','::1','[::1]'].includes(s.toLowerCase())?'loopback':s.toLowerCase();return normalized(a)===normalized(b);};
const endpoint=(host:string,port:number)=>new URL(/^https?:\/\//.test(host)?host:`http://${host}:${port}`);
function clickhouse(configuration:Pick<CompanyClickHouse,'host'|'port'|'user'|'password'>){
 const target=endpoint(configuration.host,configuration.port);
 return async(sql:string)=>{
  const response=await fetch(target,{method:'POST',headers:{'X-ClickHouse-User':configuration.user,'X-ClickHouse-Key':configuration.password,'Content-Type':'text/plain'},body:sql,signal:AbortSignal.timeout(30000)});
  if(!response.ok){const providerCode=(await response.text()).match(/Code:\s*(\d+)/)?.[1]??'unknown',operation=sql.trim().split(/\s+/).slice(0,2).join(' ');throw new SecurityFailure('ClickHouse 权限或连接核验失败（'+operation+'，HTTP '+response.status+'，状态 '+providerCode+'）；原始响应及凭据未输出');}return response.text();
 };
}
const runtimePermissions='SELECT,INSERT,ALTER,CREATE TABLE,CREATE VIEW,DROP TABLE,DROP VIEW,TRUNCATE';
type SafeMetadata={companyCode:string;postgresDatabase:string;clickhouseDatabase:string;postgresRole:string;clickhouseUser:string;configured:boolean;alreadyScoped:boolean};
export interface CompanySecurityResult {metadata:SafeMetadata;environmentUpdates:Record<string,string>;}
async function pgScoped(pool:Pool,company:CompanyDefinition,environment:NodeJS.ProcessEnv){
 const role=await pool.query<{rolsuper:boolean;rolcreatedb:boolean;rolcreaterole:boolean;rolreplication:boolean;rolbypassrls:boolean}>(`SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user`);
 if(!role.rows[0]||Object.values(role.rows[0]).some(Boolean))return false;
 const memberships=await pool.query<{count:string}>('SELECT count(*)::text FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)');if(Number(memberships.rows[0].count))return false;
 const tables=await pool.query<{ready:boolean}>(`SELECT to_regclass('public.local_user') IS NOT NULL AND has_database_privilege(current_user,current_database(),'CONNECT') AND has_database_privilege(current_user,current_database(),'TEMP') AND has_schema_privilege(current_user,'public','USAGE') AND has_schema_privilege(current_user,'public','CREATE') AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT (has_table_privilege(current_user,c.oid,'SELECT') AND has_table_privilege(current_user,c.oid,'INSERT') AND has_table_privilege(current_user,c.oid,'UPDATE') AND has_table_privilege(current_user,c.oid,'DELETE') AND has_table_privilege(current_user,c.oid,'TRUNCATE'))) AS ready`);
 if(!tables.rows[0]?.ready)return false;
 const current=new URL(companyPostgresUrl(company,environment));
 for(const other of companyDefinitions(environment)){
  if(other.code===company.code||!environment[other.databaseUrlEnv])continue;const target=new URL(companyPostgresUrl(other,environment));
  if(sameHost(target.hostname,current.hostname)&&(target.port||'5432')===(current.port||'5432')){
   const database=decodeURIComponent(target.pathname.slice(1)),exists=await pool.query('SELECT 1 FROM pg_database WHERE datname=$1',[database]);
   if(exists.rowCount){const accessible=await pool.query<{allowed:boolean}>('SELECT has_database_privilege(current_user,$1,\'CONNECT\') AS allowed',[database]);if(accessible.rows[0].allowed)throw new SecurityFailure('另一已登记公司数据库仍允许此账号连接，请先独立收紧该库的 PUBLIC CONNECT 权限');}
  }
 }
 return true;
}
async function chScoped(configuration:CompanyClickHouse){
 // SHOW GRANTS also works on the project's ClickHouse 24.8; newer CHECK GRANT is not required.
 const grants=(await clickhouse(configuration)('SHOW GRANTS')).split(/\r?\n/).filter(Boolean),privileges:string[]=[];
 for(const grant of grants){
  const target=grant.match(/\bON\s+(\S+)\s+TO\b/i)?.[1]?.replaceAll('`',''),items=grant.match(/^GRANT\s+(.+?)\s+ON\b/i)?.[1]?.split(',').map(s=>s.trim().toUpperCase());
  if(target==='*.*'&&items?.every(item=>item==='USAGE'))continue;
  if(!target||target!==configuration.database+'.*'||!items||/WITH GRANT OPTION|WITH ADMIN OPTION/i.test(grant))return false;
  privileges.push(...items);
 }
 const has=(kind:string)=>privileges.some(p=>p===kind||kind==='ALTER'&&p.startsWith('ALTER TABLE'));
 return ['SELECT','INSERT','ALTER','CREATE TABLE','DROP TABLE','TRUNCATE'].every(has);
}
async function verifyRuntime(pool:Pool,configuration:CompanyClickHouse,company:CompanyDefinition,environment:NodeJS.ProcessEnv,probe:boolean){
 if(!await pgScoped(pool,company,environment)||!await chScoped(configuration))throw new SecurityFailure('运行账号权限尚未限定到本公司，配置未改写');
 if(!probe)return;
 // The PostgreSQL probe is rolled back; no existing business row or owner changes.
 const client=await pool.connect(),name='__eduops_acl_'+randomUUID().replaceAll('-','');
 try{await client.query('BEGIN');await client.query(`CREATE TABLE public.${pgIdentifier(name)} (id integer PRIMARY KEY,value integer)`);await client.query(`INSERT INTO public.${pgIdentifier(name)} VALUES(1,1)`);await client.query(`UPDATE public.${pgIdentifier(name)} SET value=2 WHERE id=1`);const rows=await client.query<{value:number}>(`SELECT value FROM public.${pgIdentifier(name)} WHERE id=1`);if(rows.rows[0]?.value!==2)throw new SecurityFailure('PostgreSQL 独立账号读写验证未通过');await client.query(`DELETE FROM public.${pgIdentifier(name)} WHERE id=1`);await client.query(`TRUNCATE public.${pgIdentifier(name)}`);}finally{await client.query('ROLLBACK').catch(()=>{});client.release();}
 const query=clickhouse(configuration),table=chIdentifier(configuration.database)+'.'+chIdentifier(name);let created=false;
 try{await query(`CREATE TABLE ${table} (id UInt32,value UInt32) ENGINE=Memory`);created=true;await query(`INSERT INTO ${table} VALUES(1,2)`);await query(`ALTER TABLE ${table} ADD COLUMN checked UInt8 DEFAULT 1`);if(Number((await query(`SELECT value FROM ${table} WHERE id=1`)).trim())!==2)throw new SecurityFailure('ClickHouse 独立账号读写验证未通过');await query(`TRUNCATE TABLE ${table}`);if(Number((await query(`SELECT count() FROM ${table}`)).trim())!==0)throw new SecurityFailure('ClickHouse 独立账号清理验证未通过');}finally{if(created)await query(`DROP TABLE ${table}`);}
}
/** Credentials stay in memory for the caller to persist; never log this result directly. */
export async function secureRegisteredCompany(code:string,environment:NodeJS.ProcessEnv,allowProvision=false,persist?:(updates:Record<string,string>)=>Promise<void>):Promise<CompanySecurityResult>{
 const company=getCompany(code,environment),target=new URL(companyPostgresUrl(company,environment)),currentCH=companyClickHouse(company,environment),database=decodeURIComponent(target.pathname.slice(1)),currentRole=decodeURIComponent(target.username);
 pgIdentifier(database);pgIdentifier(currentRole);chIdentifier(currentCH.database);chIdentifier(currentCH.user);
 if(['postgres','template0','template1'].includes(database))throw new SecurityFailure('安全配置仅用于已登记的业务数据库');
 const currentPG=new Pool({connectionString:target.toString(),connectionTimeoutMillis:10000});
 try{
  if(await pgScoped(currentPG,company,environment)&&await chScoped(currentCH)){
   await verifyRuntime(currentPG,currentCH,company,environment,false);return {metadata:{companyCode:code,postgresDatabase:database,clickhouseDatabase:currentCH.database,postgresRole:currentRole,clickhouseUser:currentCH.user,configured:false,alreadyScoped:true},environmentUpdates:{}};
  }
 }finally{await currentPG.end();}
 if(!allowProvision)throw new SecurityFailure('当前连接仍有管理员权限；请通过 --company 指定公司并添加 --configure-local 创建专用运行账号');
 const pgAdminValue=environment.COMPANY_PG_ADMIN_URL,chHost=environment.COMPANY_CH_ADMIN_HOST,chPort=Number(environment.COMPANY_CH_ADMIN_PORT),chUser=environment.COMPANY_CH_ADMIN_USER,chPassword=environment.COMPANY_CH_ADMIN_PASSWORD;
 if(!pgAdminValue||!chHost||!chPort||!chUser||chPassword===undefined)throw new SecurityFailure('请仅在部署进程配置 COMPANY_PG_ADMIN_URL 和 COMPANY_CH_ADMIN_* 管理员连接');
 const pgAdmin=new URL(pgAdminValue),adminEndpoint=endpoint(chHost,chPort),targetEndpoint=endpoint(currentCH.host,currentCH.port);
 if(!sameHost(pgAdmin.hostname,target.hostname)||(pgAdmin.port||'5432')!==(target.port||'5432')||!sameHost(adminEndpoint.hostname,targetEndpoint.hostname)||(adminEndpoint.port||'80')!==(targetEndpoint.port||'80')||adminEndpoint.protocol!==targetEndpoint.protocol)throw new SecurityFailure('部署管理员必须与所选公司的数据库服务一致');
 pgAdmin.pathname='/'+database;const admin=new Pool({connectionString:pgAdmin.toString(),connectionTimeoutMillis:10000}),chAdmin=clickhouse({host:chHost,port:chPort,user:chUser,password:chPassword});
 const suffix=createHash('sha256').update(code).digest('hex').slice(0,6),role='eduops_'+code.replaceAll('-','_').slice(0,30)+'_'+suffix+'_runtime';pgIdentifier(role);chIdentifier(role);
 const pgPassword=randomBytes(32).toString('base64url'),chRuntimePassword=randomBytes(32).toString('base64url');let pgCreated=false,chCreated=false,publicConnected=false;
 const prefix=code==='main'?'MAIN':'COMPANY_'+code.replaceAll('-','_').toUpperCase()+'_'+suffix.toUpperCase(),runtimeUrl=new URL(target);runtimeUrl.username=role;runtimeUrl.password=pgPassword;
 const definitions=companyDefinitions(environment),replacement:CompanyDefinition={...company,databaseUrlEnv:prefix+'_PG_URL',clickhouse:{...company.clickhouse,userEnv:prefix+'_CH_USER',passwordEnv:prefix+'_CH_PASSWORD'}};
 const updates:Record<string,string>={[replacement.databaseUrlEnv]:runtimeUrl.toString(),[replacement.clickhouse.userEnv]:role,[replacement.clickhouse.passwordEnv]:chRuntimePassword,COMPANY_REGISTRY_JSON:JSON.stringify(definitions.map(entry=>entry.code===code?replacement:entry))};
 if(!environment[replacement.clickhouse.hostEnv])updates[replacement.clickhouse.hostEnv]=currentCH.host;if(!environment[replacement.clickhouse.portEnv])updates[replacement.clickhouse.portEnv]=String(currentCH.port);if(!environment[replacement.clickhouse.databaseEnv])updates[replacement.clickhouse.databaseEnv]=currentCH.database;
 const runtimeEnvironment={...environment,...updates},runtimeCompany=getCompany(code,runtimeEnvironment),runtimeCH={...currentCH,user:role,password:chRuntimePassword};
 let runtimePG:Pool|undefined;
 try{
  const administrator=await admin.query<{rolsuper:boolean}>('SELECT rolsuper FROM pg_roles WHERE rolname=current_user');if(!administrator.rows[0]?.rolsuper)throw new SecurityFailure('PostgreSQL 部署账号需要管理既有表授权的超级用户权限');
  const exists=await admin.query(`SELECT to_regclass('public.local_user') IS NOT NULL AS present`);if(!exists.rows[0]?.present)throw new SecurityFailure('公司数据库尚无有效业务结构，空库请使用 company:init');
  const adminGrants=(await chAdmin('SHOW GRANTS')).split(/\r?\n/).filter(Boolean);
  if(!adminGrants.some(grant=>/\bON\s+\*\.\*\s+TO\b/.test(grant)&&/ALL|ACCESS MANAGEMENT|CREATE USER/.test(grant)&&/WITH GRANT OPTION/.test(grant)))throw new SecurityFailure('ClickHouse 部署账号缺少创建运行账号及授予本库权限的权限');
  if(Number((await chAdmin(`SELECT count() FROM system.databases WHERE name=${literal(currentCH.database)}`)).trim())!==1)throw new SecurityFailure('所选 ClickHouse 业务数据库不存在');
  const old=await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role]);if(old.rowCount||Number((await chAdmin(`SELECT count() FROM system.users WHERE name=${literal(role)}`)).trim()))throw new SecurityFailure('专用运行账号已存在但未登记；拒绝覆盖密码或权限，请管理员核对已有记录');
  const acl=await admin.query<{allowed:boolean}>(`SELECT EXISTS(SELECT 1 FROM pg_database d CROSS JOIN LATERAL aclexplode(COALESCE(d.datacl,acldefault('d',d.datdba))) a WHERE d.datname=$1 AND a.grantee=0 AND a.privilege_type='CONNECT') AS allowed`,[database]);publicConnected=!!acl.rows[0]?.allowed;
  await admin.query(`CREATE ROLE ${pgIdentifier(role)} LOGIN PASSWORD ${literal(pgPassword)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);pgCreated=true;
  await admin.query(`GRANT CONNECT,TEMP ON DATABASE ${pgIdentifier(database)} TO ${pgIdentifier(role)}`);
  await admin.query(`GRANT USAGE,CREATE ON SCHEMA public TO ${pgIdentifier(role)}`);
  await admin.query(`GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE ON ALL TABLES IN SCHEMA public TO ${pgIdentifier(role)}`);
  await admin.query(`GRANT USAGE,SELECT,UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${pgIdentifier(role)}`);
  const owners=await admin.query<{owner:string}>(`SELECT DISTINCT pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','S')`);
  for(const item of owners.rows){await admin.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${pgIdentifier(item.owner)} IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE ON TABLES TO ${pgIdentifier(role)}`);await admin.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${pgIdentifier(item.owner)} IN SCHEMA public GRANT USAGE,SELECT,UPDATE ON SEQUENCES TO ${pgIdentifier(role)}`);}
  await chAdmin(`CREATE USER ${chIdentifier(role)} IDENTIFIED WITH sha256_password BY ${literal(chRuntimePassword)}`);chCreated=true;
  await chAdmin(`GRANT ${runtimePermissions} ON ${chIdentifier(currentCH.database)}.* TO ${chIdentifier(role)}`);
  await admin.query(`REVOKE CONNECT ON DATABASE ${pgIdentifier(database)} FROM PUBLIC`);
  runtimePG=new Pool({connectionString:runtimeUrl.toString(),connectionTimeoutMillis:10000});await verifyRuntime(runtimePG,runtimeCH,runtimeCompany,runtimeEnvironment,true);
  if(persist)await persist(updates);
  return {metadata:{companyCode:code,postgresDatabase:database,clickhouseDatabase:currentCH.database,postgresRole:role,clickhouseUser:role,configured:true,alreadyScoped:false},environmentUpdates:updates};
 }catch(error){
  await runtimePG?.end();runtimePG=undefined;
  // Cleanup only newly created roles and this database's new grants. Original owners and rows stay intact.
  if(chCreated)await chAdmin(`DROP USER ${chIdentifier(role)}`).catch(()=>{});
  if(pgCreated){await admin.query(`DROP OWNED BY ${pgIdentifier(role)}`).catch(()=>{});await admin.query(`DROP ROLE ${pgIdentifier(role)}`).catch(()=>{});if(publicConnected)await admin.query(`GRANT CONNECT ON DATABASE ${pgIdentifier(database)} TO PUBLIC`).catch(()=>{});}
  if(error instanceof SecurityFailure)throw error;throw new SecurityFailure('专用运行账号配置失败，配置文件未改写；请管理员核对新账号及授权状态');
 }finally{await runtimePG?.end();await admin.end();}
}

/** Replace only selected assignments, preserving all other bytes (including model configuration). */
export function renderCompanyEnvironment(content:string,updates:Record<string,string>){
 const eol=content.includes('\r\n')?'\r\n':'\n';let result=content;
 for(const [key,value] of Object.entries(updates)){
  if(!/^[A-Z][A-Z0-9_]*$/.test(key)||/[\r\n]/.test(value))throw new SecurityFailure('环境更新内容无效');
  const serialized="'"+(key==='COMPANY_REGISTRY_JSON'?value.replaceAll("'",'\\u0027'):value)+"'";
  if(serialized.slice(1,-1).includes("'"))throw new SecurityFailure('环境更新内容包含未转义字符');
  const matcher=new RegExp('^(?:[ \\t]*export[ \\t]+)?[ \\t]*'+key+'[ \\t]*=[ \\t]*(?:\'[^\']*\'|"[^"]*"|[^\\r\\n]*)','gm'),matches=[...result.matchAll(matcher)];
  if(matches.length>1)throw new SecurityFailure('所更新的环境变量重复定义，请管理员先整理');
  if(matches.length)result=result.replace(matcher,key+'='+serialized);else result+=(result.endsWith('\n')?'':eol)+key+'='+serialized+eol;
 }
 return result;
}
async function main(){
 const args=process.argv.slice(2),index=args.indexOf('--company'),code=args[index+1];
 if(index<0||!code||code.startsWith('--')||args.some((arg,i)=>arg!=='--company'&&i!==index+1&&arg!=='--configure-local'))throw new SecurityFailure('请使用 company:secure -- --company 公司代码 [--configure-local]');
 const repo=resolve(dirname(scriptFile),'..'),envPath=resolve(repo,'.env.local');
 if((await realpath(repo))!==repo||(await lstat(envPath)).isSymbolicLink())throw new SecurityFailure('本命令仅允许更新项目本身的 .env.local，不能使用符号链接');
 loadEnv({path:envPath,quiet:true});loadEnv({path:resolve(repo,'.env'),quiet:true});
 const original=await readFile(envPath,'utf8');renderCompanyEnvironment(original,{MAIN_PG_URL:'validation'});
 const persist=async(updates:Record<string,string>)=>{
  const contents=renderCompanyEnvironment(original,updates),temporary=envPath+'.company-security-'+randomUUID()+'.tmp';
  try{if(await readFile(envPath,'utf8')!==original)throw new SecurityFailure('配置文件在核验期间被修改，本次已拒绝改写');await writeFile(temporary,contents,{mode:0o600,flag:'wx'});await rename(temporary,envPath);}finally{await unlink(temporary).catch(()=>{});}
 };
 const result=await secureRegisteredCompany(code,process.env,args.includes('--configure-local'),persist);
 console.log(JSON.stringify({status:'ready',...result.metadata,message:result.metadata.alreadyScoped?'专用运行账号已核验；配置和业务数据未改写。':'专用运行账号已验证并登记；业务数据、原账号、数据库owner及旧恢复配置均保留。'}));
}
if(process.argv[1]&&resolve(process.argv[1])===scriptFile)main().catch(error=>{console.error(error instanceof SecurityFailure?error.message:'公司安全核验失败；配置、凭据及原始数据库错误未输出，请检查管理员连接与权限。');process.exitCode=1;});
