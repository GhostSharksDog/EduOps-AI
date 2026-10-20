import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {expect} from 'vitest';
import {hashPassword} from '@/modules/identity/domain/password';
import {createLocalJWT} from '@/modules/identity/services/jwt-utils';
import {getDefaultCompany} from '@/platform/company/registry';

export async function createApiFixture(){
 const url=process.env.DATABASE_URL,base=process.env.TEST_SERVER_URL;
 if(!url||!new URL(url).pathname.endsWith('_test')||!base)throw new Error('API测试要求显式*_test数据库及隔离服务');
 const health=await fetch(base+'/api/health').then(r=>r.json());
 if(health.testMode!==true)throw new Error('API服务必须标记testMode');
 const company=getDefaultCompany(),pool=new Pool({connectionString:url}),org=company.organizationId,otherOrg=randomUUID(),password='api-test-'+randomUUID();
 const cleanupTables=['model_column','data_model','data_sources','tag_storage_config','tag_version','tag','tag_category','target_table','materialized_view_config','bitmap_table','tag_refresh_log','segment_condition','segment_member','segment_calculation_task','segment','system_config','audit_logs'];
 const baseline=new Map<string,Set<string>>();
 for(const table of cleanupTables)baseline.set(table,new Set((await pool.query('SELECT id FROM '+table+' WHERE owned_by=ANY($1::uuid[])',[[org,otherOrg]])).rows.map(row=>row.id)));
 const priorSettings=(await pool.query('SELECT id,config,update_time,updated_by FROM system_config WHERE owned_by=$1',[org])).rows;
 const users:Record<string,{id:string;username:string;token:string}>={};
 for(const role of ['admin','operator','viewer','outsider']){
  const id=randomUUID(),username='api_'+role+'_'+id,ownedBy=role==='outsider'?otherOrg:org;
  if(role==='outsider'){users[role]={id,username,token:await createLocalJWT({id,username,realName:'未登记公司测试',email:'',role:'admin',ownedBy,companyCode:company.code})};continue;}
  await pool.query('INSERT INTO local_user(id,username,password_hash,real_name,role,organization_id) VALUES ($1,$2,$3,$4,$5,$6)',[id,username,await hashPassword(password),'API测试账号',role,ownedBy]);
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password,companyCode:company.code})});
  expect(login.status,'测试夹具通过本地密码登录').toBe(200);
  users[role]={id,username,token:(await login.json()).token};
 }
 async function request(path:string,method='GET',body?:unknown,role:string|null='admin'){
  return fetch(base+path,{method,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(role?{Authorization:'Bearer '+users[role].token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 }
 async function json(path:string,method='GET',body?:unknown,status=200,role:string|null='admin'){
  const response=await request(path,method,body,role); const content=await response.text();let result;
  if(response.status===204&&content==='')result=null;
  else try{result=JSON.parse(content);}catch{throw new Error(method+' '+path+' HTTP '+response.status+' 未返回JSON：'+content.slice(0,180));}
  // 未登记公司的旧404用例现在由身份入口提前拒绝，不能到达对象查询。
  const expectedStatus=role==='outsider'&&status===404?401:status;
  expect(response.status,method+' '+path+' '+JSON.stringify(result).slice(0,400)).toBe(expectedStatus);return result;
 }
 async function close(){
  // API套件串行运行；仅删除本夹具开始后新增的对象编号，保留同机构既有数据与账号。
  for(const table of cleanupTables){const ids=(await pool.query('SELECT id FROM '+table+' WHERE owned_by=ANY($1::uuid[])',[[org,otherOrg]])).rows.map(row=>row.id).filter(id=>!baseline.get(table)!.has(id));if(ids.length)await pool.query('DELETE FROM '+table+' WHERE id=ANY($1::uuid[])',[ids]);}
  for(const row of priorSettings)await pool.query('UPDATE system_config SET config=$2::jsonb,update_time=$3,updated_by=$4 WHERE id=$1',[row.id,JSON.stringify(row.config),row.update_time,row.updated_by]);
  await pool.query('DELETE FROM local_user WHERE id=ANY($1::uuid[])',[Object.values(users).map(user=>user.id)]);
  await pool.end();
 }
 return{base,pool,org,otherOrg,users,password,request,json,close,companyCode:company.code};
}
export type ApiFixture=Awaited<ReturnType<typeof createApiFixture>>;
