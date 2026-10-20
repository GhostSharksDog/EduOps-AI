// 只读复核专用测试库已保存的真实云回答；不读取.env，不调用模型或执行业务操作。
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import pg from 'pg';
import {SignJWT} from 'jose';
import {chromium} from '@playwright/test';

const base='http://localhost:3303',org='6f40f555-5f1b-4d1f-807c-b209e817bfdd';
const records=new Map(['agent-number-qa','agent-evidence-qa'].map(name=>[resolve('tests/artifacts/'+name+'/cloud/verification.json'),resolve('tests/artifacts/'+name+'/ui')]));
const recordPath=resolve(process.env.LOCAL_QA_CLOUD_RECORD??'tests/artifacts/agent-number-qa/cloud/verification.json');assert.ok(records.has(recordPath),'云记录仅允许本项目数字或证据验收的固定路径');
const dir=resolve(process.env.LOCAL_QA_ARTIFACT_DIR??records.get(recordPath));assert.equal(dir,records.get(recordPath),'结果必须写入所选验收组的固定ui目录');
const input=JSON.parse(await readFile(recordPath,'utf8'));
assert.equal(input.database,'education_cleanup_test');assert.equal(input.company,'main');assert.match(input.actorId,/^[0-9a-f-]{36}$/i);
const fullRun=input.fullRun??input.fullRuns?.find(run=>run.status==='completed'&&!run.controlledFailure&&Object.values(run.checks??{}).every(Boolean));
assert.ok(fullRun,'需要已通过数字、证据及完整工具校验的真实云完整回答');assert.equal(fullRun.status,'completed');assert.ok(Number.isInteger(fullRun.factCount)&&fullRun.factCount>0,'实际事实数量须由成功云记录给出');
const expectedFactCount=fullRun.factCount;
assert.match(fullRun.id,/^[0-9a-f-]{36}$/i);assert.match(fullRun.sessionId,/^[0-9a-f-]{36}$/i);
const db=new pg.Client({connectionString:'postgresql://postgres:test_password@127.0.0.1:25432/education_cleanup_test',options:'-c default_transaction_read_only=on',application_name:'agent-number-result-readonly'});
const checks=[],screenshots=[],requests=[],blocked=[],errors=[],httpErrors=[];
let browser,context,page,before,after,step='专用测试服务与合成账号校验';
await mkdir(dir,{recursive:true});
const pass=name=>{checks.push({name,passed:true});console.log('通过：'+name);};
async function inventory(){const result={};for(const table of ['agent_execution','agent_session','agent_message'])result[table]=(await db.query(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(md5(row_to_json(t)::text),'|' ORDER BY id),'')) AS hash FROM ${table} t WHERE "organizationId"=$1::uuid`,[org])).rows[0];return result;}
async function capture(name){const path=resolve(dir,name+'.png');await page.screenshot({path,animations:'disabled',mask:[page.locator('.header-user-name')],maskColor:'#64716c'});screenshots.push(path);}
const literal=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
try{
 await db.connect();assert.equal((await db.query('SELECT current_database() AS name')).rows[0].name,'education_cleanup_test');assert.equal((await db.query('SHOW default_transaction_read_only')).rows[0].default_transaction_read_only,'on');
 const ch=await fetch('http://127.0.0.1:28123/?database=education_cleanup_test&query='+encodeURIComponent('SELECT currentDatabase() FORMAT JSONEachRow'),{headers:{'X-ClickHouse-User':'default','X-ClickHouse-Key':'test_password'}});assert.equal(ch.status,200);assert.equal(JSON.parse(await ch.text())['currentDatabase()'],'education_cleanup_test');
 const user=(await db.query('SELECT id,username,role,organization_id AS "ownedBy" FROM local_user WHERE id=$1::uuid AND enabled=TRUE',[input.actorId])).rows[0];assert.ok(user);assert.equal(user.ownedBy,org);assert.match(user.username,/^attendance_number_/);assert.equal(user.role,'admin');
 const saved=(await db.query('SELECT id,"sessionId",status FROM agent_execution WHERE id=$1::uuid AND "createdBy"=$2::uuid AND "organizationId"=$3::uuid',[fullRun.id,user.id,org])).rows[0];assert.equal(saved?.status,'completed');assert.equal(saved.sessionId,fullRun.sessionId);
 assert.equal((await db.query('SELECT count(*)::int AS count FROM agent_execution WHERE "sessionId"=$1::uuid AND status IN (\'running\',\'queued\')',[fullRun.sessionId])).rows[0].count,0,'只查看无活动运行的会话，避免读取触发旧超时收尾');
 const companies=await fetch(base+'/api/auth/companies');assert.equal(companies.status,200);const company=(await companies.json()).companies.find(company=>company.code==='main');assert.ok(company);
 Object.assign(user,{realName:'真实云模拟验收账号',email:'',companyCode:'main',companyName:company.name});
 const token=await new SignJWT(user).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('15m').sign(new TextEncoder().encode('phase4_test_only_secret_at_least_32_characters'));
 before=await inventory();browser=await chromium.launch({channel:'msedge',headless:true});context=await browser.newContext({viewport:{width:1440,height:900},timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
 await context.addInitScript(({base,user,token})=>{if(location.origin===base){localStorage.setItem('auth_token',token);localStorage.setItem('auth_user',JSON.stringify(user));localStorage.setItem('education-theme','light');}},{base,user,token});
 await context.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url()),method=request.method();if(!['http:','https:'].includes(url.protocol))return route.continue();
  const allowedApi=/^\/api\/(?:auth\/(?:me|companies)|settings|agent(?:\/sessions(?:\/[0-9a-f-]{36})?|\/runs\/[0-9a-f-]{36})?|education\/datasets(?:\/[0-9a-f-]{36})?)$/i.test(url.pathname);
  if(url.origin!==base||!['GET','HEAD'].includes(method)||url.pathname.startsWith('/api/')&&!allowedApi){blocked.push({method,path:url.origin===base?url.pathname:'external-origin'});return route.abort('blockedbyclient');}
  if(url.pathname.startsWith('/api/'))requests.push({method,path:url.pathname});return route.continue();
 });
 page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',error=>errors.push({type:error.name,step}));page.on('response',response=>{const url=new URL(response.url());if(url.origin===base&&url.pathname.startsWith('/api/')&&response.status()>=400)httpErrors.push({path:url.pathname,status:response.status()});});pass(step);

 step='已保存完整回答的'+expectedFactCount+'项事实与引用';
 const response=await context.request.get(base+'/api/agent/runs/'+fullRun.id,{headers:{Authorization:'Bearer '+token}});assert.equal(response.status(),200);const run=(await response.json()).data;assert.equal(run.status,'completed');assert.equal(run.errorCode,null);assert.ok(run.answer?.summary);
 const completed=run.steps.filter(value=>value.status==='completed'),facts=[...new Map(completed.flatMap(value=>value.facts??[]).map(fact=>[fact.id,fact])).values()];assert.equal(facts.length,expectedFactCount);assert.ok(completed.some(value=>value.tool==='query_metrics'));assert.ok(completed.some(value=>value.tool==='query_metric_breakdown'));
 const refs=new Set(run.evidence.map(value=>value.id));assert.ok(facts.every(fact=>fact.evidenceIds.every(id=>refs.has(id))));assert.doesNotMatch(JSON.stringify(run.answer),/\{\{\s*f\d+(?:[.:][^}]*)?\s*\}\}/i);
 const charts=completed.flatMap(value=>value.visualizations??[]);assert.ok(charts.length>0);assert.ok(charts.every(chart=>chart.source.datasetId===input.datasetId&&chart.evidenceIds.every(id=>refs.has(id))));pass(step);

 const url=base+'/dashboard/agent?'+new URLSearchParams({datasetId:input.datasetId,sessionId:fullRun.sessionId,runId:fullRun.id});
 await page.goto(url,{waitUntil:'networkidle',timeout:120000});const details=page.locator('[data-testid="agent-run-details"][data-run-id="'+run.id+'"]');await details.waitFor();
 step='实际页面已完成状态、关键数字与无未解析短编号';
 assert.equal(await details.locator('.ant-tag').filter({hasText:/^执行失败$/}).count(),0);assert.equal(await page.getByTestId('agent-error').count(),0);assert.doesNotMatch(await details.innerText(),/\{\{\s*f\d+(?:[.:][^}]*)?\s*\}\}/i);
 const keyFacts=page.getByTestId('agent-facts').locator('.profile-stat');assert.ok(await keyFacts.count()>=1&&await keyFacts.count()<=3);
 const core=facts.filter(fact=>fact.status==='ready'&&typeof fact.value==='number'&&/(?:^|:)attendance_rate$/.test(fact.id));assert.ok(core.length>=2,'本期与课程出勤都需保留');
 for(let index=0;index<await keyFacts.count();index++){const card=keyFacts.nth(index),label=await card.locator('small').first().innerText(),fact=facts.find(fact=>fact.label===label);assert.ok(fact,'关键数字必须来自真实保存事实');if(fact.status==='ready'&&fact.value!==null&&fact.displayValue===undefined)assert.match(await card.locator('strong').first().innerText(),new RegExp(literal(fact.value.toLocaleString('zh-CN',{maximumFractionDigits:4}))));}
 const inputBox=page.getByRole('textbox',{name:'Agent问题',exact:true});assert.equal(await inputBox.isEditable(),true);await capture('completed-answer-light-1440');pass(step);

 step='程序图表与完整事实的数据表';const visual=page.getByTestId('agent-analysis-visuals');await visual.waitFor();await visual.getByRole('img').first().waitFor();assert.ok(await visual.locator('svg').count()>0);await visual.getByText('查看图表数据',{exact:true}).click();await visual.getByRole('table').waitFor();assert.ok((await visual.innerText()).includes('模拟经营'));await capture('computed-chart-table-light-1440');
 await details.getByRole('tab',{name:'数据依据',exact:true}).click();const allFacts=details.getByRole('tabpanel',{name:'数据依据',exact:true}).locator('.profile-stat');assert.equal(await allFacts.count(),expectedFactCount);
 for(const fact of core.slice(0,3)){const card=allFacts.filter({has:page.getByText(fact.label,{exact:true})}).first();assert.match(await card.locator('strong').first().innerText(),new RegExp(literal(fact.value.toLocaleString('zh-CN',{maximumFractionDigits:4}))));}
 await details.getByRole('tab',{name:'结果',exact:true}).click();pass(step);

 step='390深色结果和可输入的固定区域';await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'切换深色主题',exact:true}).click();await page.waitForFunction(()=>document.body.dataset.theme==='dark');await page.locator('[aria-label="智能分析区域"]').getByText(/^结果/).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await capture('completed-answer-dark-390');
 await page.locator('[aria-label="智能分析区域"]').getByText('对话',{exact:true}).click();assert.equal(await inputBox.isEditable(),true);const composer=await page.getByTestId('agent-composer').boundingBox();assert.ok(composer&&composer.y>=0&&composer.y+composer.height<=844+2);await capture('editable-composer-dark-390');pass(step);

 after=await inventory();assert.deepEqual(after,before,'原执行、会话和消息前后内容及数量必须不变');assert.deepEqual(errors,[]);assert.deepEqual(httpErrors,[]);assert.ok(blocked.every(item=>item.method==='POST'&&item.path==='/api/analytics/channels/catalog'),'只允许阻止页面自动读取渠道选项的POST，任何其他写入或模型请求均失败');pass('所有请求只读，原会话、执行及消息散列不变');
 await writeFile(resolve(dir,'verification.json'),JSON.stringify({testedAt:new Date().toISOString(),mode:'saved-real-cloud-test-readonly',base,database:'education_cleanup_test',sourceRecord:recordPath,attemptId:input.attemptId,sourceStatus:input.status,fullRunId:run.id,factCount:facts.length,chartPayloadCount:charts.length,businessWrites:0,modelCalls:0,databaseReadOnly:true,checks,screenshots,inventoryBefore:before,inventoryAfter:after,requests,blocked,errors,httpErrors},null,2));console.log(JSON.stringify({passed:checks.length,screenshots:screenshots.length,businessWrites:0,modelCalls:0}));
}catch(error){if(page)await capture('failure').catch(()=>{});if(before)after=await inventory().catch(()=>undefined);await writeFile(resolve(dir,'failure.json'),JSON.stringify({step,errorType:error?.name,operator:error?.operator,locations:String(error?.stack??'').split('\n').filter(line=>line.trimStart().startsWith('at ')).slice(0,6),checks,screenshots,inventoryBefore:before,inventoryAfter:after,blocked,errors,httpErrors},null,2));throw new Error('真实云数字结果只读复核失败，请查看专用验收记录');}
finally{await context?.close();await browser?.close();await db.end();}
