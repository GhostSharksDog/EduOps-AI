// 独立工作台受控界面验收。所有 API 都由本文件应答，不读取环境文件、数据库或模型。
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from '@playwright/test';

const base=process.env.LOCAL_QA_BASE_URL??'http://localhost:3303',address=new URL(base);
assert.ok(['localhost','127.0.0.1'].includes(address.hostname)&&['3303','3100'].includes(address.port)&&address.pathname==='/'&&!address.search&&!address.hash,'只允许本机专用或正常预览端口，所有 API 均受控');
const allowedArtifactDirs=['tests/artifacts/workbench-qa/ui','tests/artifacts/spatial-product-qa/workbench-regression'].map(value=>resolve(value));
const dir=resolve(process.env.LOCAL_QA_ARTIFACT_DIR??allowedArtifactDirs[0]);
assert.ok(allowedArtifactDirs.includes(dir),'产物只允许原工作台验收目录或本轮空间界面回归目录');
await mkdir(dir,{recursive:true});
const checks=[],screenshots=[],errors=[],requests=[],blockedWrites=[];
const companies=[{code:'fixture-alpha',name:'受控公司甲'},{code:'fixture-beta',name:'受控公司乙'}];
const organizations={alpha:randomUUID(),beta:randomUUID()},userId=randomUUID();
const ids={operations:randomUUID(),learning:randomUUID(),finance:randomUUID(),session:randomUUID(),run:randomUUID(),plan:randomUUID(),source:randomUUID(),report:randomUUID(),tag:randomUUID(),segment:randomUUID()};
const businessScope={startDate:'2026-08-01',endDate:'2026-08-31',campusIds:['fixture-campus'],courseIds:['fixture-course'],channelIds:['fixture-channel'],dataCutoff:'2026-09-30T15:59:59.999Z'};
const learningScope={courseKeys:['AAA-2014J'],relativeDayStart:-14,relativeDayEnd:269};
const financeScope={years:[2023,2024,2025]};
const dimensions=[[1920,1080],[1440,900],[1366,768],[390,844]];
const kinds=['task','plan','material','analysis','report','tag','segment'];
const stamp='2026-10-18T02:00:00.000Z';
const ready=data=>({status:'ready',message:'',data});
const label=company=>company==='alpha'?'甲公司':'乙公司';
function user(role,company){return {id:userId,username:'same-user',realName:'受控验收账号',email:'',role,ownedBy:organizations[company],companyCode:'fixture-'+company,companyName:companies[company==='alpha'?0:1].name};}
function target(path,mode,object={}){
 const datasetId=mode==='learning'?ids.learning:mode==='finance'?ids.finance:ids.operations;
 const name=mode==='learning'?'learningScope':mode==='finance'?'financeScope':'scope';
 const scope=mode==='learning'?learningScope:mode==='finance'?financeScope:businessScope;
 return path+'?'+new URLSearchParams({datasetId,[name]:JSON.stringify(scope),...object});
}
function dataset(mode){return {id:ids[mode],name:mode==='operations'?'受控模拟经营数据':mode==='learning'?'受控匿名学习数据':'受控年度财务案例',origin:mode==='operations'?'simulated':'public',analysisType:mode};}
function todo(index,company,role){
 const kind=index<12?'task':index<20?'plan':'material';
 const id='fixture-'+kind+'-'+index;
 const mode=index===2?'finance':index===3?'learning':'operations';
 return {id,kind,title:label(company)+' · '+(kind==='task'?'核对课程签到并记录跟进':kind==='plan'?'核对运营标签与人群方案':'核对业务材料版本')+' '+(index+1)+(index===0?'：这是一条用于核对长标题折叠及完整阅读能力的受控记录，确认行内操作不会被长文字挤出页面。':''),
  status:index===0?'adopted':index===1?'review_pending':kind==='plan'?(index===13?'expired':index===14?'partial':'prepared'):'draft',
  statusLabel:index===0?'待执行':index===1?'待复核':index===13?'需要重新准备':index===14?'继续处理':kind==='plan'?'等待确认':'待审核',
  updatedAt:new Date(Date.parse(stamp)-index*60000).toISOString(),dueDate:kind==='task'?'2026-10-'+(index===0?'16':'31'):undefined,overdue:index===0,
  version:kind==='task'?undefined:2,expiresAt:kind==='plan'?'2026-10-18T02:30:00.000Z':undefined,
  href:kind==='task'?target('/dashboard/decisions',mode,{taskId:id}):kind==='plan'?target('/dashboard/agent',mode,{sessionId:ids.session,runId:ids.run,tab:'operations'}):'/dashboard/knowledge?'+new URLSearchParams({sourceId:ids.source,versionId:id}),
  actionLabel:kind==='task'?'继续处理':kind==='plan'?'核对方案':'核对材料',canAct:role!=='viewer',dataset:kind==='material'?undefined:dataset(mode),periodLabel:kind==='material'?undefined:mode==='learning'?'AAA-2014J · 相对日 -14 至 269':mode==='finance'?'2023—2025年度':'2026-08-01 至 2026-08-31'};
}
function recent(company,role){
 const definitions=[
  ['analysis','learning',target('/dashboard/agent','learning',{sessionId:ids.session,runId:ids.run})],
  ['task','finance',target('/dashboard/decisions','finance',{taskId:'fixture-finance-task'})],
  ['report','operations',target('/dashboard/reports','operations',{reportId:ids.report})],
  ['tag','operations',target('/dashboard/tags/risk','operations',{proposalId:ids.tag})],
  ['segment','operations',target('/dashboard/segments/risk','operations',{snapshotId:ids.segment})],
  ['material',null,'/dashboard/knowledge?'+new URLSearchParams({sourceId:ids.source,versionId:'fixture-knowledge-version'})],
 ];
 return definitions.map(([kind,mode,href],index)=>({id:'recent-'+kind,kind,title:label(company)+' · 已保存'+({analysis:'分析',task:'任务',report:'报告',tag:'标签',segment:'人群',material:'知识'}[kind]),status:'completed',statusLabel:'已保存',updatedAt:new Date(Date.parse(stamp)-index*90000).toISOString(),href,actionLabel:'查看',canAct:role!=='viewer',dataset:mode?dataset(mode):undefined,periodLabel:mode==='learning'?'AAA-2014J · 相对日 -14 至 269':mode==='finance'?'2023—2025年度':mode?'2026-08-01 至 2026-08-31':undefined}));
}
function result(state,type,page){
 const all=Array.from({length:25},(_,index)=>todo(index,state.company,state.role));
 let items=type==='all'?all:all.filter(item=>item.kind===type),total=items.length;
 const counts={all:25,task:12,plan:8,material:5};
 const sources=Object.fromEntries(kinds.map(kind=>[kind,{status:'ready'}]));
 let todoStatus='ready',recentStatus='ready',recentItems=recent(state.company,state.role);
 if(state.scenario==='empty'){items=[];total=0;for(const key of Object.keys(counts))counts[key]=0;recentItems=[];}
 if(state.scenario==='partial'){
  sources.plan={status:'error',message:'受控方案来源读取失败'};counts.plan=null;counts.all=null;
  items=items.filter(item=>item.kind!=='plan');total=null;todoStatus='partial';recentStatus='partial';
 }
 if(state.scenario==='todo-error'){
  for(const kind of ['task','plan','material']){sources[kind]={status:'error'};counts[kind]=null;}
  counts.all=null;items=[];total=null;todoStatus='error';
 }
 return {generatedAt:stamp,counts,todos:{items:items.slice((page-1)*10,page*10),page,pageSize:10,total,status:todoStatus,...(todoStatus==='ready'?{}:{message:'受控读取失败，请重试；未读取记录没有按零统计。'})},recent:{items:recentItems,status:recentStatus,...(recentStatus==='ready'?{}:{message:'部分来源未读到。'})},sources};
}

const browser=await chromium.launch({channel:'msedge',headless:true});
const sessions=[];
let current;
async function createSession(role='admin',company='alpha'){
 const state={role,company,scenario:'normal',delayType:null,delayedStarted:0,delayedReleased:0,delayedAborted:0,abortedWorkbench:[]};
 const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),page=await context.newPage();
 page.setDefaultTimeout(20000);
 page.on('pageerror',error=>errors.push({role,company,error:error.message}));
 page.on('requestfailed',request=>{const url=new URL(request.url());if(url.pathname==='/api/workbench')state.abortedWorkbench.push(url.searchParams.get('type'));});
 await context.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url()),method=request.method(),path=url.pathname;
  const record={role:state.role,company:state.company,method,path,query:url.search};requests.push(record);
  const respond=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(path==='/api/auth/companies'&&method==='GET')return respond({companies,defaultCompanyCode:'fixture-'+company});
  if(path==='/api/auth/login'&&method==='POST'){
   const input=request.postDataJSON();assert.ok(['fixture-alpha','fixture-beta'].includes(input.companyCode));
   assert.equal(input.username,'same-user');assert.equal(input.password,'fixture-password');
   state.company=input.companyCode==='fixture-beta'?'beta':'alpha';
   return respond({token:'fixture-'+state.company+'-'+state.role,user:user(state.role,state.company)});
  }
  if(!['GET','HEAD','OPTIONS'].includes(method)){
   blockedWrites.push({method,path});return respond({error:'受控验收禁止业务写入和模型调用'},403);
  }
  if(path==='/api/auth/me')return respond({user:user(state.role,state.company)});
  if(path==='/api/education/datasets')return respond(ready([]));
  if(path==='/api/settings')return respond({data:{appearance:{theme:'light'},pageSize:20}});
  if(path==='/api/workbench'){
   const type=url.searchParams.get('type')??'all',pageNumber=Number(url.searchParams.get('page')??1);
   assert.ok(['all','task','plan','material'].includes(type));assert.ok(pageNumber>=1&&pageNumber<=1000);
   assert.deepEqual([...url.searchParams.keys()].sort(),['page','type']);
   if(state.delayType===type){
    state.delayedStarted++;
    await new Promise(resolve=>setTimeout(resolve,1200));
    state.delayedReleased++;
    try{return await respond(ready(result({...state,scenario:'normal'},type,pageNumber)));}catch{state.delayedAborted++;return;}
   }
   if(state.scenario==='http-error')return respond({message:'受控读取暂不可用'},503);
   return respond(ready(result(state,type,pageNumber)));
  }
  // Never fall through to an actual API, including unexpected future endpoints.
  return respond(ready([]));
 });
 const session={context,page,state};sessions.push(session);current=session;
 return session;
}
const pass=name=>{checks.push({name,passed:true});console.log('通过：'+name);};
const work=page=>page.getByTestId('workbench-workspace');
const todos=page=>page.getByTestId('workbench-todos');
const latest=page=>page.getByTestId('workbench-recent');
const rows=container=>container.locator('article[data-workbench-item]');
const view=(page,name)=>work(page).locator('[aria-label="工作台视图"]').getByRole('radio',{name,exact:true});
const filter=(page,name)=>todos(page).locator('[aria-label="待办类型"]').getByRole('radio',{name:new RegExp('^'+name)});
async function loaded(page,expected=10){await work(page).waitFor();await page.waitForFunction(({count})=>document.querySelectorAll('[data-testid="workbench-todos"] article[data-workbench-item]').length===count,{count:expected});}
async function login(session){
 const {page}=session;await page.goto(base+'/auth/login',{waitUntil:'networkidle'});
 await page.getByRole('combobox',{name:'登录公司',exact:true}).waitFor();
 await page.locator('input[autocomplete=username]').fill('same-user');
 await page.locator('input[autocomplete=current-password]').fill('fixture-password');
 await page.getByRole('button',{name:/登\s*录$/}).click();await page.waitForURL(url=>url.pathname==='/dashboard'&&!url.search);
}
async function open(session,query=''){
 await session.page.goto(base+'/dashboard/workbench'+query,{waitUntil:'networkidle'});await work(session.page).waitFor();
}
async function refresh(session){
 const response=session.page.waitForResponse(response=>new URL(response.url()).pathname==='/api/workbench');
 await work(session.page).getByRole('button',{name:'刷新个人工作',exact:true}).click();await response;
}
async function settle(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function until(predicate,message){
 const deadline=Date.now()+10000;
 while(!predicate()&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));
 assert.ok(predicate(),message);
}
async function capture(page,name,width,height){
 await page.setViewportSize({width,height});await settle(page);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),name+'：页面横向溢出 '+width);
 const textBounds=await page.evaluate(()=>{
  const failures=[];
  function check(text,container,kind){
   if(!text||!container)return;
   const box=container.getBoundingClientRect();
   if(box.width<1||box.height<1||getComputedStyle(container).visibility==='hidden')return;
   const range=document.createRange();range.selectNodeContents(text);
   for(const rect of range.getClientRects()){
    if(rect.width<1||rect.height<1)continue;
    if(rect.left<box.left-2||rect.right>box.right+2||rect.top<box.top-2||rect.bottom>box.bottom+2){failures.push({kind,reason:'文字超出所属控件'});break;}
   }
  }
  document.querySelectorAll('[data-testid="quick-links"] a[data-entry-key]').forEach(card=>{check(card.querySelector('strong'),card,'常用入口中文');check(card.querySelector('small'),card,'重点入口说明');});
  document.querySelectorAll('[data-testid="workbench-tools"] a[data-entry-key]').forEach(card=>check(card.querySelector('strong'),card,'功能卡标题'));
  document.querySelectorAll('[data-testid="workbench-workspace"] .ant-segmented-item-label').forEach(text=>check(text,text.closest('.ant-segmented-item'),'分区和类型按钮'));
  if(innerWidth>=768)document.querySelectorAll('.business-sidebar .ant-menu-title-content').forEach(text=>check(text,text.closest('.ant-menu-item'),'主导航中文'));
  return failures;
 });
 assert.deepEqual(textBounds,[],name+'：有界控件内文字完整 '+width);
 const path=resolve(dir,name+'-'+width+'.png');
 await page.screenshot({path,animations:'disabled',fullPage:false});screenshots.push(path);
}
async function assertSourceLinks(page){
 const items=await latest(page).locator('article[data-workbench-item]').evaluateAll(nodes=>nodes.map(node=>({kind:node.dataset.workbenchItem,href:node.querySelector('a').getAttribute('href')})));
 assert.equal(items.length,6);
 for(const item of items){
  const url=new URL(item.href,base),params=url.searchParams;
  assert.ok(url.pathname.startsWith('/dashboard/'));
  if(item.kind==='material'){assert.equal(params.get('sourceId'),ids.source);assert.equal(params.get('versionId'),'fixture-knowledge-version');continue;}
  const scopes=['scope','learningScope','financeScope'].filter(name=>params.has(name));assert.equal(scopes.length,1,'单个记录只能携带自身来源的一种范围');
  const key=scopes[0];
  assert.deepEqual(JSON.parse(params.get(key)),key==='learningScope'?learningScope:key==='financeScope'?financeScope:businessScope);
  assert.equal(params.get('datasetId'),key==='learningScope'?ids.learning:key==='financeScope'?ids.finance:ids.operations);
  assert.ok([...params.keys()].some(key=>['sessionId','taskId','reportId','proposalId','snapshotId'].includes(key)),'已有记录必须携带对象编号');
 }
}

try{
 const admin=await createSession();const {page,state}=admin;
 await login(admin);assert.equal(new URL(page.url()).pathname,'/dashboard');pass('登录成功仍进入运营总览');
 const previous=new URLSearchParams({datasetId:ids.operations,scope:JSON.stringify(businessScope),runId:ids.run,sessionId:ids.session,taskId:'old-task'});
 await page.goto(base+'/dashboard?'+previous,{waitUntil:'networkidle'});
 await page.locator('.business-sidebar .workbench-button').click();await loaded(page);
 assert.equal(new URL(page.url()).pathname,'/dashboard/workbench');assert.equal(new URL(page.url()).search,'');
 assert.equal(await page.getByRole('dialog',{name:'工作台',exact:true}).count(),0);
 assert.equal(await page.locator('.business-sidebar .ant-menu-item').count(),4);
 assert.equal(await page.locator('.business-sidebar .ant-menu-item-selected').count(),0);
 assert.equal(await page.locator('.business-sidebar .workbench-button').getAttribute('aria-current'),'page');
 assert.equal(await page.locator('.workspace-page-nav').count(),0);
 for(const title of ['运营总览','智能分析','标签与人群','行动中心']){
  const item=page.locator('.business-sidebar .ant-menu-item').filter({hasText:title});
  assert.equal(await item.count(),1);assert.ok((await item.locator('.ant-menu-title-content').boundingBox()).height>=16,'主导航中文完整可读');
 }
 pass('工作台独立页面、四项主导航及明确选中，不继承旧范围和对象');

 assert.equal(await work(page).getByTestId('quick-links').locator('a').count(),6);
 assert.equal(await work(page).getByTestId('quick-links').locator('a[data-featured="true"]').count(),2,'两个重点入口，其余四项保持紧凑');
 assert.deepEqual(await work(page).getByTestId('quick-links').locator('a').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href'))),['/dashboard/agent','/dashboard/tags/risk','/dashboard/segments/risk','/dashboard/knowledge','/dashboard/data/import','/dashboard/evaluation']);
 assert.equal(await rows(todos(page)).count(),10);assert.equal(await rows(latest(page)).count(),6);
 assert.equal(await todos(page).getByText('已逾期',{exact:true}).count(),1);
 await assertSourceLinks(page);
 assert.equal(await work(page).getByRole('button',{name:/确认发布|确认执行|审核并|保存人群/}).count(),0);
 pass('六个常用入口、每页十项待办、六条真实对象范围链接及只读首页');

 await todos(page).locator('.ant-pagination-item[title="2"]').click();
 await page.waitForURL(url=>url.searchParams.get('page')==='2');
 await todos(page).locator('article[data-object-id="fixture-task-10"]').waitFor();assert.equal(await rows(todos(page)).count(),10);
 await filter(page,'方案').locator('..').click();await page.waitForURL(url=>url.searchParams.get('type')==='plan'&&!url.searchParams.has('page'));
 await loaded(page,8);await todos(page).getByText('需要重新准备',{exact:true}).waitFor();await todos(page).getByText('继续处理',{exact:true}).first().waitFor();
 assert.equal(await todos(page).locator('article:not([data-workbench-item="plan"])').count(),0);
 await page.goBack();await page.waitForURL(url=>url.searchParams.get('page')==='2'&&!url.searchParams.has('type'));
 await todos(page).locator('article[data-object-id="fixture-task-10"]').waitFor();
 await page.reload({waitUntil:'networkidle'});await todos(page).locator('article[data-object-id="fixture-task-10"]').waitFor();
 pass('待办分页、类型、过期方案与部分恢复，刷新和返回恢复页码');

 await view(page,'全部功能').locator('..').click();await page.getByTestId('workbench-tools').waitFor();
 const tools=page.getByTestId('workbench-tools');await tools.getByText('16 个可用入口',{exact:true}).waitFor();
 assert.equal(await tools.locator('.ant-collapse-item').count(),4);
 const advanced=tools.locator('.ant-collapse-item').filter({hasText:'高级配置'});
 assert.equal(await advanced.locator('[role="button"]').first().getAttribute('aria-expanded'),'false');
 for(const [width,height] of dimensions)await capture(page,'directory-light',width,height);
 await page.setViewportSize({width:1440,height:900});
 await advanced.locator('[role="button"]').first().click();
 await tools.locator('[data-entry-key="tags-bitmap"]').waitFor();
 assert.equal(await tools.locator('[data-entry-key]').count(),16);assert.equal(await tools.locator('[data-entry-key="db-browser"]').count(),0);
 for(const node of await tools.locator('[data-entry-key]').all()){const href=await node.getAttribute('href');assert.ok(href.startsWith('/dashboard/')&&!href.includes('?'),'功能入口不继承范围或对象');}
 await work(page).getByRole('textbox',{name:'搜索功能',exact:true}).fill('物化');
 await page.waitForURL(url=>url.searchParams.get('q')==='物化');await tools.locator('[data-entry-key="tags-monitor"]').waitFor();
 assert.equal(await tools.locator('[data-entry-key]').count(),1);
 assert.equal(await tools.locator('.ant-collapse-header').first().getAttribute('aria-expanded'),'true');
 await work(page).getByRole('textbox',{name:'搜索功能',exact:true}).fill('智能分析');
 await page.waitForURL(url=>url.searchParams.get('q')==='智能分析');await tools.locator('[data-entry-key="agent"]').waitFor();
 assert.equal(await tools.locator('[data-entry-key]').count(),1);
 await page.reload({waitUntil:'networkidle'});await tools.locator('[data-entry-key="agent"]').waitFor();
 assert.equal(await work(page).getByRole('textbox',{name:'搜索功能',exact:true}).inputValue(),'智能分析');
 await view(page,'我的工作').locator('..').click();await loaded(page);
 await page.goBack();await page.waitForURL(url=>url.searchParams.get('view')==='tools'&&url.searchParams.get('q')==='智能分析');
 await tools.locator('[data-entry-key="agent"]').waitFor();
 pass('四组目录、高级默认折叠、描述与常用功能搜索，视图和搜索刷新返回恢复');

 await open(admin,'?datasetId='+ids.operations+'&runId='+ids.run+'&scope='+encodeURIComponent(JSON.stringify(businessScope)));
 await loaded(page);assert.equal(new URL(page.url()).search,'');
 state.scenario='partial';await refresh(admin);
 await todos(page).getByText('部分待办暂未读到',{exact:true}).waitFor();
 assert.ok((await todos(page).locator('[aria-label="待办类型"]').textContent()).includes('方案—'));
 await todos(page).getByText('部分来源未读到，总数暂不确定',{exact:true}).waitFor();
 assert.equal(await todos(page).getByText('0 项待办',{exact:true}).count(),0);
 await latest(page).getByText('部分最近工作暂未读到',{exact:true}).waitFor();
 state.scenario='todo-error';await refresh(admin);await todos(page).getByText('待办读取失败',{exact:true}).waitFor();
 assert.equal(await todos(page).getByText('暂无待处理事项',{exact:true}).count(),0);assert.equal(await rows(latest(page)).count(),6);
 state.scenario='normal';await todos(page).getByRole('button',{name:/重\s*试$/}).click();await loaded(page);
 state.scenario='http-error';await refresh(admin);await work(page).getByText('个人工作暂时无法读取',{exact:true}).waitFor();
 assert.equal(await rows(todos(page)).count(),10,'刷新失败保留已有结果');
 state.scenario='normal';await work(page).getByRole('button',{name:/重\s*试$/}).click();await work(page).getByText('个人工作暂时无法读取',{exact:true}).waitFor({state:'hidden'});await loaded(page);
 state.scenario='empty';await refresh(admin);await todos(page).getByText('暂无待处理事项',{exact:true}).waitFor();await latest(page).getByText('还没有已保存的工作记录',{exact:true}).waitFor();
 state.scenario='normal';await refresh(admin);await loaded(page);
 pass('部分来源、未知数量、分区及请求失败恢复、保留结果与真实空态');

 state.delayType='task';await filter(page,'任务').locator('..').click();
 await page.waitForFunction(()=>new URLSearchParams(location.search).get('type')==='task');
 // Wait for the controlled old read to start before changing selection.
 await until(()=>state.delayedStarted>0,'旧的任务读取应已开始');
 await filter(page,'材料').locator('..').click();await loaded(page,5);
 assert.equal(new URL(page.url()).searchParams.get('type'),'material');
 await until(()=>state.delayedReleased>0,'受控旧读取应结束');
 await until(()=>state.abortedWorkbench.includes('task'),'切换筛选应取消旧任务读取');
 await settle(page);
 assert.equal(await todos(page).locator('article:not([data-workbench-item="material"])').count(),0,'过时读取不得覆盖当前筛选');
 state.delayType=null;pass('快速切换取消旧读取，旧响应不覆盖当前材料列表');

 await open(admin);await loaded(page);
 for(const theme of ['light','dark']){
  if(theme==='dark')await page.getByRole('button',{name:'切换深色主题',exact:true}).click();
  for(const [width,height] of dimensions){
   await capture(page,'workbench-'+theme,width,height);
   if(width>=1200){
    assert.equal(await work(page).locator('[aria-label="个人工作分区"]').isVisible(),false,'桌面不显示平板和手机的分区切换带');
    const quickBox=await page.getByTestId('quick-links').boundingBox(),todoBox=await todos(page).boundingBox(),recentBox=await latest(page).boundingBox();
    assert.ok(quickBox&&todoBox&&recentBox);assert.ok(todoBox.x+todoBox.width<=recentBox.x+2,'桌面为待办与最近工作左右分区');
    if(width===1440){assert.ok(quickBox.y+quickBox.height<300);assert.ok(todoBox.y<400&&recentBox.y<400);assert.ok((await todos(page).locator('article').first().boundingBox()).y<height);assert.ok((await latest(page).locator('article').first().boundingBox()).y<height);}
   }else{
    await work(page).locator('[aria-label="个人工作分区"]').getByRole('radio',{name:'最近工作',exact:true}).locator('..').click();
    await latest(page).waitFor({state:'visible'});assert.equal(await todos(page).isVisible(),false);
    await capture(page,'workbench-recent-'+theme,width,height);
    await work(page).locator('[aria-label="个人工作分区"]').getByRole('radio',{name:'待办',exact:true}).locator('..').click();await todos(page).waitFor({state:'visible'});
    await page.getByRole('button',{name:'打开导航',exact:true}).click();
    const navigation=page.getByRole('dialog',{name:'常用功能',exact:true});await navigation.waitFor();
    await navigation.getByRole('button',{name:/工作台$/}).click();await navigation.waitFor({state:'hidden'});await work(page).waitFor();
   }
  }
 }
 await page.setViewportSize({width:1024,height:768});await work(page).locator('[aria-label="个人工作分区"]').getByRole('radio',{name:'最近工作',exact:true}).locator('..').click();
 assert.equal(await todos(page).isVisible(),false);assert.equal(await latest(page).isVisible(),true);
 await page.reload({waitUntil:'networkidle'});await latest(page).waitFor({state:'visible'});assert.equal(new URL(page.url()).searchParams.get('mobilePane'),'recent');
 await view(page,'全部功能').locator('..').click();await page.getByTestId('workbench-tools').waitFor();await page.goBack();await latest(page).waitFor({state:'visible'});assert.equal(new URL(page.url()).searchParams.get('mobilePane'),'recent');
 await view(page,'全部功能').locator('..').click();await page.getByTestId('workbench-tools').waitFor();
 for(const [width,height] of dimensions)await capture(page,'directory-dark',width,height);
 pass('四尺寸浅深色、首屏布局、完整导航及平板手机分区与状态恢复');

 // Each role/company starts with fresh browser storage; no real account is involved.
 for(const [role,expected] of [['operator',11],['viewer',10]]){
  const session=await createSession(role);await login(session);await open(session,'?view=tools');
  const directory=session.page.getByTestId('workbench-tools');await directory.getByText(expected+' 个可用入口',{exact:true}).waitFor();
  assert.equal(await directory.locator('[data-entry-key="db-browser"]').count(),0);
  for(const key of ['permissions','settings','audit-logs','recycle-bin','tags-bitmap'])assert.equal(await directory.locator('[data-entry-key="'+key+'"]').count(),0);
  assert.equal(await directory.locator('[data-entry-key="diagnostics"]').count(),role==='operator'?1:0);
  await open(session);await loaded(session.page);
  if(role==='viewer'){
   const links=await todos(session.page).locator('article a').allTextContents();assert.ok(links.every(text=>text.trim()==='查看'));
   assert.equal(await todos(session.page).getByRole('button',{name:/确认|发布|审核|执行/}).count(),0);
  }
 }
 pass('生产目录管理员16、运营11、只读10，数据库浏览器隐藏及只读操作');
 const beta=await createSession('viewer','beta');await login(beta);await open(beta);await loaded(beta.page);
 assert.ok((await work(beta.page).textContent()).includes('乙公司'));assert.equal((await work(beta.page).textContent()).includes('甲公司'),false);
 assert.equal(await beta.page.locator('.header-company').textContent(),companies[1].name);
 assert.equal(await work(beta.page).getByRole('button',{name:/确认发布|确认执行|审核并|保存人群/}).count(),0);
 pass('同名账号的新公司上下文不显示另一公司的个人工作');

 assert.deepEqual(blockedWrites,[],'不得发出业务写入或模型运行请求');
 assert.equal(requests.filter(request=>request.path.startsWith('/api/agent/runs')).length,0);
 assert.deepEqual(errors,[],'页面脚本异常');
 await writeFile(resolve(dir,'result.json'),JSON.stringify({mode:'controlled-api-ui-only',productionDirectory:true,databaseWrites:0,cloudModelCalls:0,checks,screenshots,errors,blockedWrites,requests:requests.map(({role,company,method,path})=>({role,company,method,path}))},null,2));
 console.log(JSON.stringify({checks:checks.length,screenshots:screenshots.length,artifactDir:dir}));
}catch(error){
 await current?.page.screenshot({path:resolve(dir,'failure.png'),fullPage:false}).catch(()=>{});
 await writeFile(resolve(dir,'failure.json'),JSON.stringify({error:error instanceof Error?error.message:String(error),stack:error instanceof Error?error.stack:undefined,checks,errors,blockedWrites},null,2));
 throw error;
}finally{await browser.close();}
