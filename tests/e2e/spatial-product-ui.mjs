// 空间感产品界面集中验收。全部 API 均由内存夹具拦截，不读取账号、环境文件、数据库或模型。
// --capture-before 仅在旧版本 3100 截图；正常验收固定使用 3303。
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from '@playwright/test';

const before=process.argv.includes('--capture-before');
const final=process.argv.includes('--final');
assert.ok(!(before&&final),'修改前截图与最终构建复验不能同时指定');
const base=process.env.LOCAL_QA_BASE_URL??(before?'http://localhost:3100':'http://localhost:3303');
const address=new URL(base);
assert.ok(['localhost','127.0.0.1'].includes(address.hostname)&&address.pathname==='/'&&!address.search&&!address.hash&&address.port===(before?'3100':'3303'),'只能使用对应本机预览端口，禁止远程验收');
const dir=resolve('tests/artifacts/spatial-product-qa',before?'before':final?'final':'after');
await mkdir(dir,{recursive:true});
const stamp='2026-10-19T02:00:00.000Z';
const ids=Object.fromEntries(['company','user','dataset','session','run','task','proposal','snapshot','report','evidence'].map(key=>[key,randomUUID()]));
const scope={startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[],dataCutoff:'2026-09-30T15:59:59.999Z'};
const authorized={...scope,organizationId:ids.company,authorizedCampusIds:[]};
const frozen={datasetId:ids.dataset,scope:authorized};
const dataset={id:ids.dataset,key:'spatial-controlled',name:'受控模拟经营数据',origin:'simulated',schemaVersion:'3',analysisType:'operations',dataCutoff:scope.dataCutoff};
const user={id:ids.user,username:'spatial-fixture',realName:'界面验收',email:'',role:'operator',ownedBy:ids.company,companyCode:'spatial-fixture',companyName:'受控验收公司'};
const companies=[{code:user.companyCode,name:user.companyName}];
const ready=data=>({status:'ready',message:'',data});
const evidence={id:ids.evidence,kind:'metric',sourceId:ids.dataset,version:'spatial-fixture-v1',summary:'受控页面夹具，不代表真实查询或经营结果',scope:authorized,updatedAt:stamp};
const labels={attendance_rate:'出勤率',admission_conversion:'招生转化率',renewal_rate:'续费率',retention_rate:'学员留存率',class_fill_rate:'满班率',hours_progress:'课耗进度',complaint_count:'客诉数量',refund_amount:'完成退款金额'};
const values={attendance_rate:87.82,admission_conversion:32.8,renewal_rate:68.42,retention_rate:91.2,class_fill_rate:76.8,hours_progress:61.5,complaint_count:7,refund_amount:23800};
function metric(code,value=values[code],range=authorized){return {code,unit:code==='complaint_count'?'count':code==='refund_amount'?'currency':'percent',value,numerator:code==='attendance_rate'?4348:value,denominator:code==='attendance_rate'?4951:100,status:'ready',scope:range,evidence:[evidence],reason:'由受控页面夹具提供；不代替真实业务验收',unknownCount:3,details:{}};}
const metrics=Object.keys(labels).map(code=>metric(code));
const baselineScope={...authorized,startDate:'2026-07-01',endDate:'2026-07-31'};
const analysis={dataset,scope:authorized,metrics,trend:[],breakdown:[],riskStudents:[],batches:[{id:'fixture-import',kind:'attendance',rows:4951,hash:'controlled-only'}],comparison:{scope:baselineScope,metrics:Object.keys(labels).map(code=>metric(code,code==='attendance_rate'?92.36:values[code],baselineScope)),changes:Object.keys(labels).map(code=>({code,change:code==='attendance_rate'?-4.54:1.2,unit:code==='refund_amount'?'元':code==='complaint_count'?'条':'个百分点',reason:'受控对比'}))}};
const answer={kind:'analysis',summary:'出勤下降主要集中在少儿编程课程，先核对签到与排课记录。以下为受控界面演示，不代表真实经营分析。',facts:[{id:'attendance_rate:value',label:'出勤率',value:87.82,unit:'%',status:'ready',numerator:4348,denominator:4951,evidenceIds:[evidence.id]},{id:'attendance_rate:change',label:'出勤率周期变化',value:-4.54,unit:'个百分点',status:'ready',evidenceIds:[evidence.id]},{id:'course:attendance',label:'少儿编程出勤率',value:71.2,unit:'%',status:'ready',evidenceIds:[evidence.id]}],hypotheses:['签到遗漏或排课调整可能影响到课记录，原因需要人工核对。'],recommendations:['核对少儿编程课程签到及排课调整，记录尚未解释的缺勤。','结合已确认规则预览受影响学员，正式保存前核对名单。'],limitations:['页面由受控夹具提供数据，不是实际模型运行。']};
const visual={id:'fixture-attendance-trend',title:'出勤率趋势',kind:'line',metricCodes:['attendance_rate'],unit:'%',categories:['2026-06','2026-07','2026-08'],categoryLabel:'统计月份',series:[{name:'出勤率',points:[{value:90.8,status:'ready'},{value:92.36,status:'ready'},{value:87.82,status:'ready'}]}],evidenceIds:[evidence.id],source:{datasetId:ids.dataset,datasetName:dataset.name,origin:'simulated',analysisType:'operations',scope},note:'受控界面展示；真实业务数字仍由业务查询计算。'};
const run={id:ids.run,sessionId:ids.session,status:'completed',context:frozen,steps:[{id:randomUUID(),tool:'query_metrics',status:'completed',context:frozen,facts:answer.facts,evidence:[evidence],visualizations:[visual]},{id:randomUUID(),tool:'query_metric_breakdown',status:'completed',context:frozen,input:{dimension:'course'},facts:[],evidence:[evidence]}],proposals:[],evidence:[evidence],answer,startedAt:stamp,completedAt:stamp,errorCode:null,errorMessage:null};
const session={id:ids.session,title:'出勤变化与课程拆解',datasetId:ids.dataset,scope:authorized,createdBy:ids.user,editable:true,createdAt:stamp,updatedAt:stamp};
const messages=[{id:randomUUID(),sessionId:ids.session,runId:ids.run,role:'user',content:'帮我看看当前范围的出勤情况，比较变化并拆解可能受影响的课程。',createdAt:stamp},{id:randomUUID(),sessionId:ids.session,runId:ids.run,role:'assistant',content:JSON.stringify(answer),createdAt:stamp}];
const recommendation={key:'fixture-recommendation',source:{kind:'agent',id:ids.run,index:0},datasetId:ids.dataset,scope:authorized,recommendation:answer.recommendations[0],answer,evidence:[evidence],createdAt:stamp,dataOrigin:'simulated',analysisType:'operations',taskId:ids.task};
const task={id:ids.task,datasetId:ids.dataset,source:recommendation.source,sourceSnapshot:recommendation,action:'核对少儿编程签到，并安排缺勤学员跟进',ownerId:ids.user,ownerName:'界面验收',createdBy:ids.user,priority:'high',dueDate:'2026-10-26',reviewMethod:'按相同校区课程范围比较后续出勤，并记录数据完整性',segmentSnapshotId:null,recordType:'demonstration',goals:null,state:'accepted',version:2,createdAt:stamp,updatedAt:stamp,feedback:[{id:randomUUID(),kind:'adoption',note:'受控页面演示：已采纳跟进建议，未发生真实机构执行。',from:'deferred',to:'accepted',version:2,createdBy:ids.user,createdAt:stamp}]};
const dashboard={analysis,definitions:metrics.map(item=>({code:item.code,name:labels[item.code],numerator:'已满足条件对象',denominator:'符合统计口径对象',notes:'受控展示；完整口径通过业务服务获取',unit:item.unit})),history:Array.from({length:6},(_,i)=>({period:'2026-'+String(i+3).padStart(2,'0'),scope:authorized,metrics:Object.keys(labels).map(code=>metric(code,code==='attendance_rate'?[89.6,90.4,91.2,90.8,92.36,87.82][i]:values[code]))})),dimensions:[...['东城校区','西城校区','南城校区'].map((name,i)=>({kind:'campus',id:'campus-'+i,name,metrics:Object.keys(labels).map(code=>metric(code,code==='attendance_rate'?[83.2,90.1,90.2][i]:values[code]))})),...['少儿编程','数学思维','英语阅读'].map((name,i)=>({kind:'course',id:'course-'+i,name,metrics:Object.keys(labels).map(code=>metric(code,code==='attendance_rate'?[71.2,92.1,93.3][i]:values[code]))}))],admission:{status:'ready',leads:420,trials:202,afterTrial:104,direct:34,pending:12,reason:'同一获取批次，观察30日',evidence:[evidence]},balances:{status:'ready',asOf:scope.endDate,values:[{label:'1—8课时',count:82},{label:'9—24课时',count:232},{label:'24课时以上',count:381}],unknown:4,evidence:[evidence]},completeness:[{kind:'attendance',name:'出勤记录',status:'complete',rows:4951,expected:4951}],resources:{status:'ready',alerts:[{id:'fixture-alert',title:'少儿编程出勤下降',description:'出勤变化达到当前演示阈值，核对签到与课程安排。',historicalBatch:false}],reports:[{id:ids.report,kind:'monthly',snapshot:{scope:authorized},historicalBatch:false}],proposals:[{id:ids.proposal,name:'低出勤学员待核对',version:1,memberCount:46,status:'awaiting_confirmation',dataCutoff:scope.dataCutoff,sourceFingerprint:'controlled-only',historical:false}],snapshots:[{id:ids.snapshot,name:'少儿编程服务跟进',version:1,memberCount:38,status:'confirmed',dataCutoff:scope.dataCutoff,sourceFingerprint:'controlled-only',historical:false}],decisions:[{id:ids.task,action:task.action,state:task.state,recordType:'demonstration',version:2,dataCutoff:scope.dataCutoff,historical:false}],pendingDecisions:1,errors:[]},sourceFingerprint:'controlled-only'};
const target=(path,extra={})=>path+'?'+new URLSearchParams({datasetId:ids.dataset,scope:JSON.stringify(scope),...extra});
const workItems=[['task','核对课程签到并安排跟进','待执行','accepted',target('/dashboard/decisions',{taskId:ids.task})],['plan','核对低出勤标签与人群方案','等待确认','prepared',target('/dashboard/agent',{sessionId:ids.session,runId:ids.run})],['material','审核出勤指标与服务流程','待审核','draft','/dashboard/knowledge']].map(([kind,title,statusLabel,status,href],i)=>({id:'fixture-work-'+i,kind,title,status,statusLabel,updatedAt:stamp,dueDate:i===0?'2026-10-26':undefined,overdue:false,href,actionLabel:i===0?'继续处理':'核对',canAct:true,dataset,periodLabel:scope.startDate+' 至 '+scope.endDate,version:1}));
function workbench(type){const items=type==='all'?workItems:workItems.filter(item=>item.kind===type);return {generatedAt:stamp,counts:{all:3,task:1,plan:1,material:1},todos:{items,page:1,pageSize:10,total:items.length,status:'ready'},recent:{items:[...workItems,{...workItems[1],id:'fixture-analysis',kind:'analysis',title:'已保存出勤分析',statusLabel:'已完成',status:'completed'}],status:'ready'},sources:Object.fromEntries(['task','plan','material','analysis','report','tag','segment'].map(kind=>[kind,{status:'ready'}]))};}

const sizes=[[1920,1080],[1440,900],[1366,768],[390,844]];
const checks=[],screenshots=[],videos=[],errors=[],requests=[],unexpected=[],external=[],measurements=[],imageChecks=[];
const browser=await chromium.launch({channel:'msedge',headless:true});
const contexts=[];
let currentPage,currentStep='准备受控页面';
function pass(name,detail){checks.push({name,passed:true,...(detail?{detail}:{})});console.log('通过：'+name);}
async function create({color='light',motion='reduce',authenticated=true,video=false,blockedImages=false}={}){
 const context=await browser.newContext({viewport:{width:1440,height:900},timezoneId:'Asia/Shanghai',colorScheme:color,reducedMotion:motion,serviceWorkers:'block',...(video?{recordVideo:{dir:resolve(dir,'video'),size:{width:1440,height:900}}}:{})});contexts.push(context);
 const state={blockedImages,pending:null,saved:[run],messages:[...messages],sent:0};
 await context.addInitScript(({authenticated,user,color,origin})=>{if(location.origin!==origin)return;localStorage.setItem('education-theme',color);if(authenticated){localStorage.setItem('auth_token','controlled-spatial-fixture');localStorage.setItem('auth_user',JSON.stringify(user));}}, {authenticated,user,color,origin:address.origin});
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method();
  if(url.origin!==address.origin){external.push({origin:url.origin,path,method});return route.abort('blockedbyclient');}
  if((path.startsWith('/visuals/')||path==='/_next/image')&&state.blockedImages)return route.abort('blockedbyclient');
  if(!path.startsWith('/api/'))return route.continue();
  requests.push({method,path});
  const respond=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(path==='/api/auth/companies')return respond({companies,defaultCompanyCode:user.companyCode});
  if(path==='/api/auth/me')return respond({user});
  if(path==='/api/settings')return respond({sessionTimeout:30,pageSize:20,language:'zh-CN',theme:color});
  if(path==='/api/education/datasets')return respond(ready([dataset]));
  if(path==='/api/education/datasets/'+ids.dataset)return respond(ready({dataset,catalog:[{id:'campus-0',kind:'campus',name:'东城校区'},{id:'course-0',kind:'course',name:'少儿编程'}]}));
  if(path==='/api/analytics/channels/catalog')return respond(ready([{id:'channel-1',name:'自然到访'}]));
  if(path==='/api/overview/query')return respond(ready(dashboard));
  if(path==='/api/overview/journey/query')return respond(ready({records:{},ready:[],blockers:[],warnings:[],reports:[]}));
  if(path==='/api/overview')return respond(ready({databaseStatus:'ready',configuration:{chatConfigured:true,embeddingConfigured:true},inventory:{tags:2,segments:1,dataSources:1,dataModels:1},capabilities:[],dataCutoff:null}));
  if(path==='/api/workbench')return respond(ready(workbench(url.searchParams.get('type')??'all')));
  if(path==='/api/decisions/recommendations')return respond(ready([recommendation]));
  if(path==='/api/decisions/owners')return respond(ready([{id:ids.user,name:user.realName}]));
  if(path==='/api/decisions')return respond(ready([task]));
  if(path==='/api/decisions/'+ids.task&&method==='GET')return respond(ready(task));
  if(path==='/api/segments/risk-snapshots')return respond(ready([]));
  if(path==='/api/agent')return respond(ready({tools:[{name:'query_metrics',description:'查询经营指标',mode:'read',status:'ready'},{name:'query_metric_breakdown',description:'按课程拆解',mode:'read',status:'ready'}]}));
  if(path==='/api/agent/sessions')return respond(ready([session]));
  if(path==='/api/agent/sessions/'+ids.session)return respond(ready({session,messages:state.messages,runs:state.saved}));
  if(path==='/api/agent/runs/'+ids.run)return respond(ready(run));
  if(path==='/api/agent/runs/progress'){
   const active=state.pending;if(active){const age=Date.now()-active.started;active.run.steps=[{...run.steps[0],status:age>1800?'completed':'pending'},...(age>1800?[{...run.steps[1],status:age>3600?'completed':'pending'}]:[])];}
   return respond(ready({prepared:!!active,run:active?.run??null,expired:false,deadlineAt:new Date(Date.now()+120000).toISOString()}));
  }
  if(path==='/api/agent/runs'&&method==='POST'&&!before){
   state.sent++;const input=request.postDataJSON(),next={...structuredClone(run),id:randomUUID(),sessionId:ids.session,status:'running',answer:null,completedAt:null,steps:[{...run.steps[0],status:'pending'}]};
   state.saved.push(next);state.pending={run:next,key:input.requestKey,started:Date.now()};
   await new Promise(resolve=>setTimeout(resolve,5200));
   next.status='completed';next.answer=answer;next.completedAt=new Date().toISOString();next.steps=run.steps;state.pending=null;
   state.messages.push({id:randomUUID(),sessionId:ids.session,runId:next.id,role:'user',content:input.message,createdAt:stamp},{id:randomUUID(),sessionId:ids.session,runId:next.id,role:'assistant',content:JSON.stringify(answer),createdAt:stamp});
   return respond(ready(next));
  }
  // Every unlisted endpoint is blocked, rather than falling through to real authentication or business services.
  unexpected.push({method,path});return respond({status:'error',message:'受控验收未允许此接口',data:null},403);
 });
 const page=await context.newPage();currentPage=page;page.setDefaultTimeout(20000);
 page.on('pageerror',error=>errors.push({step:currentStep,error:error.message}));
 return {context,page,state};
}
async function settled(page){await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(480);}
async function visit(page,path,locator){await page.goto(base+path,{waitUntil:'networkidle',timeout:90000});if(locator)await page.locator(locator).first().waitFor();await settled(page);}
async function capture(page,name){
 if(name.startsWith('agent-result-')){
  await page.getByTestId('agent-result-pane').locator('[class*="resultScroll"]').evaluate(node=>{node.scrollTop=0;});
  const frozen=page.getByTestId('agent-frozen-scope');
  if(await frozen.count()){
   const layout=await frozen.evaluate(node=>{const tabs=node.closest('[data-testid="agent-run-details"]').querySelector('.ant-tabs-nav');const range=document.createRange();range.selectNodeContents(node);return {scope:node.getBoundingClientRect().toJSON(),text:[...range.getClientRects()].map(r=>r.toJSON()),tabs:tabs?.getBoundingClientRect().toJSON(),scroll:node.closest('[class*="resultScroll"]').scrollTop};});
   measurements.push({kind:'result-scope',width:page.viewportSize().width,...layout});
   if(!before){
    assert.ok(!layout.tabs||layout.text.every(rect=>rect.bottom<=layout.tabs.top+1),'完整冻结周期不被结果标签覆盖：'+name);
    assert.ok(layout.text.every(rect=>rect.left>=layout.scope.left-1&&rect.right<=layout.scope.right+1&&rect.top>=layout.scope.top-2&&rect.bottom<=layout.scope.bottom+2),'完整周期文字不被自身容器裁切：'+name);
   }
  }
 }
 const path=resolve(dir,name+'.png');await page.screenshot({path,fullPage:false,animations:'disabled'});screenshots.push(path);
}
async function overflow(page,label){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'整页无横向溢出：'+label);}
async function decode(page,name){
 const artwork=page.locator('[data-artwork="'+name+'"]');await artwork.waitFor();
 const result=await artwork.locator('img').evaluate(async image=>{await image.decode();const url=new URL(image.currentSrc,location.origin);return {src:url.pathname,asset:url.searchParams.get('url'),width:image.naturalWidth,height:image.naturalHeight,loaded:image.complete};});
 imageChecks.push({name,...result});
 assert.ok(result.loaded&&result.width>=120&&result.height>=40,'原创图片实际解码且非占位像素：'+name);
 assert.ok(Math.abs(result.width/result.height-({login:1.5,agent:1,workbench:3}[name]))<.06,'优化图片保持素材比例：'+name);
 assert.ok(result.src==='/_next/image'||result.src==='/visuals/'+name+'-spatial.png','图片通过本地路径加载');
 if(result.src==='/_next/image')assert.equal(result.asset,'/visuals/'+name+'-spatial.png');
}
async function pane(page,result=false){if(page.viewportSize().width<1200)await page.locator('[aria-label="智能分析区域"]').getByText(result?/^结果/:/^对话$/).click();}
async function composer(page){
 const outer=page.getByTestId('agent-composer');const input=page.getByRole('textbox',{name:'Agent问题',exact:true});
 const row=page.getByTestId('agent-composer-footer');const button=page.getByRole('button',{name:'发送Agent问题',exact:true});
 const boxes={input:await input.boundingBox(),row:await row.boundingBox(),button:await button.boundingBox(),outer:await outer.boundingBox()};
 assert.ok(Object.values(boxes).every(Boolean),'输入和发送区域存在');
 const gap=boxes.row.y-boxes.input.y-boxes.input.height;
 measurements.push({width:page.viewportSize().width,gap,...boxes});
 assert.ok(gap>=11.5,'输入与底部操作区保留12px');
 assert.ok(boxes.outer.y>=0&&boxes.outer.y+boxes.outer.height<=page.viewportSize().height+2,'完整输入区在首屏');
 assert.ok(boxes.button.y>=boxes.row.y-1&&boxes.button.y+boxes.button.height<=boxes.row.y+boxes.row.height+1,'按钮不压住输入框');
}
async function checkOverview(page){
 const cards=page.getByTestId('overview-metrics').locator('.metric-card');assert.equal(await cards.count(),4);
 for(const card of await cards.all()){const box=await card.boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=900,'四项指标进入1440首屏');}
 const chart=page.getByTestId('overview-analysis').locator('.business-chart > div[role="img"]').first();await chart.locator('svg').waitFor();
 const chartBox=await chart.boundingBox();assert.ok(chartBox&&chartBox.height>=150&&chartBox.y+150<=900,'主图有足够的首屏可视高度');
 const inspector=page.getByTestId('overview-inspector');const links=inspector.getByRole('link',{name:'查看事项',exact:false});assert.equal(await links.count(),3,'最多三条重点事项');
 for(const item of await links.all()){const box=await item.boundingBox();assert.ok(box&&box.y+box.height<=900,'三条重点事项在首屏');}
 assert.ok(await page.getByText('模拟经营',{exact:true}).first().isVisible(),'模拟来源保持可见');
}

try{
 for(const color of before?['light']:['light','dark']){
  const anon=await create({color,authenticated:false}),signed=await create({color});
  for(const [width,height] of before?[[1440,900],[390,844]]:sizes){
   await anon.page.setViewportSize({width,height});await signed.page.setViewportSize({width,height});
   currentStep='登录 '+color+' '+width;await visit(anon.page,'/auth/login','[autocomplete="username"]');await overflow(anon.page,currentStep);
   assert.ok(await anon.page.getByRole('button',{name:/登\s*录$/}).isEnabled());
   if(!before)await decode(anon.page,'login');await capture(anon.page,'login-'+color+'-'+width);
   currentStep='总览 '+color+' '+width;await visit(signed.page,target('/dashboard'),'[data-testid="overview-metrics"]');await overflow(signed.page,currentStep);
   if(!before&&width===1440)await checkOverview(signed.page);await capture(signed.page,'overview-'+color+'-'+width);
   currentStep='Agent空态 '+color+' '+width;await visit(signed.page,target('/dashboard/agent'),'[data-testid="agent-composer"]');await pane(signed.page,true);
   if(!before)await decode(signed.page,'agent');await overflow(signed.page,currentStep);await capture(signed.page,'agent-empty-'+color+'-'+width);
   currentStep='Agent结果 '+color+' '+width;await visit(signed.page,target('/dashboard/agent',{sessionId:ids.session,runId:ids.run}),'[data-testid="agent-workspace"]');await pane(signed.page,true);await signed.page.getByTestId('agent-run-details').waitFor();await overflow(signed.page,currentStep);await capture(signed.page,'agent-result-'+color+'-'+width);
   await pane(signed.page);await signed.page.getByRole('textbox',{name:'Agent问题',exact:true}).fill('请继续核对当前范围。\n保留课程拆解与数据依据。');if(!before)await composer(signed.page);await capture(signed.page,'agent-composer-'+color+'-'+width);
   // Clear draft explicitly before navigating; no leave-protection bypass or forced page detach.
   await signed.page.getByRole('textbox',{name:'Agent问题',exact:true}).fill('');
   currentStep='工作台 '+color+' '+width;await visit(signed.page,'/dashboard/workbench','[data-testid="workbench-todos"] article');await overflow(signed.page,currentStep);
   const entries=signed.page.getByTestId('quick-links').locator('a[data-entry-key]');assert.equal(await entries.count(),6);
   if(!before){assert.equal(await signed.page.getByTestId('quick-links').locator('[data-featured="true"]').count(),2);await decode(signed.page,'workbench');}
   await capture(signed.page,'workbench-'+color+'-'+width);
   currentStep='行动详情 '+color+' '+width;await visit(signed.page,target('/dashboard/decisions',{taskId:ids.task}),before?'[aria-label="行动详情与操作"]':'[aria-label="任务下一步"]');await signed.page.getByRole('button',{name:'开始执行',exact:true}).waitFor();await overflow(signed.page,currentStep);
   assert.ok(await signed.page.getByRole('button',{name:'开始执行',exact:true}).isVisible());await capture(signed.page,'decision-'+color+'-'+width);
  }
  pass(before?'旧版浅色1440/390受控截图完成':'修改后'+color+'布局、四指标与主图、图片、输入区及任务入口');
 }
 if(!before){
  currentStep='图片失败仍可操作';
  const brokenLogin=await create({authenticated:false,blockedImages:true});await visit(brokenLogin.page,'/auth/login','[autocomplete="username"]');await brokenLogin.page.locator('[data-artwork="login"][data-image-state="failed"]').waitFor();
  await brokenLogin.page.locator('[autocomplete="username"]').fill('只用于界面验证');assert.ok(await brokenLogin.page.getByRole('button',{name:/登\s*录$/}).isEnabled());await capture(brokenLogin.page,'login-image-fallback');
  const brokenAgent=await create({blockedImages:true});await visit(brokenAgent.page,target('/dashboard/agent'),'[data-testid="agent-composer"]');await brokenAgent.page.locator('[data-artwork="agent"][data-image-state="failed"]').waitFor();await brokenAgent.page.getByRole('textbox',{name:'Agent问题',exact:true}).fill('图片加载失败时，仍可填写问题。');assert.ok(await brokenAgent.page.getByRole('button',{name:'发送Agent问题',exact:true}).isEnabled());await capture(brokenAgent.page,'agent-image-fallback');await brokenAgent.page.getByRole('textbox',{name:'Agent问题',exact:true}).fill('');
  pass('三维素材失败时保留文字与可用表单，不影响业务操作');

  currentStep='减少动画';const reduced=await create();await visit(reduced.page,'/dashboard/workbench','[data-testid="workbench-todos"] article');
  const motion=await reduced.page.evaluate(()=>({reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,running:document.getAnimations().filter(a=>a.playState==='running'&&a.effect?.target?.closest?.('[data-spatial-enter],[data-spatial-reveal],[data-spatial-hover],[data-artwork]')).map(a=>({duration:a.effect.getTiming().duration,iterations:a.effect.getTiming().iterations}))}));
  assert.ok(motion.reduced);assert.deepEqual(motion.running,[],'减少动画模式不运行空间动效');pass('减少动画模式直接展示最终内容，不持续播放装饰动画');

  currentStep='动效中立即操作';const animated=await create({motion:'no-preference'});await animated.page.goto(base+target('/dashboard/agent'),{waitUntil:'domcontentloaded'});await animated.page.getByTestId('agent-composer').waitFor();
  const prompt=animated.page.getByRole('textbox',{name:'Agent问题',exact:true});await prompt.focus();await prompt.fill('保持当前输入焦点，不自动发送。');await animated.page.waitForTimeout(450);
  assert.equal(await prompt.evaluate(node=>document.activeElement===node),true);assert.equal(animated.state.sent,0);await prompt.fill('');
  await animated.page.getByRole('button',{name:/历史会话$/}).click();await animated.page.getByRole('dialog',{name:'历史会话',exact:true}).waitFor();await animated.page.getByRole('dialog',{name:'历史会话',exact:true}).locator('.ant-drawer-close').click();
  pass('有动效时输入与抽屉可立即操作，视觉过渡不抢输入焦点');

  currentStep='登录交互录屏';const loginVideo=await create({authenticated:false,motion:'no-preference',video:true});
  const startLogin=Date.now();await visit(loginVideo.page,'/auth/login','[autocomplete="username"]');
  await loginVideo.page.locator('[autocomplete="username"]').pressSequentially('spatial-fixture',{delay:80});await loginVideo.page.locator('[autocomplete="current-password"]').fill('fixture-only-not-submitted');await loginVideo.page.getByRole('button',{name:'显示密码',exact:true}).click();await loginVideo.page.waitForTimeout(900);await loginVideo.page.getByRole('button',{name:'隐藏密码',exact:true}).click();
  await loginVideo.page.waitForTimeout(Math.max(0,9000-(Date.now()-startLogin)));const loginPath=await loginVideo.page.video().path();await loginVideo.context.close();videos.push({name:'登录表单与主视觉',path:loginPath,fixtureOnly:true,loginSubmitted:false,durationMs:Date.now()-startLogin});

  currentStep='Agent交互录屏';const agentVideo=await create({motion:'no-preference',video:true});const startAgent=Date.now();
  await visit(agentVideo.page,target('/dashboard/agent'),'[data-testid="agent-composer"]');const videoPrompt=agentVideo.page.getByRole('textbox',{name:'Agent问题',exact:true});
  await videoPrompt.fill('查看当前出勤变化，并拆解课程。');const response=agentVideo.page.waitForResponse(value=>new URL(value.url()).pathname==='/api/agent/runs'&&value.request().method()==='POST');
  await agentVideo.page.getByRole('button',{name:'发送Agent问题',exact:true}).click();await agentVideo.page.waitForTimeout(2600);
  assert.ok(await agentVideo.page.locator('[aria-label="正在执行的业务步骤"]').isVisible(),'实际页面根据夹具进度更新业务步骤');await response;await agentVideo.page.getByTestId('agent-run-details').waitFor();
  await agentVideo.page.waitForTimeout(Math.max(0,10000-(Date.now()-startAgent)));const agentPath=await agentVideo.page.video().path();await agentVideo.context.close();videos.push({name:'Agent输入、受控步骤与结果呈现',path:agentPath,fixtureOnly:true,realModelCalls:0,durationMs:Date.now()-startAgent});
  pass('登录和Agent真实网页录屏，进度来自受控接口，未登录或访问真实模型');
 }
 assert.deepEqual(unexpected,[],'没有未登记API，全部请求均由夹具应答');assert.deepEqual(errors,[],'没有页面运行异常');assert.deepEqual(external,[],'不访问外站或远程图片');
 await writeFile(resolve(dir,'verification.json'),JSON.stringify({kind:before?'controlled-before-capture':'controlled-spatial-product-ui',testedAt:new Date().toISOString(),base,realLoginUsed:false,realDatabaseUsed:false,cloudModelCalls:0,businessWrites:0,fixtureOnly:true,checks,screenshots,videos,measurements,imageChecks,requests,unexpected,external,errors},null,2));
 console.log(JSON.stringify({checks:checks.length,screenshots:screenshots.length,videos:videos.length,decodedImages:imageChecks.length,realDatabaseUsed:false,modelCalls:0,businessWrites:0}));
}catch(error){
 const suffix=new Date().toISOString().replaceAll(':','-');
 await currentPage?.screenshot({path:resolve(dir,'failure-'+suffix+'.png'),fullPage:true}).catch(()=>{});
 await writeFile(resolve(dir,'failure-'+suffix+'.json'),JSON.stringify({step:currentStep,error:String(error),checks,screenshots,measurements,imageChecks,unexpected,external,errors},null,2));throw error;
}finally{await Promise.allSettled(contexts.map(context=>context.close()));await browser.close();}
