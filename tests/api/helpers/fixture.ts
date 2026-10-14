import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {expect} from 'vitest';
import {hashPassword} from '@/modules/identity/domain/password';

export async function createApiFixture(){
 const url=process.env.DATABASE_URL,base=process.env.TEST_SERVER_URL;
 if(!url||!new URL(url).pathname.endsWith('_test')||!base)throw new Error('API测试要求显式*_test数据库及隔离服务');
 const health=await fetch(base+'/api/health').then(r=>r.json());
 if(health.testMode!==true)throw new Error('API服务必须标记testMode');
 const pool=new Pool({connectionString:url}),org=randomUUID(),otherOrg=randomUUID(),password='api-test-'+randomUUID();
 const users:Record<string,{id:string;username:string;token:string}>={};
 for(const role of ['admin','operator','viewer','outsider']){
  const id=randomUUID(),username='api_'+role+'_'+id,ownedBy=role==='outsider'?otherOrg:org;
  await pool.query('INSERT INTO local_user(id,username,password_hash,real_name,role,organization_id) VALUES ($1,$2,$3,$4,$5,$6)',[id,username,await hashPassword(password),'API测试账号',role==='outsider'?'admin':role,ownedBy]);
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
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
  expect(response.status,method+' '+path+' '+JSON.stringify(result).slice(0,400)).toBe(status);return result;
 }
 async function close(){
  for(const tenant of [org,otherOrg]){
   for(const table of ['model_column','data_model','data_sources','tag_storage_config','tag_version','tag','tag_category','target_table','materialized_view_config','bitmap_table','tag_refresh_log','segment_condition','segment_member','segment_calculation_task','segment','system_config','audit_logs']){
    await pool.query('DELETE FROM '+table+' WHERE owned_by=$1',[tenant]);
   }
   await pool.query('DELETE FROM local_user WHERE organization_id=$1',[tenant]);
  }
  await pool.end();
 }
 return{base,pool,org,otherOrg,users,password,request,json,close};
}
export type ApiFixture=Awaited<ReturnType<typeof createApiFixture>>;
