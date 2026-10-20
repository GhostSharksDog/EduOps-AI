// 受控页面验收：所有API均被夹具拦截，不读取配置、数据库或真实模型。
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from '@playwright/test';

const base=process.env.LOCAL_QA_BASE_URL??'http://localhost:3303',address=new URL(base);
assert.ok(['localhost','127.0.0.1'].includes(address.hostname)&&address.port==='3303','仅允许专用3303页面服务');
const dir=resolve(process.env.LOCAL_QA_ARTIFACT_DIR??'tests/artifacts/agent-assistance-qa/ui');await mkdir(dir,{recursive:true});
const ids={company:randomUUID(),user:randomUUID(),dataset:randomUUID(),a:randomUUID(),b:randomUUID()};
const scope={startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[],dataCutoff:'2026-09-30T15:59:59.999Z'};
const user={id:ids.user,username:'ux-fixture',realName:'界面验收',email:'',role:'operator',ownedBy:ids.company,companyCode:'ux-fixture',companyName:'受控验收公司'};
const dataset={id:ids.dataset,key:'controlled-ux',name:'受控模拟经营数据',origin:'simulated',schemaVersion:'3',analysisType:'operations',dataCutoff:scope.dataCutoff};
const ready=data=>({status:'ready',message:'',data}),now=()=>new Date().toISOString();
const answer=(kind,summary,extra={})=>({kind,summary,facts:[],hypotheses:[],recommendations:[],limitations:[],...extra});
const evidence={id:'ux-metric@v1',kind:'metric',sourceId:ids.dataset,version:'v1',summary:'受控页面夹具，不代表真实查询',scope,updatedAt:now()};
const fact={id:'attendance_rate:value',label:'出勤率',value:72.5,unit:'%',status:'ready',evidenceIds:[evidence.id]};
const series={id:'ux-trend',title:'出勤率趋势',kind:'line',metricCodes:['attendance_rate'],unit:'%',categories:['2026-06','2026-07','2026-08'],categoryLabel:'统计月份',series:[{name:'出勤率',points:[{value:82,status:'ready'},{value:null,status:'unknown'},{value:72.5,status:'ready'}]}],evidenceIds:[evidence.id],source:{datasetId:ids.dataset,datasetName:dataset.name,origin:'simulated',analysisType:'operations',scope},note:'未知数据保留断点，不补零。'};
const stores=new Map([ids.a,ids.b].map((id,index)=>[id,{session:{id,title:index?'会话乙：续费工作':'会话甲：出勤工作',datasetId:ids.dataset,scope:{...scope,organizationId:ids.company,authorizedCampusIds:[]},createdBy:ids.user,editable:true,createdAt:now(),updatedAt:now()},messages:[],runs:[]}]));
const sent=[],writes=[],checks=[],screenshots=[],errors=[],pending=new Map();
function buildRun(sessionId,input={}){
 const context={datasetId:ids.dataset,scope:{...(input.scope??scope),organizationId:ids.company,authorizedCampusIds:[]}};
 return {id:randomUUID(),sessionId,status:'completed',context,steps:[{id:randomUUID(),tool:'query_metrics',status:'completed',context,facts:[fact],evidence:[evidence],visualizations:[series]}],proposals:[],evidence:[evidence],answer:answer('analysis','出勤下降，先核查签到完整性。',{facts:[fact],hypotheses:['签到缺失是否集中于同一课程，仍需核对。'],recommendations:['核对课程签到。']}),startedAt:now(),completedAt:now(),errorCode:null,errorMessage:null};
}
function save(run,question){
 const store=stores.get(run.sessionId);store.runs.push(run);store.session.scope=run.context.scope;store.session.updatedAt=now();
 store.messages.push({id:randomUUID(),sessionId:run.sessionId,runId:run.id,role:'user',content:question,createdAt:now()},{id:randomUUID(),sessionId:run.sessionId,runId:run.id,role:'assistant',content:JSON.stringify(run.answer),createdAt:now()});
}
const initial=buildRun(ids.a);save(initial,'查看出勤变化');
const other=buildRun(ids.b);other.answer=answer('conversation','这是会话乙的保存结果。');other.steps=[];other.evidence=[];save(other,'查看乙会话');
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),page=await context.newPage();
page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
await context.addInitScript(value=>{localStorage.setItem('auth_token','controlled-fixture');localStorage.setItem('auth_user',JSON.stringify(value));},user);
await context.route('**/api/**',async route=>{
 const request=route.request(),url=new URL(request.url()),path=url.pathname,body=request.postData()?request.postDataJSON():undefined;
 const respond=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(path==='/api/auth/me')return respond({user});
 if(path==='/api/settings')return respond({sessionTimeout:30,pageSize:20,language:'zh-CN',theme:'light'});
 if(path==='/api/education/datasets')return respond(ready([dataset]));
 if(path==='/api/education/datasets/'+ids.dataset)return respond(ready({catalog:[{id:'course-a',kind:'course',name:'少儿编程'},{id:'campus-a',kind:'campus',name:'城东校区'}]}));
 if(path==='/api/analytics/channels/catalog')return respond(ready([]));
 if(path==='/api/agent')return respond(ready({tools:[{name:'query_metrics',description:'计算指标',mode:'read',status:'ready'}]}));
 if(path==='/api/agent/sessions')return respond(ready([...stores.values()].map(store=>store.session)));
 if(path.startsWith('/api/agent/sessions/'))return respond(ready(stores.get(path.split('/').at(-1))??null));
 if(path==='/api/agent/runs/progress'){
  const item=[...pending.values()].find(item=>item.key===url.searchParams.get('requestKey')||item.run.id===url.searchParams.get('runId'));
  return respond(ready({prepared:!!item,run:item?.run??null,expired:false,deadlineAt:new Date(Date.now()+120000).toISOString()}));
 }
 if(path==='/api/agent/runs'&&request.method()==='POST'){
  sent.push(body);const run=buildRun(body.sessionId??ids.a,body),text=body.message;
  if(text.includes('单个澄清')){run.answer=answer('clarification','请选择课程。',{questions:[{id:'course',prompt:'请选择课程',options:[{label:'少儿编程',value:'少儿编程课程'}]}]});run.steps=[];run.evidence=[];}
  else if(text.includes('多个澄清')){run.answer=answer('clarification','请补充课程和关注方向。',{questions:[{id:'course',prompt:'选择课程',options:[{label:'少儿编程',value:'少儿编程课程'}]},{id:'topic',prompt:'选择关注方向',options:[{label:'出勤变化',value:'出勤变化'}]}]});run.steps=[];run.evidence=[];}
  else if(text.includes('按课程拆解'))run.steps[0]={...run.steps[0],tool:'query_metric_breakdown',input:{dimension:'course'}};
  else if(text.includes('准备操作')){
   const created=now();run.status='awaiting_confirmation';run.answer=answer('action','方案已准备，正式执行前请核对。');
   run.actionPlan={id:randomUUID(),version:1,runId:run.id,datasetId:ids.dataset,scope:run.context.scope,status:'prepared',sourceFingerprint:'controlled-fixture',createdAt:created,updatedAt:created,expiresAt:new Date(Date.now()+1800000).toISOString(),evidence:[],steps:[{id:randomUUID(),kind:'generate_report',title:'生成经营月报',status:'pending',input:{kind:'generate_report',kindOfReport:'monthly',anchorDate:'2026-08-31'}}]};
  }
  if(text.includes('等待验收')){
   run.status='running';run.completedAt=null;run.answer=null;run.steps[0].status='pending';save(run,text);
   let release;const gate=new Promise(resolve=>{release=resolve;});pending.set(run.id,{run,key:body.requestKey,release});await gate;
   run.status='completed';run.completedAt=now();run.answer=answer('analysis','慢速分析已完成。',{facts:[fact]});run.steps[0].status='completed';pending.delete(run.id);
   try{return await respond(ready(run));}catch{return;}
  }
  save(run,text);return respond(ready(run));
 }
 if(!['GET','HEAD'].includes(request.method())&&!['/api/overview/journey/query','/api/overview/query'].includes(path))writes.push({method:request.method(),path});
 // 页面未涉及的读取和引导均返回空态，绝不放行至真实API。
 return respond(ready([]));
});
const pass=name=>{checks.push({name,passed:true});console.log('通过：'+name);};
const prompt=()=>page.getByRole('textbox',{name:'Agent问题',exact:true});
const sendButton=()=>page.getByRole('button',{name:'发送Agent问题',exact:true});
const details=id=>page.locator('[data-testid="agent-run-details"][data-run-id="'+id+'"]');
async function conversation(){if(page.viewportSize().width<1200)await page.locator('[aria-label="智能分析区域"]').getByText('对话',{exact:true}).click();}
async function result(){if(page.viewportSize().width<1200)await page.locator('[aria-label="智能分析区域"]').getByText(/^结果/).click();}
async function submit(text){
 await conversation();await prompt().fill(text);const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/agent/runs'&&r.request().method()==='POST');
 await sendButton().click();const body=await(await response).json();await result();await details(body.data.id).waitFor();return body.data;
}
async function chooseSession(id){await page.getByRole('button',{name:/历史会话$/}).click();await page.getByRole('dialog',{name:'历史会话',exact:true}).getByRole('button',{name:new RegExp(id===ids.a?'会话甲':'会话乙')}).click();await page.getByRole('dialog',{name:'历史会话',exact:true}).waitFor({state:'hidden'});}
async function chooseRun(run){await conversation();await page.getByTestId('agent-conversation-turn-'+run.id).getByRole('button').click();await result();await details(run.id).waitFor();}
async function capture(name){const path=resolve(dir,name+'.png');await page.screenshot({path,fullPage:false,animations:'disabled'});screenshots.push(path);}

try{
 const params=new URLSearchParams({datasetId:ids.dataset,scope:JSON.stringify(scope),sessionId:ids.a,runId:initial.id});
 await page.goto(base+'/dashboard/agent?'+params,{waitUntil:'networkidle'});await details(initial.id).waitFor();
 const actions=()=>page.getByTestId('agent-context-actions');
 assert.equal(await actions().getByRole('button').count(),2);await actions().getByRole('button',{name:'比较课程出勤',exact:true}).waitFor();
 const broken=await submit('按课程拆解出勤变化');await actions().getByRole('button',{name:'预览需关注的学员',exact:true}).waitFor();
 assert.ok(await actions().getByRole('button').count()<=2);assert.equal(await page.getByTestId('agent-composer').getByRole('button',{name:'生成经营报告',exact:true}).count(),0);
 pass('根据实际工具结果更换下一步，最多两个动作且不重复固定示例');

 const visual=page.getByTestId('agent-analysis-visuals');await visual.waitFor();await visual.getByRole('img').first().waitFor();
 assert.match(await visual.getByRole('img').first().getAttribute('aria-label'),/出勤率趋势/);assert.ok(await visual.locator('svg').count()>0,'实际图表SVG需渲染');
 await visual.getByText('查看图表数据',{exact:true}).click();const table=visual.getByRole('table');await table.waitFor();
 assert.ok((await table.textContent()).includes('未知'));assert.ok((await table.textContent()).includes('72.5'));
 await visual.getByText('统计范围与来源',{exact:true}).click();assert.ok((await visual.textContent()).includes(dataset.name));assert.ok((await visual.textContent()).includes(scope.startDate));
 assert.ok((await visual.textContent()).includes('模拟经营'));await capture('chart-and-unknown-table');pass('真实图表契约、数据表未知值和来源范围可核查');

 await submit('单个澄清');let before=sent.length;let nextResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/agent/runs'&&r.request().method()==='POST');
 await actions().getByRole('button',{name:'少儿编程',exact:true}).click();const clarified=await(await nextResponse).json();await details(clarified.data.id).waitFor();
 assert.equal(sent.length,before+1);assert.match(sent.at(-1).message,/请选择课程.*少儿编程课程/);pass('单个普通澄清一键继续，仍调用正常分析请求');
 await submit('多个澄清');before=sent.length;await actions().getByRole('button',{name:'少儿编程',exact:true}).click();assert.equal(sent.length,before);
 assert.equal(await actions().getByRole('button',{name:'补充并继续',exact:true}).isDisabled(),true);await actions().getByRole('button',{name:'出勤变化',exact:true}).click();
 nextResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/agent/runs'&&r.request().method()==='POST');await actions().getByRole('button',{name:'补充并继续',exact:true}).click();await nextResponse;
 assert.equal(sent.length,before+1);assert.match(sent.at(-1).message,/选择课程.*少儿编程课程/);assert.match(sent.at(-1).message,/选择关注方向.*出勤变化/);pass('多个澄清完整选择后汇总，只发送一次');

 await submit('单个澄清');await prompt().fill('这段文字还没提交');before=sent.length;await actions().getByRole('button',{name:'少儿编程',exact:true}).click();
 const guard=page.getByRole('dialog',{name:'有未保存的内容',exact:true});await guard.waitFor();await guard.getByRole('button',{name:'继续编辑',exact:true}).click();
 assert.equal(await prompt().inputValue(),'这段文字还没提交');assert.equal(sent.length,before);await prompt().fill('');pass('一键澄清遇到未提交问题先保护，不覆盖或自动提交原稿');

 await prompt().fill('等待验收：查看新的出勤变化');const completed=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/agent/runs'&&r.request().method()==='POST',{timeout:0});completed.catch(()=>{});await sendButton().click();
 await page.getByText(/已等待 \d+ 秒/).waitFor();await prompt().fill('等分析时先写下一问');assert.equal(await prompt().isDisabled(),false);before=sent.length;
 await prompt().press('Control+Enter');assert.equal(sent.length,before);assert.equal(await sendButton().isDisabled(),true);
 await chooseRun(initial);const progress=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/agent/runs/progress');await progress;assert.equal(await details(initial.id).count(),1);
 const active=[...pending.values()][0];assert.ok(active);active.release();await completed;await page.waitForFunction(()=>!document.querySelector('[aria-label="发送Agent问题"]')?.disabled);
 assert.equal(await prompt().inputValue(),'等分析时先写下一问');assert.equal(await details(initial.id).count(),1);await prompt().fill('');pass('等待时起草且防重复，进度及完成不夺回历史选择、不清新输入');

 await conversation();await prompt().fill('等待验收：离开后不串会话');await sendButton().click();await page.getByText(/已等待 \d+ 秒/).waitFor();
 await chooseSession(ids.b);await details(other.id).waitFor();const detached=[...pending.values()][0];assert.ok(detached);detached.release();
 await page.waitForTimeout(250);assert.equal(await details(other.id).count(),1);assert.equal(await prompt().inputValue(),'');assert.equal(new URL(page.url()).searchParams.get('sessionId'),ids.b);
 await chooseSession(ids.a);await chooseRun(broken);pass('执行中可切换会话，晚响应不覆盖另一会话，返回读取保存结果');

 await page.getByRole('button',{name:'修改范围',exact:true}).click();const range=page.getByRole('dialog',{name:'修改分析范围',exact:true});
 await range.getByRole('textbox',{name:'Agent开始日期',exact:true}).fill('2026-07-01');await range.getByRole('textbox',{name:'Agent开始日期',exact:true}).press('Enter');await range.getByRole('button',{name:'应用范围',exact:true}).click();
 before=sent.length;await actions().getByRole('button',{name:'按该回答范围继续',exact:true}).click();const scopeConfirm=page.getByRole('dialog',{name:'按这条回答的范围继续？',exact:true});await scopeConfirm.waitFor();
 assert.equal(sent.length,before);assert.ok((await scopeConfirm.textContent()).includes('2026-08-01'));await scopeConfirm.getByRole('button',{name:'使用该范围',exact:true}).click();
 assert.equal(sent.length,before);await actions().getByRole('button',{name:'预览需关注的学员',exact:true}).waitFor();pass('历史范围继续先核对并确认，只切换范围，不直接执行模型或业务写入');

 await submit('准备操作');before=writes.length;await actions().getByRole('button',{name:'核对操作计划',exact:true}).click();const plan=page.getByTestId('agent-action-plan');await plan.waitFor();
 await plan.getByRole('button',{name:'核对并执行',exact:true}).click();const confirmation=page.getByRole('dialog',{name:/确认执行操作计划/});await confirmation.waitFor();
 assert.equal(writes.length,before);await capture('manual-operation-confirmation');await confirmation.getByRole('button',{name:'返回核对',exact:true}).click();await capture('prepared-operation-card');pass('建议仅打开人工确认卡，未确认没有正式操作请求');

 await chooseRun(broken);
 for(const theme of ['light','dark']){
  if(await page.evaluate(()=>document.body.dataset.theme)!==theme){await page.getByRole('button',{name:theme==='dark'?'切换深色主题':'切换浅色主题',exact:true}).click();await page.waitForFunction(value=>document.body.dataset.theme===value,theme);}
  for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[390,844]]){
   await page.setViewportSize({width,height});await conversation();await prompt().waitFor();
   const composer=page.getByTestId('agent-composer'),box=await composer.boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=height+2,'固定输入区首屏可见 '+width);
   await page.getByRole('log',{name:'对话记录',exact:true}).evaluate(node=>{node.scrollTop=0;});const moved=await composer.boundingBox();assert.ok(moved&&Math.abs(moved.y-box.y)<2,'历史滚动不移动输入 '+width);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'整页不溢出 '+width);await capture('conversation-'+theme+'-'+width);
   await result();await page.getByTestId('agent-analysis-visuals').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'图表不撑宽 '+width);await capture('result-'+theme+'-'+width);
  }
 }
 pass('四尺寸浅深主题、双区和手机切换、长对话固定输入及图表无横向溢出');
 assert.deepEqual(writes,[],'正式写入请求必须全部经人工确认，本脚本不执行确认');assert.deepEqual(errors,[],'无页面异常');
 await writeFile(resolve(dir,'result.json'),JSON.stringify({kind:'controlled-ui',businessDatabaseUsed:false,cloudModelCalls:0,checks,screenshots,errors,unexpectedWrites:writes,submittedQuestions:sent.length},null,2));
 console.log(JSON.stringify({passed:checks.length,screenshots:screenshots.length,errors:errors.length}));
}catch(error){await page.screenshot({path:resolve(dir,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(resolve(dir,'failure.json'),JSON.stringify({error:String(error),checks,errors,writes,sent},null,2));throw error;}
finally{for(const item of pending.values())item.release();await browser.close();}
