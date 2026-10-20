import {Pool} from 'pg';
import {readFile} from 'node:fs/promises';
import {runCompanyCommand} from './company-context';
import {requireCompanyContext} from '../src/platform/company/context';
import {companyPostgresUrl,companyClickHouse,companyDefinitions} from '../src/platform/company/registry';

const identifier=(value:string)=>{if(!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(value))throw Error('数据库和运行账号名称必须使用简单标识符');return '"'+value+'"';};
const literal=(value:string)=>"'"+value.replaceAll("'","''")+"'";
async function main(){
 if(!process.argv.includes('--company'))throw Error('公司初始化必须通过 --company 指定已登记公司');
 const {company}=requireCompanyContext(),targetUrl=new URL(companyPostgresUrl(company)),pgAdminValue=process.env.COMPANY_PG_ADMIN_URL;
 if(!pgAdminValue)throw Error('请单独配置 COMPANY_PG_ADMIN_URL；不会把业务账号作为创建数据库的管理员');
 const pgAdminUrl=new URL(pgAdminValue),database=decodeURIComponent(targetUrl.pathname.slice(1)),username=decodeURIComponent(targetUrl.username),password=decodeURIComponent(targetUrl.password);
 if(targetUrl.hostname!==pgAdminUrl.hostname||(targetUrl.port||'5432')!==(pgAdminUrl.port||'5432'))throw Error('公司数据库与部署管理员必须指向同一 PostgreSQL 服务');
 if(!password||['postgres','template0','template1'].includes(database)||username===decodeURIComponent(pgAdminUrl.username))throw Error('公司必须配置独立运行账号、密码和业务数据库');
 identifier(database);identifier(username);
 for(const other of companyDefinitions()){if(other.code===company.code)continue;const raw=process.env[other.databaseUrlEnv];if(raw){const url=new URL(raw);if(url.hostname===targetUrl.hostname&&(url.port||'5432')===(targetUrl.port||'5432')&&url.username===targetUrl.username)throw Error('公司运行账号不能与其他公司共用');}}
 const c=companyClickHouse(company),chHost=process.env.COMPANY_CH_ADMIN_HOST,chPort=process.env.COMPANY_CH_ADMIN_PORT,chUser=process.env.COMPANY_CH_ADMIN_USER,chPassword=process.env.COMPANY_CH_ADMIN_PASSWORD;
 if(!chHost||!chPort||!chUser||chPassword===undefined||!c.password||c.user===chUser||c.database==='default')throw Error('请配置独立 ClickHouse 运行账号及 COMPANY_CH_ADMIN_* 部署管理员');
 const endpoint=(host:string,port:number)=>new URL(/^https?:\/\//.test(host)?host:`http://${host}:${port}`);
 const chTarget=endpoint(c.host,c.port),chAdmin=endpoint(chHost,Number(chPort));
 if(chTarget.origin!==chAdmin.origin)throw Error('ClickHouse 业务和部署管理员必须指向同一服务');
 identifier(c.database);identifier(c.user);
 async function ch(sql:string){const response=await fetch(chAdmin,{method:'POST',headers:{'X-ClickHouse-User':chUser!,'X-ClickHouse-Key':chPassword!,'Content-Type':'text/plain'},body:sql,signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('ClickHouse 公司初始化失败，请检查部署权限与账号配置');return response.text();}
 // 先确认两边不存在已有业务表；已有库不重建、不清空，也不覆盖现有密码。
 const administrator=new Pool({connectionString:pgAdminValue}),adminDatabaseUrl=new URL(pgAdminValue);adminDatabaseUrl.pathname='/'+database;
 let owner:Pool|undefined;
 try{
  const existing=await administrator.query('SELECT datname FROM pg_database WHERE datname=$1',[database]);
  if(existing.rowCount){owner=new Pool({connectionString:adminDatabaseUrl.toString()});const tables=await owner.query("SELECT tablename FROM pg_tables WHERE schemaname='public' LIMIT 1");if(tables.rowCount)throw Error('所选公司数据库已有业务表，初始化已拒绝；不会重新初始化或清空');}
  const chTables=await ch(`SELECT count() FROM system.tables WHERE database=${literal(c.database)}`);if(Number(chTables.trim())>0)throw Error('所选公司的 ClickHouse 已有表，初始化已拒绝');
  const role=await administrator.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=$1',[username]);
  if(role.rowCount)throw Error('公司运行账号已存在，拒绝改写已有账号；请使用新的专用运行账号');
  const chRoles=await ch(`SELECT count() FROM system.users WHERE name=${literal(c.user)}`);if(Number(chRoles.trim())>0)throw Error('ClickHouse 运行账号已存在，拒绝覆盖已有账号');
  await administrator.query(`CREATE ROLE ${identifier(username)} LOGIN PASSWORD ${literal(password)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
  if(!existing.rowCount)await administrator.query(`CREATE DATABASE ${identifier(database)} OWNER ${identifier(username)}`);
  else await administrator.query(`ALTER DATABASE ${identifier(database)} OWNER TO ${identifier(username)}`);
  // 运行账号只能连接自己的库；其它公司库由其部署时撤销 PUBLIC CONNECT。
  await administrator.query(`REVOKE CONNECT ON DATABASE ${identifier(database)} FROM PUBLIC`);
  await administrator.query(`GRANT CONNECT ON DATABASE ${identifier(database)} TO ${identifier(username)}`);
  owner??=new Pool({connectionString:adminDatabaseUrl.toString()});
  await owner.query('CREATE EXTENSION IF NOT EXISTS vector');
  await owner.query(`GRANT USAGE,CREATE ON SCHEMA public TO ${identifier(username)}`);
  const runtime=new Pool({connectionString:targetUrl.toString()});try{await runtime.query(await readFile(new URL('../database/init.sql',import.meta.url),'utf8'));}finally{await runtime.end();}
  await ch(`CREATE DATABASE IF NOT EXISTS \`${c.database}\``);
  await ch(`CREATE USER \`${c.user}\` IDENTIFIED WITH sha256_password BY ${literal(c.password)}`);
  await ch(`GRANT SELECT,INSERT,ALTER,CREATE TABLE,CREATE VIEW,DROP TABLE,DROP VIEW,TRUNCATE ON \`${c.database}\`.* TO \`${c.user}\``);
  console.log('公司空库与专用运行账号已初始化；现存业务数据和账号未被覆盖。');
 }finally{await owner?.end();await administrator.end();}
}
Promise.resolve().then(()=>runCompanyCommand(main)).catch(error=>{console.error(error?.code?'公司初始化失败；可能已完成部分建库步骤，请管理员核对后处理，不会自动重试。':error.message);process.exitCode=1;});
