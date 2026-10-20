// 正常项目的独立工作台只读验收。仅查询既有账号与业务元数据，不执行模型或业务写入。
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {config} from 'dotenv';
import pg from 'pg';
import {SignJWT} from 'jose';
import {chromium} from '@playwright/test';

const base=process.env.LOCAL_QA_BASE_URL??'http://localhost:3100';
assert.equal(base,'http://localhost:3100','正常库工作台验收只允许明确的本机3100端口');
const env={...process.env};
config({path:[resolve('.env.local'),resolve('.env')],processEnv:env,quiet:true});
function checkedConnection(value){
 let url;try{url=new URL(value??'');}catch{throw new Error('正常库连接配置未就绪');}
 assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&url.port==='15434'&&url.pathname==='/metadata_dev','只允许原正常项目15434/metadata_dev数据库');
 return url;
}
checkedConnection(env.DATABASE_URL);
assert.ok(env.JWT_SECRET?.length>=32,'已有本地登录配置未就绪');
const companyCode=env.LOCAL_QA_COMPANY_CODE??env.DEFAULT_COMPANY_CODE??'main';
let registry;
try{registry=env.COMPANY_REGISTRY_JSON?JSON.parse(env.COMPANY_REGISTRY_JSON):[{code:'main',organizationId:env.SYSTEM_USER_ID||'6f40f555-5f1b-4d1f-807c-b209e817bfdd',databaseUrlEnv:'DATABASE_URL'}];}
catch{throw new Error('公司注册表格式无效');}
assert.ok(Array.isArray(registry),'公司注册表必须是数组');
const registeredCompany=registry.find(company=>company.code===companyCode);
assert.ok(registeredCompany,'验收公司必须已登记');
const connection=checkedConnection(env[registeredCompany.databaseUrlEnv]);
const organizationId=registeredCompany.organizationId.toLowerCase();
const allowedArtifactDirs=['tests/artifacts/workbench-qa/normal','tests/artifacts/spatial-product-qa/normal'].map(value=>resolve(value));
const dir=resolve(process.env.LOCAL_QA_ARTIFACT_DIR??allowedArtifactDirs[0]);
assert.ok(allowedArtifactDirs.includes(dir),'产物只允许原正常库工作台目录或本轮空间界面正常复核目录');
const dimensions=[[1920,1080],[1440,900],[1366,768],[390,844]];
const checks=[],screenshots=[],blocked=[],errors=[],httpErrors=[],requests=[];
const reviewLimitations=['使用既有启用账号签发20分钟本地验收会话；未实际输入密码验证登录表单。','仅系统设置GET由内存夹具应答；工作台接口和所属记录核验读取正常项目，不覆盖设置接口行为验收。','仅读取与比对业务元数据；未执行云模型、人工确认或正式业务写入。'];
let db,browser,context,page,user,token,before,after,currentStep='准备已有账号的短时只读会话';
const itemKeys=new Set(['id','kind','title','status','statusLabel','updatedAt','href','actionLabel','canAct','dueDate','overdue','expiresAt','version','dataset','periodLabel']);
const itemKinds=new Set(['task','plan','material','analysis','report','tag','segment']);
const ownerCache=new Map();
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
await mkdir(dir,{recursive:true});

function pass(name,details){checks.push({name,passed:true,...(details?{details}:{})});console.log('通过：'+name);}
async function inventory(){
 const projections=[
  ['decision_task','"organizationId"',`id,"ownerId","createdBy",state,version,"dueDate","updatedAt"`],
  ['decision_feedback','"organizationId"',`id,"taskId",kind,version,"toState","createdAt"`],
  ['tag','owned_by',`id,status,is_deleted,current_version_id,update_time`],
  ['tag_version','owned_by',`id,tag_id,version,is_current,is_deleted,update_time`],
  ['education_risk_proposal','"organizationId"',`id,status,version,"publishedTagId","updatedAt"`],
  ['segment','owned_by',`id,status,is_deleted,update_time`],
  ['education_segment_snapshot','"organizationId"',`id,"segmentId","sourceTagId","tagVersion","memberCount","createdAt"`],
  ['operational_report','"organizationId"',`id,status,"createdBy","createdAt","completedAt","deadlineAt"`],
  ['knowledge_source_version','"organizationId"',`id,"logicalSourceId",version,status,"indexStatus","isCurrent","contentHash","updatedAt"`],
  ['knowledge_chunk','"organizationId"',`id,"versionId",ordinal,"embeddingDimensions","createdAt"`],
  ['agent_session','"organizationId"',`id,"createdBy","datasetId","updatedAt"`],
  ['agent_execution','"organizationId"',`id,"createdBy","sessionId",status,"startedAt","completedAt","deadlineAt",jsonb_array_length(steps) AS step_count,jsonb_array_length(proposals) AS proposal_count,jsonb_array_length(evidence) AS evidence_count`],
  ['agent_message','"organizationId"',`id,"sessionId","runId",role,"createdAt"`],
 ];
 const result={};
 // Only metadata is projected. Hashing happens in PostgreSQL; no answers, knowledge bodies,
 // report snapshots, model audit inputs, member payloads or account passwords are read.
 for(const [table,org,fields] of projections){
  result[table]=(await db.query(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(row_to_json(metadata)::text,'|' ORDER BY id),'')) AS hash FROM (SELECT ${fields} FROM ${table} WHERE ${org}=$1::uuid) metadata`,[organizationId])).rows[0];
 }
 return result;
}
async function workbench(type='all',pageNumber=1){
 assert.ok(['all','task','plan','material'].includes(type)&&Number.isInteger(pageNumber)&&pageNumber>=1&&pageNumber<=1000);
 const path='/api/workbench?'+new URLSearchParams({type,page:String(pageNumber)});
 requests.push({method:'GET',path:'/api/workbench',type,page:pageNumber});
 const response=await context.request.get(base+path,{headers:{Authorization:'Bearer '+token},timeout:120000});
 assert.equal(response.status(),200,'个人工作只读查询应成功');
 assert.match(response.headers()['cache-control']??'',/no-store/,'个人摘要不得缓存为跨账号公共结果');
 const text=await response.text();
 assert.ok(Buffer.byteLength(text)<120000,'摘要应有界，不包含完整业务正文');
 const body=JSON.parse(text),data=body.data;
 assert.deepEqual(Object.keys(body).sort(),['data','status']);
 assert.deepEqual(Object.keys(data).sort(),['counts','generatedAt','recent','sources','todos']);
 assert.equal(data.todos.pageSize,10);assert.equal(data.todos.page,pageNumber);
 assert.ok(data.todos.items.length<=10&&data.recent.items.length<=6);
 for(const item of [...data.todos.items,...data.recent.items]){
  assert.ok(Object.keys(item).every(key=>itemKeys.has(key)),'摘要不能泄露完整业务或模型字段');
  assert.ok(itemKinds.has(item.kind));assert.ok(typeof item.title==='string'&&typeof item.statusLabel==='string');
  assert.ok(Number.isFinite(Date.parse(item.updatedAt)),'摘要更新时间必须是真实可解析时间');
  const url=new URL(item.href,base);
  assert.equal(url.origin,base);assert.match(url.pathname,/^\/dashboard(?:\/|$)/);
  const scopeKeys=['scope','learningScope','financeScope'].filter(key=>url.searchParams.has(key));
  assert.ok(scopeKeys.length<=1,'已有记录仅携带自身的一种分析范围');
  assert.ok(!url.searchParams.has('review'),'不继承无关流程引导');
  if(item.dataset){
   assert.ok(['public','simulated'].includes(item.dataset.origin));
   assert.equal(url.searchParams.get('datasetId'),item.dataset.id,'链接应使用所选对象自身数据集');
  }
 }
 assert.equal(data.todos.status,'ready','正常库所有个人待办来源应可读取');
 assert.equal(data.recent.status,'ready','正常库最近工作来源应可读取');
 for(const source of Object.values(data.sources))assert.equal(source.status,'ready');
 return data;
}
async function checkOwner(item,isTodo){
 const key=item.kind+':'+item.id+':'+isTodo;
 if(ownerCache.has(key))return;
 const url=new URL(item.href,base),args=[organizationId,user.id];
 let row;
 if(item.kind==='task'){
  row=(await db.query(`SELECT "ownerId"=$2::uuid AS responsible,"createdBy"=$2::uuid AS creator,state,"dueDate" FROM decision_task WHERE id=$3::uuid AND "organizationId"=$1::uuid`,[...args,item.id])).rows[0];
  assert.ok(row&&(row.responsible||row.creator),'任务必须由本人创建或负责');
  if(isTodo){assert.ok(row.responsible&&['accepted','executing','review_pending'].includes(row.state));assert.equal(Boolean(item.overdue),row.dueDate<today);}
  assert.equal(url.searchParams.get('taskId'),item.id);
 }else if(item.kind==='material'){
  row=(await db.query(`WITH versions AS (SELECT id,"createdBy",status,"indexStatus",row_number() OVER (PARTITION BY "logicalSourceId" ORDER BY version DESC,"createdAt" DESC,id) AS position FROM knowledge_source_version WHERE "organizationId"=$1::uuid) SELECT "createdBy"=$2::uuid AS creator,position,status,"indexStatus" FROM versions WHERE id=$3::uuid`,[...args,item.id])).rows[0];
  assert.ok(row?.creator&&Number(row.position)===1,'材料必须是全公司真实最新版本且由本人创建');
  if(isTodo)assert.ok(row.status==='draft'||row.indexStatus==='failed'&&row.status!=='superseded');
  assert.equal(url.searchParams.get('sourceId'),item.id);
 }else if(item.kind==='analysis'){
  row=(await db.query(`SELECT id FROM agent_session WHERE "organizationId"=$1::uuid AND "createdBy"=$2::uuid AND id=$3::uuid`,[...args,item.id])).rows[0];
  assert.ok(row,'会话必须属于本公司当前账号');assert.equal(url.searchParams.get('sessionId'),item.id);
 }else if(item.kind==='plan'){
  const runId=url.searchParams.get('runId');assert.ok(runId,'操作方案应指向原执行');
  row=(await db.query(`SELECT e.id, EXISTS(SELECT 1 FROM jsonb_array_elements(e.steps) AS a(step) WHERE step#>>'{actionPlan,id}'=$4) AS is_plan, EXISTS(SELECT 1 FROM jsonb_array_elements(e.proposals) AS a(proposal) JOIN education_risk_proposal p ON p.id::text=proposal->>'id' AND p."organizationId"=e."organizationId" AND p."createdBy"=$2::uuid WHERE p.id::text=$4) AS is_legacy FROM agent_execution e JOIN agent_session s ON s.id=e."sessionId" AND s."organizationId"=e."organizationId" WHERE e."organizationId"=$1::uuid AND e."createdBy"=$2::uuid AND e.id=$3::uuid`,[...args,runId,item.id])).rows[0];
  assert.ok(row&&(row.is_plan||row.is_legacy),'方案必须来自当前账号的对应执行或兼容草稿');
 }else{
  const definitions={report:['operational_report','id','/dashboard/reports/'+item.id,null],tag:['education_risk_proposal','id',null,'proposalId'],segment:['education_segment_snapshot','id',null,'snapshotId']};
  const [table,column,path,param]=definitions[item.kind];
  row=(await db.query(`SELECT id FROM ${table} WHERE "organizationId"=$1::uuid AND "createdBy"=$2::uuid AND ${column}=$3::uuid`,[...args,item.id])).rows[0];
  assert.ok(row,'最近记录必须由本公司当前账号创建');
  if(path)assert.equal(url.pathname,path);if(param)assert.equal(url.searchParams.get(param),item.id);
 }
 if(item.dataset){
  const dataset=(await db.query('SELECT origin,"analysisType" FROM education_dataset WHERE "organizationId"=$1::uuid AND id=$2::uuid',[organizationId,item.dataset.id])).rows[0];
  assert.ok(dataset&&dataset.origin===item.dataset.origin,'数据来源应归属本公司且性质一致');
 }
 ownerCache.set(key,true);
}
async function settle(){await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});}
async function visit(path){
 await page.goto(base+path,{waitUntil:'networkidle',timeout:120000});
 await page.getByTestId('workbench-workspace').waitFor();
 await page.getByTestId(path.includes('view=tools')?'workbench-tools':'workbench-todos').waitFor({state:'visible'});
 await settle();
 assert.equal(await page.locator('.ant-alert-error').count(),0,'正常环境页面不应展示读取失败');
}
async function capture(name){
 await settle();
 const width=page.viewportSize().width;
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'工作台不能横向溢出');
 const file=resolve(dir,name+'-'+width+'.png');
 await page.screenshot({path:file,fullPage:false,animations:'disabled',mask:[page.locator('.header-user-name')],maskColor:'#64716c'});
 screenshots.push(file);
}
async function setTheme(dark){
 await page.getByRole('button',{name:dark?'切换深色主题':'切换浅色主题',exact:true}).click();
 await page.waitForFunction(value=>document.body.dataset.theme===value,dark?'dark':'light');
}

try{
 db=new pg.Client({connectionString:connection.toString(),application_name:'workbench-normal-readonly-review',options:'-c default_transaction_read_only=on'});
 await db.connect();
 assert.equal((await db.query('SHOW default_transaction_read_only')).rows[0].default_transaction_read_only,'on');
 user=(await db.query(`SELECT id,username,role,organization_id AS "ownedBy" FROM local_user WHERE enabled=TRUE AND role='admin' AND organization_id=$1::uuid ORDER BY id LIMIT 1`,[organizationId])).rows[0];
 assert.ok(user,'需要已有启用管理员，不创建账号也不读取密码');
 before=await inventory();
 const companiesResponse=await fetch(base+'/api/auth/companies',{method:'GET'});
 assert.equal(companiesResponse.status,200,'公开公司目录应就绪');
 const companies=await companiesResponse.json();
 assert.deepEqual(Object.keys(companies).sort(),['companies','defaultCompanyCode']);
 for(const company of companies.companies)assert.deepEqual(Object.keys(company).sort(),['code','name']);
 const company=companies.companies.find(company=>company.code===companyCode);assert.ok(company,'公司必须已登记');
 user={...user,realName:'本地验收账号',email:'',companyCode,companyName:company.name};
 token=await new SignJWT(user).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('20m').sign(new TextEncoder().encode(env.JWT_SECRET));
 browser=await chromium.launch({channel:'msedge',headless:true});
 context=await browser.newContext({viewport:{width:1440,height:900},timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
 await context.addInitScript(({base,token,user})=>{if(location.origin!==base)return;localStorage.setItem('auth_token',token);localStorage.setItem('auth_user',JSON.stringify(user));if(!localStorage.getItem('education-theme'))localStorage.setItem('education-theme','light');},{base,token,user});
 await context.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url()),method=request.method();
  if(!['http:','https:'].includes(url.protocol))return route.continue();
  const allowed=url.origin===base&&['GET','HEAD'].includes(method)&&(!url.pathname.startsWith('/api/')||['/api/workbench','/api/settings','/api/auth/companies'].includes(url.pathname));
  if(!allowed){blocked.push({method,path:url.origin===base?url.pathname:'external-origin'});return route.abort('blockedbyclient');}
  // Settings preloading is unrelated to this read-only review. Supplying only this GET
  // response avoids any legacy configuration initialization on an otherwise empty setup.
  if(url.pathname==='/api/settings'&&method==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sessionTimeout:30,pageSize:10,language:'zh-CN',theme:'light'})});
  if(url.pathname.startsWith('/api/'))requests.push({method,path:url.pathname});
  return route.continue();
 });
 page=await context.newPage();page.setDefaultTimeout(60000);
 page.on('pageerror',error=>errors.push({type:error.name,step:currentStep}));
 page.on('response',response=>{const url=new URL(response.url());if(url.origin===base&&url.pathname.startsWith('/api/')&&response.status()>=400)httpErrors.push({path:url.pathname,status:response.status(),step:currentStep});});
 pass('原公司既有启用账号、20分钟会话和数据库只读连接');

 currentStep='独立核对本人任务和真实最新知识待办';
 const expectedTasks=Number((await db.query(`SELECT count(*) AS count FROM decision_task WHERE "organizationId"=$1::uuid AND "ownerId"=$2::uuid AND state IN ('accepted','executing','review_pending')`,[organizationId,user.id])).rows[0].count);
 const expectedMaterials=Number((await db.query(`WITH ranked AS (SELECT "createdBy",status,"indexStatus",row_number() OVER (PARTITION BY "logicalSourceId" ORDER BY version DESC,"createdAt" DESC,id) AS latest_rank FROM knowledge_source_version WHERE "organizationId"=$1::uuid) SELECT count(*) AS count FROM ranked WHERE latest_rank=1 AND "createdBy"=$2::uuid AND (status='draft' OR ("indexStatus"='failed' AND status<>'superseded'))`,[organizationId,user.id])).rows[0].count);
 const initial=await workbench();
 assert.equal(initial.counts.task,expectedTasks);assert.equal(initial.counts.material,expectedMaterials);
 assert.equal(initial.counts.all,initial.counts.task+initial.counts.plan+initial.counts.material);
 for(const type of ['all','task','plan','material']){
  const first=type==='all'?initial:await workbench(type),second=await workbench(type,2);
  assert.deepEqual(first.counts,initial.counts);assert.deepEqual(second.counts,initial.counts);
  assert.equal(first.todos.total,initial.counts[type]);
  assert.equal(first.todos.items.length,Math.min(10,initial.counts[type]));
  assert.equal(second.todos.items.length,Math.min(10,Math.max(0,initial.counts[type]-10)));
  const unique=new Set();
  for(const item of [...first.todos.items,...second.todos.items]){
   const key=item.kind+':'+item.id;assert.ok(!unique.has(key),'相邻页不得重复记录');unique.add(key);
   if(type!=='all')assert.equal(item.kind,type);
   await checkOwner(item,true);
  }
  for(const item of first.recent.items)await checkOwner(item,false);
 }
 pass(currentStep,{taskCount:expectedTasks,materialCount:expectedMaterials,planCount:initial.counts.plan,ownershipChecks:ownerCache.size});

 currentStep='独立页面、范围清理和目录入口';
 await visit('/dashboard/workbench?datasetId=old-dataset&scope=old-scope&runId=old-run&taskId=old-task');
 assert.equal(new URL(page.url()).search,'','工作台不继承来源页范围或对象');
 assert.equal(await page.locator('.business-sidebar .ant-menu-item').count(),4);
 assert.equal(await page.locator('.business-sidebar .workbench-button').getAttribute('aria-current'),'page');
 assert.equal(await page.locator('.workspace-page-nav').count(),0);
 assert.equal(await page.getByTestId('quick-links').locator('a').count(),6);
 assert.equal(await page.getByRole('dialog',{name:'工作台',exact:true}).count(),0);
 assert.equal(await page.getByTestId('workbench-todos').locator('[data-workbench-item]').count(),initial.todos.items.length);
 assert.equal(await page.getByTestId('workbench-recent').locator('[data-workbench-item]').count(),initial.recent.items.length);
 await page.locator('[aria-label="工作台视图"]').getByRole('radio',{name:'全部功能',exact:true}).locator('..').click();
 const tools=page.getByTestId('workbench-tools');await tools.waitFor();
 const advanced=tools.locator('.ant-collapse-item').filter({hasText:'高级配置'});
 assert.equal(await advanced.locator('[role="button"]').first().getAttribute('aria-expanded'),'false');
 for(const link of await page.getByTestId('quick-links').locator('a').all())assert.ok(!(await link.getAttribute('href')).includes('?'));
 assert.equal(await tools.locator('[data-entry-key="db-browser"]').count(),0,'生产环境不展示数据库浏览器');
 pass(currentStep);

 currentStep='四尺寸浅深色和实际工作台截图';
 for(const dark of [false,true]){
  await visit('/dashboard/workbench');
  if(dark)await setTheme(true);
  for(const [width,height] of dimensions){
   await page.setViewportSize({width,height});await visit('/dashboard/workbench');
   assert.equal(await page.evaluate(()=>document.body.dataset.theme),dark?'dark':'light');
   await capture('workbench-'+(dark?'dark':'light'));
   const todo=await page.getByTestId('workbench-todos').boundingBox(),recent=await page.getByTestId('workbench-recent').boundingBox(),quick=await page.getByTestId('quick-links').boundingBox();
   assert.ok(todo&&quick,'当前个人工作及快捷入口应可见');
   if(width>=1200){
    assert.ok(recent&&todo.x+todo.width<=recent.x+2&&Math.abs(todo.y-recent.y)<3,'桌面必须是左右真实分区');
    assert.ok(Math.abs(todo.width/recent.width-2)<0.15,'待办与最近工作约2比1');
    if(width===1440)assert.ok(quick.y+quick.height<300&&todo.y<400&&recent.y<400,'1440首屏可见常用入口、待办与最近工作');
   }else{
    assert.equal(await page.getByTestId('workbench-recent').isVisible(),false);
    await page.locator('[aria-label="个人工作分区"]').getByRole('radio',{name:'最近工作',exact:true}).locator('..').click();
    assert.equal(await page.getByTestId('workbench-recent').isVisible(),true);assert.equal(await page.getByTestId('workbench-todos').isVisible(),false);
    await capture('workbench-recent-'+(dark?'dark':'light'));
   }
   await page.locator('[aria-label="工作台视图"]').getByRole('radio',{name:'全部功能',exact:true}).locator('..').click();
   await page.getByTestId('workbench-tools').waitFor();await capture('workbench-tools-'+(dark?'dark':'light'));
  }
 }
 pass(currentStep,{screenshots:screenshots.length});
 currentStep='正常库业务元数据前后保持一致';
 after=await inventory();assert.deepEqual(after,before,'查看工作台不能改变任何既有业务元数据');
 assert.deepEqual(blocked,[],'页面不得尝试额外读取、业务写入或模型请求');
 assert.deepEqual(errors,[]);assert.deepEqual(httpErrors,[]);
 pass(currentStep);
 await writeFile(resolve(dir,'verification.json'),JSON.stringify({testedAt:new Date().toISOString(),mode:'normal-project-readonly',base,authMethod:'既有启用账号的20分钟会话；未读取密码、未创建账号',reviewLimitations,databaseReadOnly:true,businessWrites:0,modelCalls:0,dimensions,checks,screenshots,inventoryBefore:before,inventoryAfter:after,blocked,errors,httpErrors,requests},null,2));
 console.log(JSON.stringify({checks:checks.length,screenshots:screenshots.length,readOnly:true}));
}catch(error){
 if(page&&!page.isClosed())await capture('failure').catch(()=>{});
 if(db){try{after=await inventory();}catch{}}
 // Never serialize the original Error message, response bodies, environment, credentials,
 // JWTs, user details, questions, source text, or model input into the failure artifact.
 await writeFile(resolve(dir,'failure.json'),JSON.stringify({testedAt:new Date().toISOString(),mode:'normal-project-readonly',failedStep:currentStep,errorType:error?.name,code:error?.code??null,operator:error?.operator??null,stackLocations:String(error?.stack??'').split('\n').filter(line=>line.trimStart().startsWith('at ')).slice(0,6),reviewLimitations,checks,screenshots,inventoryBefore:before,inventoryAfter:after,blocked,errors,httpErrors,requests},null,2));
 throw new Error('独立工作台正常库只读验收未完成，请查看安全错误记录及截图');
}finally{
 await context?.close();await browser?.close();await db?.end();
}
