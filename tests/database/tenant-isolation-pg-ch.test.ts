import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {NextRequest,NextResponse} from 'next/server';
import {runWithCompany} from '@/platform/company/context';
import {db,execute,queryOne} from '@/platform/database';
import {EducationEventsClient} from '@/platform/database/education-events';
import {hashPassword} from '@/modules/identity/domain/password';
import {withCompanyRoute,createLocalJWT,reloadLocalIdentity} from '@/modules/identity/server';
import {POST as login} from '@/app/api/auth/login/route';
import {GET as me} from '@/app/api/auth/me/route';
import {GET as workbench} from '@/app/api/workbench/route';
import {PATCH as patchTaskMemory} from '@/app/api/agent/sessions/[id]/task-state/route';
import {KnowledgeApplicationService} from '@/modules/knowledge/services/service';
import {DatabaseKnowledgeRepository} from '@/modules/knowledge/repositories/repository';
import {DatabaseAgentRepository} from '@/modules/agent/repositories/repository';

const suffix=randomUUID().replaceAll('-','').slice(0,12),companies=['a','b'].map(letter=>({code:'tenant_'+letter,org:randomUUID(),database:'eduops_'+letter+'_'+suffix+'_test',role:'eduops_'+letter+'_'+suffix,password:randomUUID()}));
const actorId=randomUUID(),datasetId=randomUUID(),sessionId=randomUUID(),password='company-test-password-2027',scope={startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[]};
const tokens=new Map<string,string>(),sources=new Map<string,string>();
const provisionedPg=new Set<string>(),provisionedRoles=new Set<string>(),provisionedCh=new Set<string>(),provisionedChRoles=new Set<string>();
let administrator:Pool,adminUrl:URL,chEndpoint:URL;
const chHeaders:Record<string,string>={};
const identifier=(value:string)=>{if(!/^[a-z0-9_]+$/.test(value))throw Error('invalid fixture identifier');return '"'+value+'"';};
const literal=(value:string)=>"'"+value.replaceAll("'","''")+"'";
async function chAdmin(sql:string){const response=await fetch(chEndpoint,{method:'POST',headers:chHeaders,body:sql});if(!response.ok)throw Error('隔离测试 ClickHouse 部署失败');return response.text();}
function request(url:string,token?:string,body?:unknown){return new NextRequest('http://localhost'+url,{method:body===undefined?'GET':'POST',headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json','x-tenant-id':companies[1].org,'x-user-info':'spoofed','x-company-code':companies[1].code},...(body===undefined?{}:{body:JSON.stringify(body)})});}
const knowledge=new KnowledgeApplicationService(new DatabaseKnowledgeRepository(),{configuration:()=>({configured:true,model:'tenant-fixture',fingerprint:'tenant-fixture'}),embed:async texts=>texts.map(()=>[1,0])});
const repository=new DatabaseAgentRepository();

beforeAll(async()=>{
 adminUrl=new URL(process.env.DATABASE_URL??'');
 if(adminUrl.hostname!=='127.0.0.1'||adminUrl.port!=='25432'||!adminUrl.pathname.endsWith('_test')||!['127.0.0.1','localhost'].includes(process.env.CLICKHOUSE_HOST??'')||process.env.CLICKHOUSE_PORT!=='28123'||!process.env.CLICKHOUSE_DATABASE?.endsWith('_test'))throw Error('两公司隔离实验仅允许25432/28123专用测试服务');
 administrator=new Pool({connectionString:adminUrl.toString()});chEndpoint=new URL('http://'+process.env.CLICKHOUSE_HOST+':28123');chHeaders['X-ClickHouse-User']=process.env.CLICKHOUSE_USER??'default';chHeaders['X-ClickHouse-Key']=process.env.CLICKHOUSE_PASSWORD??'';
 const definitions=companies.map((c,index)=>{const prefix='TENANT_FIXTURE_'+index,url=new URL(adminUrl);url.pathname='/'+c.database;url.username=c.role;url.password=c.password;vi.stubEnv(prefix+'_PG',url.toString());vi.stubEnv(prefix+'_HOST',process.env.CLICKHOUSE_HOST!);vi.stubEnv(prefix+'_PORT','28123');vi.stubEnv(prefix+'_USER',c.role);vi.stubEnv(prefix+'_PASSWORD',c.password);vi.stubEnv(prefix+'_DATABASE',c.database);return {code:c.code,name:'隔离测试'+index,organizationId:c.org,databaseUrlEnv:prefix+'_PG',clickhouse:{hostEnv:prefix+'_HOST',portEnv:prefix+'_PORT',userEnv:prefix+'_USER',passwordEnv:prefix+'_PASSWORD',databaseEnv:prefix+'_DATABASE'}};});
 vi.stubEnv('COMPANY_REGISTRY_JSON',JSON.stringify(definitions));vi.stubEnv('DEFAULT_COMPANY_CODE',companies[0].code);vi.stubEnv('JWT_SECRET','tenant-test-secret-with-at-least-32-characters');
 const sql=await readFile(new URL('../../database/init.sql',import.meta.url),'utf8');
 for(const c of companies){
  const collision=await administrator.query('SELECT datname FROM pg_database WHERE datname=$1',[c.database]);if(collision.rowCount)throw Error('测试库名称冲突，拒绝清空已有库');
  await administrator.query(`CREATE ROLE ${identifier(c.role)} LOGIN PASSWORD ${literal(c.password)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);provisionedRoles.add(c.role);
  await administrator.query(`CREATE DATABASE ${identifier(c.database)} OWNER ${identifier(c.role)}`);provisionedPg.add(c.database);
  await administrator.query(`REVOKE CONNECT ON DATABASE ${identifier(c.database)} FROM PUBLIC`);await administrator.query(`GRANT CONNECT ON DATABASE ${identifier(c.database)} TO ${identifier(c.role)}`);
  const target=new URL(adminUrl);target.pathname='/'+c.database;const owner=new Pool({connectionString:target.toString()});try{await owner.query('CREATE EXTENSION vector');await owner.query(`GRANT USAGE,CREATE ON SCHEMA public TO ${identifier(c.role)}`);}finally{await owner.end();}
  await chAdmin(`CREATE DATABASE \`${c.database}\``);provisionedCh.add(c.database);await chAdmin(`CREATE USER \`${c.role}\` IDENTIFIED WITH sha256_password BY ${literal(c.password)}`);provisionedChRoles.add(c.role);await chAdmin(`GRANT SELECT,INSERT,CREATE TABLE ON \`${c.database}\`.* TO \`${c.role}\``);
  await runWithCompany(c.code,async()=>{
   await db.query(sql);await execute('INSERT INTO local_user(id,username,password_hash,real_name,role,organization_id) VALUES($1,$2,$3,$4,$5,$6)',[actorId,'same-user',await hashPassword(password),'隔离测试',c===companies[0]?'admin':'viewer',c.org]);
   await execute('INSERT INTO education_dataset(id,"organizationId",key,name,origin,license,"schemaVersion","dataCutoff") VALUES($1,$2,\'same-key\',$3,\'simulation\',\'fixture\',\'1\',NOW())',[datasetId,c.org,c.code]);
   const source=await knowledge.create({title:c.code+'业务知识',kind:'definition',content:c.code+'独立知识内容，学员出勤依据各自数据库。',evidence:[]},c.org,actorId);sources.set(c.code,source.id);await knowledge.approveAndIndex(source.id,c.org,actorId,{expectedVersion:1,expectedContentHash:source.contentHash});
   await execute('INSERT INTO agent_session(id,"organizationId","createdBy",title,"datasetId",scope) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[sessionId,c.org,actorId,c.code+'会话',datasetId,JSON.stringify({...scope,organizationId:c.org,authorizedCampusIds:[]})]);
   await new EducationEventsClient().insert([{organization_id:c.org,dataset_id:datasetId,batch_id:randomUUID(),kind:'attendance',source_id:'same-source',hash:'fixture',payload:JSON.stringify({company:c.code}),student_id:'student',campus_id:'campus',course_id:'course',class_id:'class',occurred_at:null,relative_day:1,version:1}]);
  });
 }
},90000);
afterAll(async()=>{
 for(const c of companies){try{await runWithCompany(c.code,()=>db.end());}catch{}if(provisionedCh.has(c.database))await chAdmin(`DROP DATABASE \`${c.database}\``);if(provisionedChRoles.has(c.role))await chAdmin(`DROP USER \`${c.role}\``);if(provisionedPg.has(c.database))await administrator.query(`DROP DATABASE ${identifier(c.database)} WITH (FORCE)`);if(provisionedRoles.has(c.role))await administrator.query(`DROP ROLE ${identifier(c.role)}`);}
 await administrator?.end();vi.unstubAllEnvs();
},90000);

describe('两家公司独立数据库、同名账号与身份复核',()=>{
 it('同名账号分别登录到所属公司；旧登录明确使用默认公司',async()=>{
  for(const c of companies){const response=await login(request('/api/auth/login',undefined,{companyCode:c.code,username:'same-user',password})),body=await response.json();expect(response.status).toBe(200);expect(body.user.ownedBy).toBe(c.org);expect(body.user.companyCode).toBe(c.code);tokens.set(c.code,body.token);}
  const response=await login(request('/api/auth/login',undefined,{username:'same-user',password}));expect((await response.json()).user.companyCode).toBe(companies[0].code);
 });
 it('PG和ClickHouse并发查询、相同对象编号不串库',async()=>{
  const result=await Promise.all(companies.map(c=>runWithCompany(c.code,async()=>{const row=await queryOne<{database:string;name:string}>('SELECT current_database() AS database,name FROM education_dataset WHERE id=$1',[datasetId]);const events=await new EducationEventsClient().queryRows<{payload:string}>('SELECT payload FROM education_events_v1');return {row,events};})));
  for(let index=0;index<companies.length;index++){expect(result[index].row).toEqual({database:companies[index].database,name:companies[index].code});expect(JSON.parse(result[index].events[0].payload).company).toBe(companies[index].code);}
 });
 it('真实向量检索与Agent会话只返回当前公司的记录，跨公司来源不可读',async()=>{
  for(const c of companies)await runWithCompany(c.code,async()=>{const actor={userId:actorId,organizationId:c.org,role:c===companies[0]?'admin':'viewer'},hits=(await knowledge.search('出勤',{...scope,organizationId:c.org,authorizedCampusIds:[]})).data?.hits??[];expect(hits.length).toBe(1);expect(hits[0].text).toContain(c.code);expect((await repository.getSession(actor,sessionId)).session.title).toBe(c.code+'会话');const other=companies.find(item=>item!==c)!;await expect(knowledge.get(sources.get(other.code)!,c.org)).rejects.toThrow('无权');});
 });
 it('工作台在两家独立数据库并发读取同编号账号，身份头不能改变结果',async()=>{
  const results=await Promise.all(companies.map(async c=>{const response=await workbench(request('/api/workbench',tokens.get(c.code)));expect(response.status).toBe(200);return {company:c,body:await response.json()};}));
  for(const {company,body} of results){
   expect(body.data.todos.status).toBe('ready');expect(body.data.counts.all).toBe(0);
   const items=body.data.recent.items as {title:string;kind:string}[];expect(items.some(item=>item.kind==='analysis'&&item.title===company.code+'会话')).toBe(true);
   expect(items.some(item=>item.kind==='material'&&item.title===company.code+'业务知识')).toBe(true);
   const other=companies.find(c=>c!==company)!;expect(items.some(item=>item.title.startsWith(other.code))).toBe(false);
   expect(JSON.stringify(body)).not.toContain('独立知识内容');
  }
 });
 it('同编号会话的任务记忆按真实公司隔离，viewer仅管理自己的会话',async()=>{
  for(const c of companies){
   const body={action:'update',expectedRevision:0,goal:c.code+'独立目标',userConditions:['仅使用所属公司记录']};
   const request=new NextRequest('http://localhost/api/agent/sessions/'+sessionId+'/task-state',{method:'PATCH',headers:{Authorization:'Bearer '+tokens.get(c.code),'Content-Type':'application/json','x-tenant-id':companies.find(v=>v!==c)!.org},body:JSON.stringify(body)});
   const response=await patchTaskMemory(request,{params:Promise.resolve({id:sessionId})});expect(response.status).toBe(200);expect((await response.json()).data.goal).toBe(c.code+'独立目标');
  }
  for(const c of companies)await runWithCompany(c.code,async()=>{const state=await repository.getTaskState({userId:actorId,organizationId:c.org,role:c===companies[0]?'admin':'viewer'},sessionId);expect(state.goal).toBe(c.code+'独立目标');expect(state.revision).toBe(1);});
 });
 it('公司身份头不可覆盖令牌；伪造公司令牌和未登录公开接口拒绝',async()=>{
  const response=await me(request('/api/auth/me',tokens.get(companies[0].code)),undefined);expect(response.status).toBe(200);expect((await response.json()).user.companyCode).toBe(companies[0].code);
  const token=await createLocalJWT({id:actorId,username:'same-user',realName:'测试',email:'',role:'admin',ownedBy:companies[0].org,companyCode:companies[1].code});expect((await me(request('/api/auth/me',token),undefined)).status).toBe(401);
  const publicRead=withCompanyRoute(async()=>NextResponse.json({unexpected:true}));expect((await publicRead(request('/api/public/tags'),undefined)).status).toBe(401);
 });
 it('禁用和降权在后续请求生效，只读账号不能确认操作',async()=>{
  const c=companies[0];await runWithCompany(c.code,()=>execute('UPDATE local_user SET enabled=false WHERE id=$1',[actorId]));expect((await me(request('/api/auth/me',tokens.get(c.code)),undefined)).status).toBe(401);await runWithCompany(c.code,()=>execute('UPDATE local_user SET enabled=true,role=\'viewer\' WHERE id=$1',[actorId]));
  const operation=withCompanyRoute(async()=>NextResponse.json({unexpected:true}));expect((await operation(request('/api/agent/actions/confirm',tokens.get(c.code),{}),undefined)).status).toBe(403);expect((await me(request('/api/auth/me',tokens.get(c.code)),undefined)).status).toBe(200);expect((await (await me(request('/api/auth/me',tokens.get(c.code)),undefined)).json()).user.role).toBe('viewer');expect((await runWithCompany(companies[1].code,()=>reloadLocalIdentity(actorId)))?.role).toBe('viewer');
 });
 it('数据库运行账号也不能绕过应用直接读取另一公司数据库',async()=>{
  const target=new URL(adminUrl);target.pathname='/'+companies[0].database;target.username=companies[1].role;target.password=companies[1].password;const foreign=new Pool({connectionString:target.toString(),connectionTimeoutMillis:3000});try{await expect(foreign.query('SELECT 1')).rejects.toMatchObject({code:'42501'});}finally{await foreign.end();}
  const response=await fetch(chEndpoint,{method:'POST',headers:{'X-ClickHouse-User':companies[1].role,'X-ClickHouse-Key':companies[1].password},body:`SELECT count() FROM \`${companies[0].database}\`.education_events_v1`});expect(response.ok).toBe(false);
 });
});
