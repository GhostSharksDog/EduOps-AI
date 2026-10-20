import {config as loadEnv} from 'dotenv';
import {Pool} from 'pg';
import {hashPassword} from '../src/modules/identity/domain/password';
import {localRoles} from '../src/modules/identity/contracts/local';
import {runCompanyCommand} from './company-context';
import {requireCompanyContext} from '../src/platform/company/context';
import {companyPostgresUrl} from '../src/platform/company/registry';
loadEnv({path:'.env.local',quiet:true});loadEnv({quiet:true});
async function main(){
 const username=process.env.LOCAL_USER_NAME,password=process.env.LOCAL_USER_PASSWORD,role=process.env.LOCAL_USER_ROLE??'admin';
 if(!username||!password)throw new Error('请通过 LOCAL_USER_NAME 和 LOCAL_USER_PASSWORD 指定账号与密码');
 if(!localRoles.includes(role as typeof localRoles[number]))throw new Error('角色仅支持 admin、operator、viewer');
 const {company}=requireCompanyContext();
 const pool=new Pool({connectionString:companyPostgresUrl(company)});
 try{await pool.query(`INSERT INTO local_user(username,password_hash,real_name,role,organization_id,updated_at) VALUES ($1,$2,$3,$4,$5,NOW())`,
  [username,await hashPassword(password),process.env.LOCAL_USER_REAL_NAME??username,role,company.organizationId]);
  console.log('本地账号已创建；密码未写入日志。');
 }finally{await pool.end();}
}
Promise.resolve().then(()=>runCompanyCommand(main)).catch(error=>{
 const messages:Record<string,string>={
  '23505':'用户名已存在，本命令不会覆盖已有账号或密码',
  '42P01':'缺少账号表；如果这是新空库，请先运行 npm.cmd run db:init，再创建账号。已有数据库请先核对表结构，不要重新初始化',
  '28P01':'数据库身份验证失败，请核对 DATABASE_URL 与 PostgreSQL 服务的账号配置',
  '3D000':'连接的数据库不存在，请检查数据库服务及 DATABASE_URL 的数据库名称',
  'ECONNREFUSED':'无法连接数据库，请先启动 PostgreSQL 服务并核对连接端口',
  'ETIMEDOUT':'数据库连接超时，请检查 PostgreSQL 服务状态和连接地址',
 };
 console.error(error?.code?(messages[error.code]??'账号创建失败，请检查数据库连接与表结构'):error.message);
 process.exitCode=1;
});
