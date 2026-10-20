// Read already saved cloud-test results through the real test API. No env files,
// model configuration, business operations, task editing or model invocation.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import pg from 'pg';
import {SignJWT} from 'jose';
import {chromium} from '@playwright/test';

const base='http://localhost:3303';
// The organization value is checked against the existing synthetic actor below;
// it is not supplied by a page query or an unverified request header.
const expectedOrganization='6f40f555-5f1b-4d1f-807c-b209e817bfdd';
const dir=resolve('tests/artifacts/agent-experience-qa/cloud-ui/artifacts');
const input=JSON.parse(await readFile(resolve('tests/artifacts/agent-experience-qa/cloud/verification.json'),'utf8'));
assert.equal(input.status,'passed','只能查看已完成的真实云组');assert.equal(input.diagnosticNumberFormatting,false,'不得把特殊数字提示诊断组作为普通云验收');
assert.equal(input.database,'education_cleanup_test');assert.equal(input.company,'main');
assert.match(input.actorId,/^[0-9a-f-]{36}$/i);assert.match(input.datasetId,/^[0-9a-f-]{36}$/i);
const stage=name=>{const item=input.stages.find(stage=>stage.name===name);assert.equal(item?.status,'passed','所需真实云阶段必须完成');return item.result;};
const draft=stage('create-and-preview-only').run,history=stage('long-history-followup').run,recovery=stage('real-cloud-interpretation-only-recovery').run,failed=stage('controlled-interpretation-failure').run;
assert.equal(recovery.recoveryOf?.runId,failed.id);assert.ok(draft.proposals.some(proposal=>proposal.estimatedCount===46));
const checks=[],screenshots=[],requests=[],blocked=[],errors=[],httpErrors=[];
let db,browser,context,page,before,after,currentStep='专用测试库与合成账号只读校验',settingsDefaultsUsed=false;
await mkdir(dir,{recursive:true});
function pass(name,details){checks.push({name,passed:true,...(details?{details}:{})});console.log('通过：'+name);}
async function inventory(){
 const definitions=[
  ['agent_session','"organizationId"',`id,"createdBy","datasetId","updatedAt",md5(scope::text) AS scope_hash,md5("taskState"::text) AS task_hash`],
  ['agent_execution','"organizationId"',`id,"createdBy","sessionId",status,"completedAt",md5(answer::text) AS answer_hash,md5(steps::text) AS steps_hash,md5(proposals::text) AS proposals_hash,md5(evidence::text) AS evidence_hash`],
  ['agent_message','"organizationId"',`id,"sessionId","runId",role,"createdAt"`],
  ['education_risk_proposal','"organizationId"',`id,status,version,"publishedTagId","updatedAt",md5(preview::text) AS preview_hash`],
  ['tag','owned_by',`id,status,is_deleted,current_version_id,update_time`],
  ['segment','owned_by',`id,status,is_deleted,update_time`],
  ['education_segment_snapshot','"organizationId"',`id,"segmentId","memberCount","tagVersion","createdAt"`],
  ['decision_task','"organizationId"',`id,state,version,"updatedAt"`],
  ['decision_feedback','"organizationId"',`id,"taskId",version,"createdAt"`],
  ['operational_report','"organizationId"',`id,status,"createdAt","completedAt"`],
  ['knowledge_source_version','"organizationId"',`id,version,status,"indexStatus","isCurrent","contentHash","updatedAt"`],
  ['system_config','owned_by',`id,update_time,md5(config::text) AS config_hash`],
 ];
 const result={};for(const [table,org,fields] of definitions)result[table]=(await db.query(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(row_to_json(m)::text,'|' ORDER BY id),'')) AS hash FROM (SELECT ${fields} FROM ${table} WHERE ${org}=$1::uuid) m`,[expectedOrganization])).rows[0];
 return result;
}
async function api(path){
 assert.match(path,/^\/api\/agent\/(?:sessions|runs)\/[0-9a-f-]{36}$/i);
 const result=await context.request.get(base+path,{headers:{Authorization:'Bearer '+token},timeout:120000});
 requests.push({method:'GET',path});assert.equal(result.status(),200,'真实保存结果应可读取');return (await result.json()).data;
}
let token;
async function visit(run){
 await page.goto(base+'/dashboard/agent?'+new URLSearchParams({datasetId:input.datasetId,sessionId:run.sessionId,runId:run.id}),{waitUntil:'networkidle',timeout:120000});
 await page.locator('[data-testid="agent-run-details"][data-run-id="'+run.id+'"]').waitFor();
 await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
}
async function resultMode(){if(page.viewportSize().width<1200)await page.locator('[aria-label="智能分析区域"]').getByText(/^结果/).click();}
async function capture(name){
 await resultMode();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'云结果页面不得横向溢出');
 const path=resolve(dir,name+'-'+page.viewportSize().width+'.png');
 await page.screenshot({path,fullPage:false,animations:'disabled',mask:[page.locator('.header-user-name')],maskColor:'#64716c'});screenshots.push(path);
}
try{
 // Public fixture credentials belong exclusively to the dedicated local test services.
 db=new pg.Client({connectionString:'postgresql://postgres:test_password@127.0.0.1:25432/education_cleanup_test',options:'-c default_transaction_read_only=on',application_name:'agent-cloud-saved-results-readonly'});await db.connect();
 assert.equal((await db.query('SELECT current_database() AS name')).rows[0].name,'education_cleanup_test');assert.equal((await db.query('SHOW default_transaction_read_only')).rows[0].default_transaction_read_only,'on');
 const clickhouse=await fetch('http://127.0.0.1:28123/?database=education_cleanup_test&query='+encodeURIComponent('SELECT currentDatabase() FORMAT JSONEachRow'),{method:'GET',headers:{'X-ClickHouse-User':'default','X-ClickHouse-Key':'test_password'}});assert.equal(clickhouse.status,200);assert.equal(JSON.parse(await clickhouse.text())['currentDatabase()'],'education_cleanup_test');
 const actor=(await db.query('SELECT id,username,role,organization_id AS "ownedBy" FROM local_user WHERE id=$1::uuid AND enabled=TRUE',[input.actorId])).rows[0];assert.ok(actor,'云组的合成账号必须已存在且启用');assert.equal(actor.ownedBy,expectedOrganization);
 const companyResponse=await fetch(base+'/api/auth/companies',{method:'GET'});assert.equal(companyResponse.status,200);
 const company=(await companyResponse.json()).companies?.find(item=>item.code==='main');assert.ok(company,'专用服务必须登记原公司');
 const user={...actor,realName:'真实云模拟验收账号',email:'',companyCode:'main',companyName:company.name};
 before=await inventory();
 token=await new SignJWT(user).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('20m').sign(new TextEncoder().encode('phase4_test_only_secret_at_least_32_characters'));
 browser=await chromium.launch({channel:'msedge',headless:true});context=await browser.newContext({viewport:{width:1440,height:900},timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
 await context.addInitScript(({base,user,token})=>{if(location.origin!==base)return;localStorage.setItem('auth_token',token);localStorage.setItem('auth_user',JSON.stringify(user));localStorage.setItem('education-theme',sessionStorage.getItem('cloud-ui-theme')??'light');},{base,user,token});
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),method=request.method();
  if(!['http:','https:'].includes(url.protocol))return route.continue();
  const getApi=/^\/api\/(?:agent(?:\/sessions(?:\/[0-9a-f-]{36})?|\/runs\/[0-9a-f-]{36})?|education\/datasets(?:\/[0-9a-f-]{36})?|auth\/companies|settings)$/.test(url.pathname);
  const readCatalog=method==='POST'&&url.pathname==='/api/analytics/channels/catalog';
  if(url.origin!==base||!(['GET','HEAD'].includes(method)&&(!url.pathname.startsWith('/api/')||getApi)||readCatalog)){
   blocked.push({method,path:url.origin===base?url.pathname:'external-origin'});return route.abort('blockedbyclient');
  }
  if(url.pathname==='/api/settings'){
   // The existing GET endpoint performs an upsert. Return a SELECT of the real
   // test database's four UI preferences instead; no business data is mocked.
   const preference=(await db.query(`SELECT config->'sessionTimeout' AS "sessionTimeout",config->'pageSize' AS "pageSize",config->'language' AS language,config->'theme' AS theme FROM system_config WHERE owned_by=$1::uuid`,[expectedOrganization])).rows[0];
   if(!preference)settingsDefaultsUsed=true;
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sessionTimeout:preference?.sessionTimeout??30,pageSize:preference?.pageSize??20,language:preference?.language??'zh-CN',theme:preference?.theme??'light'})});
  }
  if(url.pathname.startsWith('/api/'))requests.push({method,path:url.pathname});return route.continue();
 });
 page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',error=>errors.push({type:error.name,step:currentStep}));page.on('response',response=>{const url=new URL(response.url());if(url.origin===base&&url.pathname.startsWith('/api/')&&response.status()>=400)httpErrors.push({path:url.pathname,status:response.status(),step:currentStep});});
 pass(currentStep);
 currentStep='真实草稿、长历史追问和恢复运行读取';
 const actualDraft=await api('/api/agent/runs/'+draft.id),actualHistory=await api('/api/agent/runs/'+history.id),actualRecovery=await api('/api/agent/runs/'+recovery.id),actualFailure=await api('/api/agent/runs/'+failed.id);
 assert.ok(actualDraft.proposals.some(proposal=>proposal.estimatedCount===46&&proposal.status==='awaiting_confirmation'));
 assert.ok(actualHistory.proposals.some(proposal=>proposal.id===actualDraft.proposals[0].id&&proposal.estimatedCount===46));
 assert.equal(actualRecovery.recoveryOf?.runId,actualFailure.id);assert.equal(actualRecovery.status,'completed');assert.equal(actualFailure.status,'failed');assert.equal(actualRecovery.proposals.length,0);assert.ok(!actualRecovery.actionPlan);
 const savedHistory=await api('/api/agent/sessions/'+history.sessionId),savedRecovery=await api('/api/agent/sessions/'+recovery.sessionId);
 assert.ok(savedHistory.runs.length>=12&&savedHistory.session.taskState?.selectedObjects.some(object=>object.id===actualDraft.proposals[0].id));
 assert.notEqual(savedRecovery.session.scope.startDate,actualRecovery.context.scope.startDate,'下一轮范围和恢复回答的历史范围必须分开');
 pass(currentStep,{observedCount:46,historyTurns:savedHistory.runs.length,syntheticHistoryTurns:stage('synthetic-history-window-fixtures').fixtureRunIds.length});
 currentStep='已保存真实云结果的双尺寸浅深色截图';
 for(const theme of ['light','dark']){
  await page.goto(base+'/dashboard/agent',{waitUntil:'networkidle'});await page.evaluate(value=>sessionStorage.setItem('cloud-ui-theme',value),theme);
  for(const [width,height] of [[1440,900],[390,844]]){
   await page.setViewportSize({width,height});
   for(const [name,run] of [['saved-draft',actualDraft],['long-history-followup',actualHistory],['task-memory',actualHistory],['interpretation-recovery',actualRecovery]]){
    await visit(run);await resultMode();assert.equal(await page.evaluate(()=>document.body.dataset.theme),theme);
    if(name==='saved-draft'||name==='long-history-followup'){
     await page.getByTestId('agent-run-details').getByRole('tab',{name:/^操作计划/}).click();
     await page.locator('[data-testid="agent-proposal-'+actualDraft.proposals[0].id+'"]').waitFor();
     const count=await page.locator('[data-testid="agent-proposal-'+actualDraft.proposals[0].id+'"] .preview-summary').textContent();assert.ok(count.includes('46'),'草稿卡使用真实预览人数');
    }
    if(name==='task-memory'){
     const memory=page.getByTestId('agent-task-memory');await memory.locator('summary').click();assert.ok((await memory.textContent()).includes(savedHistory.session.taskState.selectedObjects[0].name));
    }
    if(name==='interpretation-recovery'){
     await page.getByTestId('agent-recovery-source').getByRole('button',{name:'查看原回答',exact:true}).waitFor();
     const displayed=await page.getByTestId('agent-frozen-scope').textContent();assert.ok(displayed.includes(actualRecovery.context.scope.startDate));
     assert.equal(JSON.parse(new URL(page.url()).searchParams.get('scope')).startDate,savedRecovery.session.scope.startDate);
    }
    await capture(name+'-'+theme);
   }
  }
 }
 pass(currentStep,{screenshots:screenshots.length});
 currentStep='恢复页面的原失败回答链接及只读边界';
 await page.setViewportSize({width:1440,height:900});await visit(actualRecovery);await page.getByTestId('agent-recovery-source').getByRole('button',{name:'查看原回答',exact:true}).click();await page.locator('[data-testid="agent-run-details"][data-run-id="'+failed.id+'"]').waitFor();assert.ok((await page.getByTestId('agent-frozen-scope').textContent()).includes(actualFailure.context.scope.startDate));
 after=await inventory();assert.deepEqual(after,before,'只读截图不能改变数据库业务元数据');assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);assert.deepEqual(httpErrors,[]);
 pass(currentStep);
 await writeFile(resolve(dir,'verification.json'),JSON.stringify({testedAt:new Date().toISOString(),mode:'saved-real-cloud-test-results-readonly',attemptId:input.attemptId,sourceCloudStatus:input.status,diagnosticNumberFormatting:false,database:'education_cleanup_test',base,settingsReadOnlyProjection:true,settingsDefaultsUsed,settingsDefaultsNote:settingsDefaultsUsed?'仅附带UI偏好默认，不计业务验收':undefined,cloudModelCalls:0,businessWrites:0,checks,screenshots,inventoryBefore:before,inventoryAfter:after,requests,blocked,errors,httpErrors},null,2));
 console.log(JSON.stringify({checks:checks.length,screenshots:screenshots.length,readOnly:true}));
}catch(error){
 if(page)await capture('failure').catch(()=>{});if(db){try{after=await inventory();}catch{}}
 await writeFile(resolve(dir,'failure.json'),JSON.stringify({testedAt:new Date().toISOString(),failedStep:currentStep,errorType:error?.name,code:error?.code??null,operator:error?.operator??null,stackLocations:String(error?.stack??'').split('\n').filter(line=>line.trimStart().startsWith('at ')).slice(0,6),checks,screenshots,inventoryBefore:before,inventoryAfter:after,blocked,errors,httpErrors},null,2));
 throw new Error('已保存云结果只读界面检查未完成，请查看安全验收记录');
}finally{await context?.close();await browser?.close();await db?.end();}
