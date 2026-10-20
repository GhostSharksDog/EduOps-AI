// 受控接口的界面验收；不连接数据库、不调用云模型、不写业务数据。
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from '@playwright/test';

const base=process.env.LOCAL_QA_BASE_URL??'http://localhost:3302',address=new URL(base);
assert.ok(['localhost','127.0.0.1'].includes(address.hostname)&&['3302','3303'].includes(address.port),'只允许专用本机验收服务');
const dir=resolve(process.env.LOCAL_QA_ARTIFACT_DIR??'tests/artifacts/agent-upgrade-ui');await mkdir(dir,{recursive:true});
const companies=[{code:'fixture-a',name:'验收公司甲'},{code:'fixture-b',name:'验收公司乙'}];
const orgs={a:randomUUID(),b:randomUUID()},ids={dataset:randomUUID(),finance:randomUUID(),session:randomUUID(),user:randomUUID(),proposal:randomUUID(),plan:randomUUID()};
const scope={startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[],dataCutoff:'2026-09-30T15:59:59.999Z'};
const users={a:{id:ids.user,username:'same-user',realName:'验收账号',email:'',role:'operator',ownedBy:orgs.a,companyCode:'fixture-a',companyName:companies[0].name},b:{id:ids.user,username:'same-user',realName:'验收账号',email:'',role:'viewer',ownedBy:orgs.b,companyCode:'fixture-b',companyName:companies[1].name}};
const datasets=[{id:ids.dataset,key:'mock-operations-v3',name:'界面验收模拟数据',origin:'simulated',schemaVersion:'3',analysisType:'operations',dataCutoff:scope.dataCutoff},{id:ids.finance,key:'mock-finance',name:'界面验收年度案例',origin:'public',schemaVersion:'1',analysisType:'finance',dataCutoff:scope.dataCutoff}];
const records={a:[],b:[]},messages={a:[],b:[]},lastRange={a:{datasetId:ids.dataset,scope:{...scope,organizationId:orgs.a,authorizedCampusIds:[]}},b:{datasetId:ids.dataset,scope:{...scope,organizationId:orgs.b,authorizedCampusIds:[]}}};
const sent=[],confirmations=[],checks=[],screenshots=[],errors=[],taskPatches=[],interpretationRetries=[];
const taskStates={a:{revision:1,goal:'核对当前课程出勤',userConditions:['先核对数据，再准备业务操作'],selectedObjects:[],pendingQuestions:[],datasetId:ids.dataset,scopeKey:'fixture-operations',needsReview:false,updatedAt:new Date().toISOString()},b:{revision:1,goal:'查看本公司数据',userConditions:[],selectedObjects:[],pendingQuestions:[],datasetId:ids.dataset,scopeKey:'fixture-operations',needsReview:false,updatedAt:new Date().toISOString()}};
const recoveredByKey=new Map();let conflictNextTaskPatch=false;
let loginCompany='fixture-a',pendingRun;
const ready=data=>({status:'ready',message:'',data});
const actor=request=>request.headers().authorization==='Bearer fixture-b'?'b':'a';
const session=company=>({id:ids.session,title:'连续交流验收',...lastRange[company],taskState:taskStates[company],createdBy:ids.user,editable:true,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
const detail=company=>({session:session(company),messages:messages[company],runs:records[company]});
const answer=(kind,summary,extra={})=>({kind,summary,facts:[],hypotheses:[],recommendations:[],limitations:[],...extra});
function makeRun(company,input){
 const context=input.financeScope?{datasetId:input.datasetId,scope:{...input.financeScope,organizationId:orgs[company]}}:{datasetId:input.datasetId??lastRange[company].datasetId,scope:{...(input.scope??lastRange[company].scope),organizationId:orgs[company],authorizedCampusIds:[]}};
 lastRange[company]=context;
 return {id:randomUUID(),sessionId:ids.session,status:'completed',steps:[],proposals:[],evidence:[],answer:null,errorCode:null,errorMessage:null,startedAt:new Date().toISOString(),completedAt:new Date().toISOString(),context};
}
function makePlan(run){
 const now=new Date().toISOString(),publishId=randomUUID(),segmentId=randomUUID();
 return {id:ids.plan,version:1,runId:run.id,datasetId:ids.dataset,scope:run.context.scope,status:'prepared',sourceFingerprint:'controlled-ui-fixture',createdAt:now,updatedAt:now,expiresAt:new Date(Date.now()+1800000).toISOString(),evidence:[],preview:{proposalId:ids.proposal,version:1,name:'验收出勤关注',rule:{type:'attendance_below',thresholdPercent:80,minimumDue:4},memberCount:46,unknownCount:3,expiresAt:new Date(Date.now()+1800000).toISOString()},steps:[
  {id:publishId,kind:'publish_tag',title:'发布出勤关注标签',status:'pending',input:{kind:'publish_tag',proposalId:ids.proposal,version:1,previewToken:randomUUID(),previewFingerprint:'fixture',sourceFingerprint:'controlled-ui-fixture'}},
  {id:segmentId,kind:'save_segment',title:'保存跟进人群',status:'pending',input:{kind:'save_segment',publishStepId:publishId,name:'验收待跟进人群'}},
  {id:randomUUID(),kind:'create_decision_task',title:'安排出勤跟进',status:'pending',input:{kind:'create_decision_task',sourceRunId:run.id,segmentStepId:segmentId,task:{action:'核查课程签到并记录跟进情况',priority:'normal',dueDate:'2026-10-31',reviewMethod:'复核签到完整性及后续出勤',recommendationIndex:0}}},
 ]};
}

const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),page=await context.newPage();
page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message));
await context.route('**/api/**',async route=>{
 const request=route.request(),url=new URL(request.url()),path=url.pathname,company=actor(request),body=request.postDataJSON?.()??undefined;
 const respond=async(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(path==='/api/auth/companies')return respond({companies,defaultCompanyCode:'fixture-a'});
 if(path==='/api/auth/login'){loginCompany=body.companyCode;return respond({token:loginCompany==='fixture-b'?'fixture-b':'fixture-a',user:users[loginCompany==='fixture-b'?'b':'a']});}
 if(path==='/api/auth/me')return respond({user:users[company]});
 if(path==='/api/education/datasets')return respond(ready(datasets));
 if(path==='/api/education/datasets/'+ids.dataset)return respond(ready({catalog:[{id:'course:1',kind:'course',name:'少儿编程'},{id:'campus:1',kind:'campus',name:'城东校区'}]}));
 if(path==='/api/education/datasets/'+ids.finance)return respond(ready({catalog:[{id:'2025',kind:'finance_year',name:'2025年度'}]}));
 if(path==='/api/analytics/channels/catalog')return respond(ready([]));
 if(path==='/api/agent')return respond(ready({tools:[{name:'query_metrics',description:'计算经营指标',mode:'read',status:'ready'}]}));
 if(path==='/api/agent/sessions')return respond(ready(records[company].length?[session(company)]:[]));
 if(path==='/api/agent/sessions/'+ids.session+'/task-state'&&request.method()==='PATCH'){
  taskPatches.push({company,...body});
  if(conflictNextTaskPatch){conflictNextTaskPatch=false;taskStates[company]={...taskStates[company],revision:taskStates[company].revision+1,goal:'另一页面更新的任务目标',userConditions:['先核对最新任务'],updatedAt:new Date().toISOString()};return respond({status:'error',message:'任务版本已变化'},409);}
  if(body.expectedRevision!==taskStates[company].revision)return respond({status:'error',message:'任务版本已变化'},409);
  taskStates[company]={...taskStates[company],revision:taskStates[company].revision+1,...(body.action==='clear'?{goal:null,userConditions:[],selectedObjects:[],pendingQuestions:[]}:{goal:body.goal,userConditions:body.userConditions}),updatedAt:new Date().toISOString()};
  return respond(ready(taskStates[company]));
 }
 if(path==='/api/agent/sessions/'+ids.session)return respond(ready(detail(company)));
 if(path==='/api/agent/runs/progress')return respond(ready({prepared:!!pendingRun,run:pendingRun??null,deadlineAt:new Date(Date.now()+120000).toISOString(),expired:false}));
 if(path.endsWith('/retry-interpretation')&&request.method()==='POST'){
  const original=records[company].find(run=>run.id===path.split('/').at(-2));assert.ok(original?.recoveryEligibility?.eligible);assert.deepEqual(Object.keys(body),['requestKey']);
  interpretationRetries.push({company,runId:original.id,requestKey:body.requestKey});
  const key=company+':'+body.requestKey;if(recoveredByKey.has(key))return respond(ready(recoveredByKey.get(key)));
  const facts=original.steps.flatMap(step=>step.facts??[]),run={...original,id:randomUUID(),status:'completed',answer:answer('analysis','已根据保存的依据完成解读。',{facts,recommendations:['继续核对签到完整性。']}),steps:[{id:randomUUID(),tool:'interpretation_retry',status:'completed',facts,evidence:original.evidence}],proposals:[],actionPlan:undefined,recoveryOf:{runId:original.id,kind:'interpretation'},recoveryEligibility:undefined,startedAt:new Date().toISOString(),completedAt:new Date().toISOString()};
  pendingRun={...run,status:'running',answer:null,steps:[{id:randomUUID(),tool:'interpretation_retry',status:'pending',facts,evidence:original.evidence}]};
  await new Promise(resolve=>setTimeout(resolve,2300));pendingRun=null;records[company].push(run);recoveredByKey.set(key,run);
  messages[company].push({id:randomUUID(),sessionId:ids.session,runId:run.id,role:'user',content:'仅重试已保存结果的解读',createdAt:new Date().toISOString()},{id:randomUUID(),sessionId:ids.session,runId:run.id,role:'assistant',content:JSON.stringify(run.answer),createdAt:new Date().toISOString()});
  return respond(ready(run));
 }
 if(path.startsWith('/api/agent/runs/')&&path!='/api/agent/runs/progress')return respond(ready(records[company].find(run=>run.id===path.split('/').at(-1))??null));
 if(path==='/api/agent/runs'&&request.method()==='POST'){
  sent.push({...body,company});const run=makeRun(company,body);
  if(body.message.includes('第一次'))run.answer=answer('conversation','先选择范围，再告诉我你想了解的问题。我可以查询数据，也能准备标签和人群方案。');
  else if(body.message.includes('这个课程'))run.answer=answer('clarification','你希望查看哪个课程？',{questions:[{id:'course',prompt:'请选择课程',options:[{label:'少儿编程',value:'查看少儿编程课程的出勤情况'}]}]});
  else if(body.message.includes('建成人群')){run.answer=answer('action','已准备标签、人群与跟进任务，请核对后执行。',{recommendations:['核查签到并记录服务跟进。']});run.actionPlan=makePlan(run);run.status='awaiting_confirmation';}
  else {run.answer=answer('analysis','当前出勤率为72.5%，建议先核对签到完整性。',{facts:[{id:'attendance',label:'出勤率',value:72.5,unit:'%',status:'ready',evidenceIds:['metric-1']}],hypotheses:['签到缺失是否集中于同一课程，仍需核查。'],recommendations:['先核对签到完整性。']});run.evidence=[{id:'metric-1',kind:'metric',sourceId:ids.dataset,version:'fixture',summary:'受控界面验收数据，非实际查询',scope,updatedAt:new Date().toISOString()}];}
  if(body.message.includes('解读失败')){run.status='failed';run.errorCode='model_unavailable';run.errorMessage='解读暂时失败，已保存查询结果。';run.steps=[{id:randomUUID(),tool:'query_metrics',status:'completed',facts:run.answer.facts,evidence:run.evidence}];run.answer=null;run.recoveryEligibility=body.message.includes('不可恢复')?{eligible:false,reason:'缺少可追溯的冻结数据，请重新查询。'}:body.message.includes('旧记录')?undefined:{eligible:true};}
  if(body.message.includes('慢速进度')){
   pendingRun={...run,status:'running',answer:null,completedAt:null,steps:[{id:randomUUID(),tool:'query_metrics',status:'pending',evidence:[]}]};
   await new Promise(resolve=>setTimeout(resolve,2400));
   run.steps=[{...pendingRun.steps[0],status:'completed'}];pendingRun=null;
  }
  records[company].push(run);messages[company].push({id:randomUUID(),sessionId:ids.session,runId:run.id,role:'user',content:body.message,createdAt:new Date().toISOString()},{id:randomUUID(),sessionId:ids.session,runId:run.id,role:'assistant',content:JSON.stringify(run.answer),createdAt:new Date().toISOString()});return respond(ready(run));
 }
 if(path==='/api/agent/actions'&&request.method()==='PATCH'){
  const run=records[company].find(item=>item.id===body.runId);assert.equal(run.actionPlan.version,body.version);run.actionPlan.version++;
  for(const step of run.actionPlan.steps){if(step.input.kind==='save_segment'&&body.segmentName)step.input.name=body.segmentName;if(step.input.kind==='create_decision_task'&&body.task)step.input.task=body.task;}
  return respond(ready(run));
 }
 if(path==='/api/agent/actions/confirm'){
  confirmations.push(body);const run=records[company].find(item=>item.id===body.runId);assert.equal(run.actionPlan.version,body.version);run.actionPlan.status='completed';run.status='completed';
  for(const step of run.actionPlan.steps){step.status='completed';step.result={id:randomUUID(),url:step.kind==='create_decision_task'?'/dashboard/decisions?taskId=fixture':'/dashboard/segments/risk?datasetId='+ids.dataset,label:step.kind==='create_decision_task'?'查看任务':'查看人群'};}
  return respond(ready(run));
 }
 if(path==='/api/stale-fixture'){await new Promise(resolve=>setTimeout(resolve,1800));try{return await respond(ready({company:'old-company-result'}));}catch{return;}}
 if(path==='/api/overview/query')return respond({status:'unconfigured',message:'此工具仅验收Agent界面，总览查询未配置。',data:null});
 // 其余请求全部拦截，避免遗漏而访问任何业务数据库。
 return respond(ready([]));
});
const pass=name=>{checks.push({name,passed:true});console.log('通过：'+name);};
async function showResult(){if(page.viewportSize().width<1200)await page.locator('[aria-label="智能分析区域"]').getByText(/^结果/).click();}
async function submit(text){if(page.viewportSize().width<1200)await page.locator('[aria-label="智能分析区域"]').getByText('对话',{exact:true}).click();await page.getByRole('textbox',{name:'Agent问题',exact:true}).fill(text);const response=page.waitForResponse(r=>r.url().endsWith('/api/agent/runs')&&r.request().method()==='POST');await page.getByRole('button',{name:'发送Agent问题',exact:true}).click();const result=await(await response).json();assert.equal(result.status,'ready');await showResult();await page.locator('[data-testid=agent-run-details][data-run-id="'+result.data.id+'"]').waitFor();return result.data;}
async function fillDate(label,value){const input=page.getByRole('textbox',{name:label,exact:true});await input.fill(value);await input.press('Enter');}
async function capture(name,width,height){
 await page.setViewportSize({width,height});if(await page.locator('[data-testid=agent-workspace]').count())await showResult();await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),name+' horizontal overflow '+width);
 const path=resolve(dir,name+'-'+width+'.png');await page.screenshot({path,fullPage:name!=='action-confirmation',animations:'disabled',style:'.ant-message-notice-success { visibility: hidden; }'});screenshots.push(path);
}
async function verifyMemoryAndRecovery(){
 await page.setViewportSize({width:1440,height:900});
 const memory=page.getByTestId('agent-task-memory');await memory.waitFor();
 assert.ok((await memory.textContent()).includes('查看本公司数据'));
 assert.equal((await memory.textContent()).includes('核对当前课程出勤'),false,'公司切换不能串任务记忆');
 await memory.locator('summary').click();await memory.getByRole('button',{name:/修改任务$/}).click();
 const editor=page.getByRole('dialog',{name:'修改当前任务',exact:true});
 await editor.getByRole('textbox',{name:'任务目标',exact:true}).fill('保留我的修改，核对本公司出勤');
 await editor.getByRole('textbox',{name:'任务条件',exact:true}).fill('只查看当前公司\n先核对数据，再决定下一步');
 await editor.getByRole('button',{name:/返\s*回$/}).click();
 const guard=page.getByRole('dialog',{name:'有未保存的内容',exact:true});await guard.waitFor();await guard.getByRole('button',{name:'继续编辑',exact:true}).click();
 assert.equal(await editor.getByRole('textbox',{name:'任务目标',exact:true}).inputValue(),'保留我的修改，核对本公司出勤');
 conflictNextTaskPatch=true;
 await editor.getByRole('button',{name:'保存任务',exact:true}).click();
 await editor.getByText('当前任务已被更新，输入已保留。请核对最新任务后再保存。',{exact:true}).waitFor();
 await editor.getByText('另一页面更新的任务目标',{exact:true}).waitFor();
 assert.equal(await editor.getByRole('textbox',{name:'任务目标',exact:true}).inputValue(),'保留我的修改，核对本公司出勤');
 await editor.getByRole('button',{name:'使用最新版本继续编辑',exact:true}).click();await editor.getByRole('button',{name:'保存任务',exact:true}).click();await editor.waitFor({state:'hidden'});
 assert.deepEqual(taskPatches.slice(-2).map(patch=>patch.expectedRevision),[1,2]);
 assert.equal(taskStates.b.goal,'保留我的修改，核对本公司出勤');assert.equal(taskStates.a.goal,'核对当前课程出勤');
 await capture('task-memory',1440,900);
 const savedRuns=records.b.length;
 await memory.getByRole('button',{name:/清\s*除$/}).click();
 const clear=page.getByRole('dialog',{name:'清除当前任务记忆？',exact:true});await clear.getByRole('button',{name:'清除任务记忆',exact:true}).click();await clear.waitFor({state:'hidden'});
 assert.equal(taskStates.b.goal,null);assert.deepEqual(taskStates.b.userConditions,[]);assert.equal(records.b.length,savedRuns);
 await memory.locator('summary').getByText('尚未设置目标',{exact:true}).waitFor();
 pass('当前任务跨公司隔离、修改与清除、编辑保护及409保留输入并核对新版本');

 const failed=await submit('受控解读失败：已取得出勤数据');
 assert.equal((await page.getByTestId('agent-conversation-turn-'+failed.id).locator('button').textContent()).includes('null'),false,'缺失解读正文不得显示原始JSON null');
 assert.ok((await page.getByTestId('agent-conversation-turn-'+failed.id).locator('button').textContent()).includes('数据已查到，智能解读未完成。请查看保留结果。'));
 const original=JSON.stringify(records.b.find(run=>run.id===failed.id));
 await page.getByRole('button',{name:'修改范围',exact:true}).click();await fillDate('Agent开始日期','2026-07-01');await page.getByRole('dialog',{name:'修改分析范围',exact:true}).getByRole('button',{name:'应用范围',exact:true}).click();
 const normalQueries=sent.length,confirmedBefore=confirmations.length;
 const response=page.waitForResponse(result=>result.url().endsWith('/retry-interpretation')&&result.request().method()==='POST');
 await page.getByRole('button',{name:'仅重试解读',exact:true}).evaluate(button=>{button.click();button.click();});
 await page.getByText(/已等待 \d+ 秒/).waitFor();assert.equal(await memory.getByRole('button',{name:/修改任务$/}).isDisabled(),true);
 const result=await(await response).json();assert.equal(result.status,'ready');
 await page.locator('[data-testid=agent-run-details][data-run-id="'+result.data.id+'"]').waitFor();
 assert.equal(interpretationRetries.length,1,'连续点击只提交一次解读请求');assert.equal(sent.length,normalQueries,'仅解读不触发普通数据查询运行');assert.equal(confirmations.length,confirmedBefore);
 assert.equal(JSON.stringify(records.b.find(run=>run.id===failed.id)),original,'源失败回答不改写');
 assert.equal(JSON.parse(new URL(page.url()).searchParams.get('scope')).startDate,'2026-07-01','仅解读不覆盖下一轮范围');
 assert.ok((await page.getByTestId('agent-frozen-scope').textContent()).includes(failed.context.scope.startDate),'新回答仍冻结源范围');
 assert.equal(result.data.proposals.length,0);assert.equal(result.data.actionPlan,undefined);assert.ok(result.data.steps.every(step=>step.tool==='interpretation_retry'));
 await page.getByTestId('agent-recovery-source').waitFor();await capture('saved-result-interpretation',1440,900);await capture('saved-result-interpretation',390,844);
 await page.setViewportSize({width:1440,height:900});
 await page.getByTestId('agent-recovery-source').getByRole('button',{name:'查看原回答',exact:true}).click();await page.locator('[data-testid=agent-run-details][data-run-id="'+failed.id+'"]').waitFor();
 const completedCount=records.b.length,reusedResponse=page.waitForResponse(result=>result.url().endsWith('/retry-interpretation')&&result.request().method()==='POST');
 await page.getByRole('button',{name:'仅重试解读',exact:true}).click();await reusedResponse;
 await page.locator('[data-testid=agent-run-details][data-run-id="'+result.data.id+'"]').waitFor();
 assert.equal(interpretationRetries[0].requestKey,interpretationRetries[1].requestKey);assert.equal(records.b.length,completedCount,'同一恢复来源重试沿用幂等键');
 pass('仅重试解读的实时进度、防重复点击、原回答关联及源范围和下一轮范围隔离');

 await submit('不可恢复解读失败');
 await page.getByText('缺少可追溯的冻结数据，请重新查询。',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'仅重试解读',exact:true}).count(),0);
 const beforeQuery=sent.length;await page.getByRole('button',{name:'重新查询',exact:true}).click();assert.equal(sent.length,beforeQuery);assert.equal(await page.getByRole('textbox',{name:'Agent问题',exact:true}).inputValue(),'不可恢复解读失败');
 await page.getByRole('textbox',{name:'Agent问题',exact:true}).fill('');
 await submit('旧记录解读失败');await page.getByRole('button',{name:'重新发送问题',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'仅重试解读',exact:true}).count(),0);
 pass('不满足恢复条件展示原因和重新查询，旧记录保留原重发入口');

 // Final visual pass keeps every API in the fixture. A real edit through the task
 // form supplies both a readable summary and expanded conditions for all sizes.
 if(!await memory.evaluate(node=>node.open))await memory.locator('summary').click();
 await memory.getByRole('button',{name:/修改任务$/}).click();
 const visualEditor=page.getByRole('dialog',{name:'修改当前任务',exact:true});
 await visualEditor.getByRole('textbox',{name:'任务目标',exact:true}).fill('核对出勤变化，准备后续跟进');
 await visualEditor.getByRole('textbox',{name:'任务条件',exact:true}).fill('先核对签到完整性，未知记录单独说明\n只使用当前公司的保存结果，正式操作仍需页面确认');
 await visualEditor.getByRole('button',{name:'保存任务',exact:true}).click();await visualEditor.waitFor({state:'hidden'});
 const recoveredLocation=new URL(page.url());recoveredLocation.searchParams.set('runId',result.data.id);
 await page.goto(recoveredLocation.toString(),{waitUntil:'networkidle'});await page.locator('[data-testid=agent-run-details][data-run-id="'+result.data.id+'"]').waitFor();
 for(const theme of ['light','dark']){
  if(await page.evaluate(()=>document.body.dataset.theme)!==theme){await page.getByRole('button',{name:theme==='dark'?'切换深色主题':'切换浅色主题',exact:true}).click();await page.waitForFunction(value=>document.body.dataset.theme===value,theme);}
  for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[390,844]]){
   await page.setViewportSize({width,height});
   const currentMemory=page.getByTestId('agent-task-memory');
   if(await currentMemory.evaluate(node=>node.open))await currentMemory.locator('summary').click();
   if(width<1200)await page.locator('[aria-label="智能分析区域"]').getByText('对话',{exact:true}).click();
   const composer=page.getByTestId('agent-composer');await composer.waitFor();
   const initialComposer=await composer.boundingBox();assert.ok(initialComposer&&initialComposer.y>=0&&initialComposer.y+initialComposer.height<=height+2,'当前任务摘要不能把输入推到首屏外 '+width+' '+theme);
   await page.getByRole('log',{name:'对话记录',exact:true}).evaluate(node=>{node.scrollTop=0;});
   const pinned=await composer.boundingBox();assert.ok(pinned&&Math.abs(pinned.y-initialComposer.y)<2,'长对话滚动后输入位置保持固定 '+width+' '+theme);
   await showResult();await page.getByTestId('agent-recovery-source').waitFor();
   await capture('recovery-task-summary-'+theme,width,height);
   await currentMemory.locator('summary').click();
   const geometry=await currentMemory.evaluate(node=>{
    const body=node.querySelector('[class*="taskMemoryBody"]'),summary=node.querySelector('summary'),box=node.getBoundingClientRect();
    return {left:box.left,right:box.right,viewport:innerWidth,summaryHeight:summary?.getBoundingClientRect().height??0,body:body?{client:body.clientWidth,scroll:body.scrollWidth}:null,buttons:[...node.querySelectorAll('button')].map(button=>({client:button.clientWidth,scroll:button.scrollWidth,visible:button.getBoundingClientRect().width>0}))};
   });
   assert.ok(geometry.left>=-2&&geometry.right<=geometry.viewport+2&&geometry.summaryHeight>=20,'任务面板和摘要需完整处于页面内 '+width+' '+theme);
   assert.ok(geometry.body&&geometry.body.client>0&&geometry.body.scroll<=geometry.body.client+2,'任务条件不能横向溢出 '+width+' '+theme);
   assert.equal(geometry.buttons.length,2);assert.ok(geometry.buttons.every(button=>button.visible&&button.client>0&&button.scroll<=button.client+2),'修改与清除按钮应完整可读 '+width+' '+theme);
   if(width<1200)await page.locator('[aria-label="智能分析区域"]').getByText('对话',{exact:true}).click();
   const expandedComposer=await page.getByTestId('agent-composer').boundingBox();
   assert.ok(expandedComposer&&expandedComposer.y>=0&&expandedComposer.y+expandedComposer.height<=height+2,'任务展开后输入仍需完整处于首屏 '+width+' '+theme);
   await showResult();
   await capture('recovery-task-expanded-'+theme,width,height);
   await currentMemory.locator('summary').click();
  }
 }
 pass('当前任务摘要与展开面板、恢复结果四尺寸浅深色，输入固定且条件和操作不溢出');
}
try{
 await page.goto(base+'/auth/login',{waitUntil:'networkidle'});await page.getByRole('combobox',{name:'登录公司',exact:true}).waitFor();for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[390,844]]){await capture('login',width,height);if(width===390){const loginBox=await page.getByRole('button',{name:/登\s*录$/}).boundingBox();assert.ok(loginBox&&loginBox.y+loginBox.height<height,'mobile login submit visible above fold');}}await page.setViewportSize({width:1440,height:900});await page.locator('input[autocomplete=username]').fill('same-user');await page.locator('input[autocomplete=current-password]').fill('fixture-password');await page.getByRole('button',{name:/登\s*录$/}).click();await page.waitForURL('**/dashboard');assert.equal(loginCompany,'fixture-a');pass('登录页明确选择公司并提交公司代码');
 const params=new URLSearchParams({datasetId:ids.dataset,scope:JSON.stringify(scope)});await page.goto(base+'/dashboard/agent?'+params,{waitUntil:'networkidle'});await page.locator('[data-testid=agent-company]').getByText(companies[0].name,{exact:true}).waitFor();
 await submit('我第一次使用，怎么创建人群？');assert.equal(await page.locator('[data-testid=agent-facts]').count(),0);pass('普通交流不展示虚假经营数字或空事实卡');
 const sessionId=sent.at(-1).sessionId??ids.session;await submit('这个课程的情况怎么样？');await page.locator('[data-testid=agent-clarification]').waitFor();await capture('clarification',1440,900);await page.getByRole('button',{name:'少儿编程',exact:true}).click();assert.equal(await page.getByRole('textbox',{name:'Agent问题',exact:true}).inputValue(),'查看少儿编程课程的出勤情况');await submit('查看少儿编程课程的出勤情况');assert.equal(sent.at(-1).sessionId,sessionId);await page.locator('[data-testid=agent-run-details]').getByText('当前出勤率为72.5%',{exact:false}).waitFor();pass('澄清选项与同会话连续追问');
 await page.getByRole('button',{name:'修改范围',exact:true}).click();await fillDate('Agent开始日期','2026-07-01');await page.getByRole('dialog',{name:'修改分析范围',exact:true}).getByRole('button',{name:'应用范围',exact:true}).click();assert.ok((await page.locator('[data-testid=agent-frozen-scope]').textContent()).includes('2026-08-01'));await submit('查看更长周期的出勤情况');assert.equal(sent.at(-1).sessionId,sessionId);assert.equal(sent.at(-1).scope.startDate,'2026-07-01');assert.ok((await page.locator('[data-testid=agent-frozen-scope]').textContent()).includes('2026-07-01'));pass('同会话调整范围，旧轮结果与下一轮范围不混用');
 await submit('把这批学员建成人群，并安排跟进');await page.getByRole('button',{name:'查看操作计划',exact:true}).click();await page.locator('[data-testid=agent-action-plan]').waitFor();assert.equal(confirmations.length,0);await page.locator('[data-testid=agent-action-plan]').getByRole('button',{name:'修改计划',exact:true}).click();const edit=page.getByRole('dialog',{name:'修改操作计划',exact:true});await edit.getByRole('textbox',{name:'人群名称',exact:true}).fill('核对后的人群名称');await edit.getByRole('button',{name:'保存新版本',exact:true}).click();await edit.waitFor({state:'hidden'});for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[390,844]])await capture('action-plan',width,height);await page.setViewportSize({width:1440,height:900});assert.ok((await page.locator('[data-testid=agent-action-plan]').textContent()).includes('核对后的人群名称'));await page.locator('[data-testid=agent-action-plan]').getByRole('button',{name:'核对并执行',exact:true}).click();const confirm=page.getByRole('dialog',{name:/确认执行操作计划/});await confirm.getByText('覆盖 46 人',{exact:true}).waitFor();await confirm.getByText('未知 3 人',{exact:true}).waitFor();await capture('action-confirmation',1440,900);await confirm.getByRole('button',{name:'确认执行以上操作',exact:true}).click();await confirm.waitFor({state:'hidden'});assert.equal(confirmations.length,1);assert.equal(confirmations[0].version,2);await page.locator('[data-testid=agent-action-plan]').getByRole('link',{name:'查看任务',exact:true}).waitFor();pass('草稿自动准备、计划编辑、一次确认及结果入口');
 const progressResponse=page.waitForResponse(r=>r.url().endsWith('/api/agent/runs')&&r.request().method()==='POST');await page.getByRole('textbox',{name:'Agent问题',exact:true}).fill('慢速进度：解释出勤变化');await page.getByRole('button',{name:'发送Agent问题',exact:true}).click();await page.getByText(/已等待 \d+ 秒/).waitFor();await page.locator('[data-testid=agent-conversation-pane]').getByText('计算经营指标 · 进行中',{exact:true}).waitFor();await progressResponse;await page.locator('[data-testid=agent-run-details][data-run-id="'+records.a.at(-1).id+'"]').waitFor();pass('请求完成前显示真实工具步骤及已用时间'); const conversationBox=await page.locator('[data-testid=agent-conversation-pane]').boundingBox(),resultBox=await page.locator('[data-testid=agent-result-pane]').boundingBox(),composerBox=await page.locator('[data-testid=agent-composer]').boundingBox();assert.ok(conversationBox&&resultBox&&composerBox);assert.ok(resultBox.x>=conversationBox.x+conversationBox.width,'桌面对话与结果应为独立左右栏');assert.ok(composerBox.y+composerBox.height<=900,'输入区始终位于首屏');assert.ok(conversationBox.width/resultBox.width>1.1&&conversationBox.width/resultBox.width<1.4,'左右分区约55:45');const feed=page.getByRole('log',{name:'对话记录',exact:true});assert.ok(await feed.evaluate(node=>node.scrollHeight>node.clientHeight),'多轮对话在消息区内滚动');await feed.evaluate(node=>{node.scrollTop=0;});const pinnedComposer=await page.locator('[data-testid=agent-composer]').boundingBox();assert.ok(Math.abs(pinnedComposer.y-composerBox.y)<2,'阅读历史不会推走输入框');await page.locator('[data-testid=agent-result-pane]').getByRole('tab',{name:'数据依据',exact:true}).click();await page.locator('[data-testid=agent-evidence]').waitFor();await page.locator('[data-testid=agent-result-pane]').getByRole('tab',{name:'结果',exact:true}).click();const previousRun=records.a.at(-2);await page.getByRole('button',{name:'查看第'+(records.a.length-1)+'轮分析结果',exact:true}).click();assert.equal(new URL(page.url()).searchParams.get('runId'),previousRun.id);await page.locator('[data-testid=agent-run-details][data-run-id="'+previousRun.id+'"]').waitFor();await page.reload({waitUntil:'networkidle'});await page.locator('[data-testid=agent-run-details][data-run-id="'+previousRun.id+'"]').waitFor();assert.ok((await page.locator('[data-testid=agent-frozen-scope]').textContent()).includes(previousRun.context.scope.startDate),'历史轮次刷新后仍读取冻结范围');await page.getByRole('button',{name:/历史会话$/}).click();await page.getByRole('dialog',{name:'历史会话',exact:true}).getByRole('combobox',{name:'Agent执行结果',exact:true}).waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'历史会话',exact:true}).waitFor({state:'hidden'});pass('分区布局、固定输入、独立滚动及历史结果刷新恢复');
 for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[390,844]]){await page.setViewportSize({width,height});await showResult();await page.locator('[data-testid=agent-run-details]').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Agent横向溢出 '+width);await capture('agent',width,height);}pass('四种屏幕宽度与完整日期展示');
 await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:'修改范围',exact:true}).click();await page.getByRole('combobox',{name:'Agent数据集',exact:true}).click();await page.getByText('[公开] 界面验收年度案例',{exact:true}).click();await page.getByRole('dialog',{name:'修改分析范围',exact:true}).getByRole('button',{name:'应用范围',exact:true}).click();const source=page.getByRole('dialog',{name:'切换本次对话的数据来源？',exact:true});await source.getByRole('button',{name:'切换并继续对话',exact:true}).click();await submit('查看年度案例范围');assert.equal(sent.at(-1).sessionId,sessionId);assert.ok(sent.at(-1).financeScope);assert.equal(sent.at(-1).scope,undefined);pass('切换数据集需明确确认且学习/经营/财务范围互斥');
 await page.evaluate(()=>{window.__staleResult='pending';fetch('/api/stale-fixture').then(r=>r.json()).then(()=>{window.__staleResult='leaked';}).catch(error=>{window.__staleResult=error.name;});});await page.getByRole('button',{name:/same-user/}).click();await page.getByRole('menuitem',{name:/退出登录/}).click();await page.waitForURL('**/auth/login');await page.waitForFunction(()=>window.__staleResult==='AbortError');await page.getByRole('combobox',{name:'登录公司',exact:true}).click();await page.getByText(companies[1].name,{exact:true}).click();await page.locator('input[autocomplete=username]').fill('same-user');await page.locator('input[autocomplete=current-password]').fill('fixture-password');await page.getByRole('button',{name:/登\s*录$/}).click();await page.waitForURL('**/dashboard');await page.goto(base+'/dashboard/agent?'+params,{waitUntil:'networkidle'});await page.locator('[data-testid=agent-company]').getByText(companies[1].name,{exact:true}).waitFor();assert.equal(await page.locator('[data-testid=agent-action-plan]').count(),0);await submit('我第一次使用，怎么查询？');assert.equal(sent.at(-1).company,'b');assert.equal(sent.at(-1).sessionId,undefined);pass('同名只读账号可交流，切换公司不回显旧会话和操作计划');
 await verifyMemoryAndRecovery();
 assert.deepEqual(errors,[],'页面错误');await writeFile(resolve(dir,'result.json'),JSON.stringify({mode:'controlled-api-ui-only',databaseWrites:0,cloudModelCalls:0,checks,screenshots,errors},null,2));console.log(JSON.stringify({checks:checks.length,screenshots:screenshots.length,artifactDir:dir}));
}catch(error){await page.screenshot({path:resolve(dir,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(resolve(dir,'failure.json'),JSON.stringify({error:error.message,errors,body:await page.locator('body').innerText().catch(()=>''),checks},null,2));throw error;}finally{await browser.close();}
