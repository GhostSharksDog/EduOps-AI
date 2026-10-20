// Normal-company read-only review. Real GET /api/settings is deliberately not mocked.
// No model requests, task editing, label confirmation or other business writes.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {config} from 'dotenv';
import pg from 'pg';
import {SignJWT} from 'jose';
import {chromium} from '@playwright/test';

const base='http://localhost:3100',dir=resolve('tests/artifacts/agent-assistance-qa/normal'),env={...process.env};
config({path:[resolve('.env.local'),resolve('.env')],processEnv:env,quiet:true});
function checked(value){const url=new URL(value??'');assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&url.port==='15434'&&url.pathname==='/metadata_dev','只读复核仅允许本地15434/metadata_dev');return url;}
checked(env.DATABASE_URL);
const companyCode=env.DEFAULT_COMPANY_CODE??'main';
const definitions=env.COMPANY_REGISTRY_JSON?JSON.parse(env.COMPANY_REGISTRY_JSON):[{code:'main',organizationId:env.SYSTEM_USER_ID||'6f40f555-5f1b-4d1f-807c-b209e817bfdd',databaseUrlEnv:'DATABASE_URL'}];
const company=definitions.find(item=>item.code===companyCode);assert.ok(company&&env.JWT_SECRET?.length>=32);
const org=company.organizationId,db=new pg.Client({connectionString:checked(env[company.databaseUrlEnv]).toString(),options:'-c default_transaction_read_only=on',application_name:'agent-assistance-normal-readonly'});
const checks=[],screenshots=[],blocked=[],errors=[],httpErrors=[],requests=[];
const tables=['education_dataset','education_import_batch','education_risk_proposal','education_segment_snapshot','operational_report','decision_task','decision_feedback','knowledge_source_version','knowledge_chunk','agent_session','agent_execution','agent_message'];
let browser,context,page,before,after,step='准备只读连接',realSettingsResponses=0;
await mkdir(dir,{recursive:true});
async function inventory(){
 const result={};
 // Database-side hashes do not read personal records, model input or knowledge body into this process.
 for(const table of tables)result[table]=(await db.query(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(md5(row_to_json(t)::text),'|' ORDER BY id),'')) AS hash FROM ${table} t WHERE "organizationId"=$1::uuid`,[org])).rows[0];
 for(const [table,column] of [['tag','owned_by'],['segment','owned_by'],['local_user','organization_id']])result[table]=(await db.query(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(md5(row_to_json(t)::text),'|' ORDER BY id),'')) AS hash FROM ${table} t WHERE ${column}=$1::uuid`,[org])).rows[0];
 result.system_config=(await db.query(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(md5(jsonb_build_object('id',id,'owned_by',owned_by,'config',config,'update_time',update_time,'created_by',created_by,'updated_by',updated_by)::text),'|' ORDER BY id),'')) AS hash FROM system_config WHERE owned_by=$1::uuid`,[org])).rows[0];
 return result;
}
function pass(name,details){checks.push({name,passed:true,...(details?{details}:{})});console.log('通过：'+name);}
async function fonts(){await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});}
async function capture(name){const file=resolve(dir,name+'.png');await page.screenshot({path:file,animations:'disabled',mask:[page.locator('.header-user-name')],maskColor:'#64716c'});screenshots.push(file);}
try{
 await db.connect();assert.equal((await db.query('SHOW default_transaction_read_only')).rows[0].default_transaction_read_only,'on');
 const user=(await db.query(`SELECT id,username,role,organization_id AS "ownedBy" FROM local_user WHERE enabled=TRUE AND role='admin' AND organization_id=$1::uuid ORDER BY id LIMIT 1`,[org])).rows[0];assert.ok(user,'需要既有的启用管理员账号');
 const saved=(await db.query(`SELECT s.id,(SELECT e.id FROM agent_execution e WHERE e."sessionId"=s.id AND e."organizationId"=s."organizationId" AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(e.steps)='array' THEN e.steps ELSE '[]'::jsonb END) st WHERE jsonb_typeof(st->'visualizations')='array' AND st->'visualizations'<>'[]'::jsonb) ORDER BY (e.status='completed') DESC,(e.answer IS NOT NULL) DESC,e."startedAt" DESC LIMIT 1) AS "runId" FROM agent_session s WHERE s."organizationId"=$1::uuid AND s."createdBy"=$2::uuid AND EXISTS(SELECT 1 FROM agent_execution e WHERE e."sessionId"=s.id AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(e.steps)='array' THEN e.steps ELSE '[]'::jsonb END) st WHERE jsonb_typeof(st->'visualizations')='array' AND st->'visualizations'<>'[]'::jsonb)) AND NOT EXISTS(SELECT 1 FROM agent_execution e WHERE e."sessionId"=s.id AND e.status IN ('running','queued')) ORDER BY s."updatedAt" DESC LIMIT 1`,[org,user.id])).rows[0];
 assert.ok(saved?.runId,'需要无活动执行且没有图表字段的既有会话，防止GET触发旧超时清理');
 before=await inventory();
 const catalog=await fetch(base+'/api/auth/companies');assert.equal(catalog.status,200);const companyName=(await catalog.json()).companies.find(item=>item.code===companyCode)?.name;assert.ok(companyName);
 Object.assign(user,{realName:'只读验收账号',email:'',companyCode,companyName});
 const token=await new SignJWT(user).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('20m').sign(new TextEncoder().encode(env.JWT_SECRET));
 browser=await chromium.launch({channel:'msedge',headless:true});context=await browser.newContext({viewport:{width:1440,height:900},timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
 await context.addInitScript(({base,token,user})=>{if(location.origin===base){localStorage.setItem('auth_token',token);localStorage.setItem('auth_user',JSON.stringify(user));localStorage.setItem('education-theme','light');}},{base,token,user});
 const allowed=new Set(['/api/auth/me','/api/auth/companies','/api/agent','/api/agent/sessions','/api/agent/sessions/'+saved.id,'/api/education/datasets','/api/analytics/channels/catalog','/api/settings']);
 await context.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url()),method=request.method();
  if(!['http:','https:'].includes(url.protocol))return route.continue();
  const readOnlyCatalog=url.pathname==='/api/analytics/channels/catalog'&&method==='POST';
  if(url.origin!==base||!['GET','HEAD'].includes(method)&&!readOnlyCatalog||url.pathname.startsWith('/api/')&&!allowed.has(url.pathname)&&!/^\/api\/education\/datasets\/[a-f0-9-]{36}$/.test(url.pathname)){
   blocked.push({method,path:url.origin===base?url.pathname:'external-origin'});return route.abort('blockedbyclient');
  }
  if(url.pathname.startsWith('/api/'))requests.push({method,path:url.pathname});
  // Including GET /api/settings: continue to the actual application, with no fulfillment or replacement.
  return route.continue();
 });
 page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',error=>errors.push({type:error.name,step}));
 page.on('response',response=>{const url=new URL(response.url());if(url.origin===base&&url.pathname.startsWith('/api/')&&response.status()>=400)httpErrors.push({path:url.pathname,status:response.status()});if(url.origin===base&&url.pathname==='/api/settings'&&response.request().method()==='GET'&&response.status()===200)realSettingsResponses++;});
 pass('已登记公司、既有账号短时会话及强制只读连接');

 step='真实设置连续读取不创建或更新记录';
 for(let index=0;index<3;index++){
  const settings=await context.request.get(base+'/api/settings',{headers:{Authorization:'Bearer '+token}});assert.equal(settings.status(),200);assert.match(settings.headers()['cache-control']??'',/no-store/);
  const value=await settings.json();assert.equal(typeof value.sessionTimeout,'number');assert.equal(typeof value.pageSize,'number');assert.ok(['light','dark','auto'].includes(value.theme));assert.ok(['zh-CN','en-US'].includes(value.language));
  requests.push({method:'GET',path:'/api/settings',directRead:true});realSettingsResponses++;
 }
 assert.deepEqual((await inventory()).system_config,before.system_config);pass(step,{directReads:3,settingsMocked:false,configAndUpdateTimeUnchanged:true});

 step='旧会话无图表记录正常读取且不暴露模型输入';
 const response=await context.request.get(base+'/api/agent/sessions/'+saved.id,{headers:{Authorization:'Bearer '+token}});assert.equal(response.status(),200);const detail=(await response.json()).data;
 assert.equal(detail.session.id,saved.id);assert.ok(detail.session.taskState&&Number.isInteger(detail.session.taskState.revision));
 const selected=detail.runs.find(run=>run.id===saved.runId);assert.ok(selected);assert.ok(selected.steps.every(value=>!value.visualizations?.length));
 for(const run of detail.runs)for(const value of run.steps){assert.equal(value.runtime?.input,undefined);assert.equal(value.runtime?.freeze,undefined);assert.equal(value.runtime?.taskMemory,undefined);}
 pass(step,{legacyRecordWithoutVisuals:true});
 const url=base+'/dashboard/agent?'+new URLSearchParams({sessionId:saved.id,runId:saved.runId});
 for(const theme of ['light','dark'])for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[390,844]]){
  step='正常旧记录 '+width+' '+theme;await page.setViewportSize({width,height});await page.goto(url,{waitUntil:'networkidle',timeout:120000});
  await page.getByTestId('agent-task-memory').waitFor();await page.getByTestId('agent-run-details').waitFor();
  if(await page.evaluate(()=>document.body.dataset.theme)!==theme){await page.getByRole('button',{name:theme==='dark'?'切换深色主题':'切换浅色主题',exact:true}).click();await page.waitForFunction(value=>document.body.dataset.theme===value,theme);}
  await fonts();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'页面不得横向溢出');
  assert.equal(await page.getByTestId('agent-analysis-visuals').count(),0,'旧记录不得凭文案伪造图表');
  if(width<768){await capture('agent-result-'+theme+'-'+width);await page.locator('[aria-label="智能分析区域"]').getByText('对话',{exact:true}).click();await page.getByTestId('agent-conversation-pane').waitFor({state:'visible'});}
  const composer=await page.getByTestId('agent-composer').boundingBox();assert.ok(composer&&composer.y>=0&&composer.y+composer.height<=height+2,'输入区应在首屏');
  if(width>=1200){assert.ok(await page.getByTestId('agent-result-pane').isVisible());assert.ok(await page.getByTestId('agent-conversation-pane').isVisible());}
  await page.getByRole('textbox',{name:'Agent问题',exact:true}).waitFor({state:'visible'});assert.equal(await page.getByRole('textbox',{name:'Agent问题',exact:true}).isEditable(),true,'空闲历史会话仍可起草下一问，本工具不填写或发送');
  await page.getByTestId('agent-task-memory').locator('summary').click();await page.getByTestId('agent-task-memory').getByRole('button',{name:/修改任务/}).waitFor({state:'visible'});
  await capture('agent-'+theme+'-'+width);pass(step);
 }
 step='真实页面读取设置后所有既有数据和账号保持完整';after=await inventory();assert.deepEqual(after,before);assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);assert.deepEqual(httpErrors,[]);assert.ok(realSettingsResponses>3,'页面应实际访问GET /api/settings');pass(step,{inventoryTables:Object.keys(before).length,realSettingsResponses,settingsMocked:false});
 await writeFile(resolve(dir,'verification.json'),JSON.stringify({testedAt:new Date().toISOString(),base,mode:'normal-readonly',checks,screenshots,settingsMocked:false,realSettingsResponses,businessWrites:0,modelCalls:0,databaseReadOnly:true,inventoryBefore:before,inventoryAfter:after,requests,blocked,errors,httpErrors},null,2));
 console.log(JSON.stringify({checks:checks.length,screenshots:screenshots.length,businessWrites:0,modelCalls:0,realSettingsResponses}));
}catch(error){
 if(page)await page.screenshot({path:resolve(dir,'failure.png'),animations:'disabled',mask:[page.locator('.header-user-name')]}).catch(()=>{});
 if(before)after=await inventory().catch(()=>undefined);
 await writeFile(resolve(dir,'failure.json'),JSON.stringify({step,errorType:error?.name,operator:error?.operator,locations:String(error?.stack??'').split('\n').filter(line=>line.trimStart().startsWith('at ')).slice(0,6),checks,screenshots,settingsMocked:false,realSettingsResponses,inventoryBefore:before,inventoryAfter:after,requests,blocked,errors,httpErrors},null,2));
 throw new Error('正常库Agent辅助体验只读复核未完成，请查看安全诊断记录');
}finally{await context?.close();await browser?.close();await db.end();}
