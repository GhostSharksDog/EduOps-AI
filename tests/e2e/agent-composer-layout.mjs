// Agent输入区集中页面验收：全部API使用内存夹具；不登录、不读写数据库、不访问云模型。
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from '@playwright/test';

const before=process.argv.includes('--capture-before');
const base=process.env.LOCAL_QA_BASE_URL??'http://localhost:3303',address=new URL(base);
assert.ok(['localhost','127.0.0.1'].includes(address.hostname)&&(['3303',...(before?['3100']:[])].includes(address.port)),'仅允许专用3303；before只读截图允许3100');
const dir=resolve('tests/artifacts/agent-composer-qa',before?'before':'after');await mkdir(dir,{recursive:true});
const ids={company:randomUUID(),user:randomUUID(),dataset:randomUUID(),session:randomUUID(),locked:randomUUID()},stamp=new Date().toISOString();
const scope={startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[],dataCutoff:'2026-08-31T15:59:59.999Z'};
const frozen={datasetId:ids.dataset,scope:{...scope,organizationId:ids.company,authorizedCampusIds:[]}};
const user={id:ids.user,username:'composer-fixture',realName:'输入区受控验收',role:'operator',ownedBy:ids.company,companyCode:'composer-fixture',companyName:'受控验收公司'};
const dataset={id:ids.dataset,key:'composer-fixture',name:'受控模拟经营数据',origin:'simulated',schemaVersion:'3',analysisType:'operations',dataCutoff:scope.dataCutoff};
const ready=data=>({status:'ready',message:'',data});
const answer=summary=>({kind:'conversation',summary,facts:[],hypotheses:[],recommendations:[],limitations:[]});
const store={session:{id:ids.session,title:'输入区与历史滚动验收',datasetId:ids.dataset,scope:frozen.scope,createdBy:ids.user,editable:true,createdAt:stamp,updatedAt:stamp},runs:[],messages:[]};
const locked={session:{...store.session,id:ids.locked,title:'仅可查看的保存会话',editable:false},runs:[],messages:[]};
const stores=new Map([[ids.session,store],[ids.locked,locked]]),pending=new Map(),sent=[],writes=[],errors=[],blockedExternal=[],checks=[],screenshots=[],measurements=[];
function makeRun(sessionId=ids.session){return {id:randomUUID(),sessionId,status:'completed',context:frozen,steps:[],proposals:[],evidence:[],answer:answer('已保存的受控回答；不代表实际经营分析。'),startedAt:stamp,completedAt:stamp,errorCode:null,errorMessage:null};}
function save(run,question){const item=stores.get(run.sessionId);item.runs.push(run);item.messages.push({id:randomUUID(),sessionId:run.sessionId,runId:run.id,role:'user',content:question,createdAt:stamp},{id:randomUUID(),sessionId:run.sessionId,runId:run.id,role:'assistant',content:JSON.stringify(run.answer),createdAt:stamp});}
for(let i=0;i<24;i++)save(makeRun(),'保存的第'+(i+1)+'轮问题：浏览历史时不应被新进度抢回滚动位置。');
const lockedRun=makeRun(ids.locked);save(lockedRun,'查看保存的历史分析');
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),page=await context.newPage();
page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
await context.addInitScript(value=>{localStorage.setItem('auth_token','controlled-composer-fixture');localStorage.setItem('auth_user',JSON.stringify(value));localStorage.setItem('education-theme','light');},user);
await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());
 if(url.origin!==address.origin){blockedExternal.push({origin:url.origin,method:request.method()});return route.abort();}
 if(!url.pathname.startsWith('/api/'))return route.continue();
 const path=url.pathname,method=request.method(),body=request.postData()?request.postDataJSON():undefined;
 const respond=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 if(path==='/api/auth/me')return respond({user});
 if(path==='/api/settings')return respond({sessionTimeout:30,pageSize:20,language:'zh-CN',theme:'light'});
 if(path==='/api/education/datasets')return respond(ready([dataset]));
 if(path==='/api/education/datasets/'+ids.dataset)return respond(ready({catalog:[]}));
 if(path==='/api/agent')return respond(ready({tools:[]}));
 if(path==='/api/agent/sessions')return respond(ready([...stores.values()].map(item=>item.session)));
 if(path.startsWith('/api/agent/sessions/'))return respond(ready(stores.get(path.split('/').at(-1))??null));
 if(path==='/api/agent/runs/progress'){
  const active=[...pending.values()].find(item=>item.key===url.searchParams.get('requestKey')||item.run.id===url.searchParams.get('runId'));
  return respond(ready({prepared:!!active,run:active?.run??null,expired:false,deadlineAt:new Date(Date.now()+120000).toISOString()}));
 }
 if(path==='/api/agent/runs'&&method==='POST'){
  assert.ok(!before,'before截图不得提交分析');sent.push(body);const run=makeRun(body.sessionId??ids.session);
  if(body.message.includes('等待验收')){
   run.status='running';run.completedAt=null;run.answer=null;run.steps=[{id:randomUUID(),tool:'context',status:'completed',context:frozen,evidence:[],facts:[]}];save(run,body.message);
   let release;const gate=new Promise(resolve=>{release=resolve;});pending.set(run.id,{run,key:body.requestKey,release});await gate;
   run.status='completed';run.completedAt=new Date().toISOString();run.answer=answer('受控慢速回答已经完成。');pending.delete(run.id);
   try{return await respond(ready(run));}catch{return;}
  }
  save(run,body.message);return respond(ready(run));
 }
 if(!['GET','HEAD'].includes(method)&&!['/api/analytics/channels/catalog','/api/overview/journey/query','/api/overview/query'].includes(path))writes.push({method,path});
 return respond(ready([]));
});
const prompt=()=>page.getByRole('textbox',{name:'Agent问题',exact:true}),send=()=>page.getByRole('button',{name:'发送Agent问题',exact:true}),feed=()=>page.getByRole('log',{name:'对话记录',exact:true});
const composer=()=>page.getByTestId('agent-composer');
const footer=()=>composer().locator('[data-testid="agent-composer-footer"], [class*="composerFooter"]').first();
const pass=name=>{checks.push({name,passed:true});console.log('通过：'+name);};
async function conversation(){if(page.viewportSize().width<1200)await page.locator('[aria-label="智能分析区域"]').getByText('对话',{exact:true}).click();}
async function capture(name){const file=resolve(dir,name+'.png');await page.screenshot({path:file,fullPage:false,animations:'disabled'});screenshots.push(file);}
async function openSession(sessionId=ids.session){const item=stores.get(sessionId);await page.goto(base+'/dashboard/agent?'+new URLSearchParams({datasetId:ids.dataset,scope:JSON.stringify(scope),sessionId,runId:item.runs.at(-1).id}),{waitUntil:'networkidle'});await page.getByTestId('agent-workspace').waitFor();await conversation();}
async function theme(value){if(await page.evaluate(()=>document.body.dataset.theme)!==value){await page.getByRole('button',{name:value==='dark'?'切换深色主题':'切换浅色主题',exact:true}).click();await page.waitForFunction(theme=>document.body.dataset.theme===theme,value);}}
async function geometry(label,enforce=true){
 const input=await prompt().boundingBox(),row=await footer().boundingBox(),button=await send().boundingBox(),outer=await composer().boundingBox();
 assert.ok(input&&row&&button&&outer,'输入、footer和按钮应可读取');
 const hint=await footer().locator('.ant-typography').first().boundingBox(),viewport=page.viewportSize();
 const value={label,viewport,input,row,button,hint,composer:outer,gap:row.y-input.y-input.height};measurements.push(value);
 if(enforce){
  assert.ok(value.gap>=11.5,'输入与操作行至少12px：'+label+' 实际'+value.gap);
  assert.ok(outer.y>=0&&outer.y+outer.height<=viewport.height+2,'完整输入区保持首屏可见：'+label);
  assert.ok(button.y>=row.y-.5&&button.y+button.height<=row.y+row.height+.5,'发送按钮在footer内：'+label);
  assert.ok(hint&&((hint.x+hint.width<=button.x-7)||(hint.y+hint.height<=button.y-7)),'提示不能压住按钮：'+label);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'页面无横向溢出：'+label);
 }
 return value;
}
async function submittedByShortcut(key,text){await prompt().fill(text);const result=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/agent/runs'&&response.request().method()==='POST');await prompt().press(key);const body=await(await result).json();await page.getByTestId('agent-conversation-turn-'+body.data.id).getByText('已完成',{exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('[aria-label="发送Agent问题"]')?.classList.contains('ant-btn-loading'));assert.equal(sent.at(-1).message,text);}
try{
 await openSession();await prompt().waitFor();
 if(before){
  for(const [width,height] of [[1440,900],[390,844]]){await page.setViewportSize({width,height});await conversation();await prompt().fill('这是一段待发送的问题。\n请对当前范围展开分析。');await geometry('before-'+width,false);await capture('composer-before-light-'+width);}
  assert.equal(sent.length,0);assert.deepEqual(writes,[]);await writeFile(resolve(dir,'verification.json'),JSON.stringify({kind:'controlled-before-capture',testedAt:new Date().toISOString(),realDatabaseUsed:false,modelCalls:0,businessWrites:0,measurements,screenshots,errors},null,2));
 }else{
  for(const color of ['light','dark']){
   await theme(color);
   for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[390,844]]){
    await page.setViewportSize({width,height});await conversation();await prompt().fill('');await prompt().blur();await geometry(color+'-'+width+'-empty');await capture('composer-'+color+'-'+width+'-empty');
    assert.equal(await send().isDisabled(),true);const shortHeight=(await prompt().boundingBox()).height;
    await prompt().fill(Array.from({length:18},(_,i)=>'第'+(i+1)+'行：这是用于验证自动增高和长文本滚动的未提交问题。').join('\n'));await prompt().blur();
    const value=await geometry(color+'-'+width+'-long');const dimensions=await prompt().evaluate(node=>{const style=getComputedStyle(node);return {lineHeight:parseFloat(style.lineHeight),padding:parseFloat(style.paddingTop)+parseFloat(style.paddingBottom),border:parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth),scrollHeight:node.scrollHeight,clientHeight:node.clientHeight};});
    assert.ok(value.input.height>shortHeight+10,'多行输入应自动增高');assert.ok(value.input.height<=dimensions.lineHeight*4+dimensions.padding+dimensions.border+3,'输入最多四行高度');assert.ok(dimensions.scrollHeight>dimensions.clientHeight,'更长文字在输入内滚动');
    const stable=(await composer().boundingBox()).y;await feed().evaluate(node=>{node.scrollTop=0;});assert.ok(Math.abs((await composer().boundingBox()).y-stable)<2,'长历史滚动不移动输入区');await capture('composer-'+color+'-'+width+'-long');
   }
  }
  pass('四尺寸浅深主题、空输入与长文本：12px分行、不重叠、四行上限和固定操作区');
  await page.setViewportSize({width:1440,height:900});await theme('light');await prompt().fill('第一行');let beforeCount=sent.length;await prompt().press('Enter');await prompt().pressSequentially('第二行');assert.equal(await prompt().inputValue(),'第一行\n第二行');assert.equal(sent.length,beforeCount);
  await prompt().dispatchEvent('compositionstart',{data:'输'});await prompt().dispatchEvent('keydown',{key:'Enter',code:'Enter',ctrlKey:true,isComposing:true,keyCode:229});await prompt().dispatchEvent('keydown',{key:'Enter',code:'Enter',metaKey:true,isComposing:true,keyCode:229});await prompt().dispatchEvent('compositionend',{data:'输入'});assert.equal(sent.length,beforeCount);assert.equal(await prompt().inputValue(),'第一行\n第二行');
  await submittedByShortcut('Control+Enter','Ctrl快捷键提交');await submittedByShortcut('Meta+Enter','Meta快捷键提交');pass('普通Enter换行、中文组合输入不误发，Ctrl/MetaEnter分别提交一次');
  await prompt().fill('等待验收：持续输入和历史滚动');const completed=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/agent/runs'&&response.request().method()==='POST',{timeout:0});completed.catch(()=>{});await send().click();await page.getByText(/已等待 \d+ 秒/).waitFor();
  await prompt().fill('分析期间新写的下一问');assert.equal(await prompt().isEditable(),true);beforeCount=sent.length;await prompt().press('Control+Enter');await prompt().press('Meta+Enter');await send().evaluate(node=>node.click());assert.equal(sent.length,beforeCount);assert.equal(await send().isDisabled(),true);await geometry('running-draft');await capture('composer-running-draft');
  await feed().evaluate(node=>{node.scrollTop=0;node.dispatchEvent(new Event('scroll'));});const oldScroll=await feed().evaluate(node=>node.scrollTop);
  const active=[...pending.values()][0];assert.ok(active);active.run.steps.push({id:randomUUID(),tool:'query_metrics',status:'completed',context:frozen,evidence:[],facts:[]});
  const unread=page.getByRole('button',{name:/查看新消息/});await unread.waitFor();assert.ok(Math.abs(await feed().evaluate(node=>node.scrollTop)-oldScroll)<3,'新进度不抢回历史滚动');
  const unreadBox=await unread.boundingBox(),feedBox=await page.getByTestId('agent-feed-viewport').boundingBox(),composerBox=await composer().boundingBox();assert.ok(unreadBox&&feedBox);assert.ok(unreadBox.y>=feedBox.y&&unreadBox.y+unreadBox.height<=feedBox.y+feedBox.height+1,'新消息按钮锚定feed内部');assert.ok(unreadBox.y+unreadBox.height<=composerBox.y,'新消息按钮不覆盖composer');assert.ok(feedBox.y+feedBox.height-unreadBox.y-unreadBox.height<=30,'新消息按钮接近feed底部');await capture('new-message-at-feed-bottom');
  await unread.click();await page.waitForFunction(()=>{const node=document.querySelector('[role="log"][aria-label="对话记录"]');return node&&node.scrollHeight-node.scrollTop-node.clientHeight<4;});active.release();await completed;await page.waitForFunction(()=>!document.querySelector('[aria-label="发送Agent问题"]')?.disabled);assert.equal(await prompt().inputValue(),'分析期间新写的下一问');await geometry('completed-preserves-draft');await prompt().fill('');pass('分析中可起草且防重复，阅读历史不抢滚动，新消息按钮独立于输入区且完成后保留新稿');
  await openSession(ids.locked);await page.getByText('此会话仅可查看，请新建会话提问。',{exact:true}).waitFor();assert.equal(await prompt().count(),0);assert.equal(await send().count(),0);await capture('noneditable-session');pass('不可编辑会话显示明确提示，不提供误导性的输入和发送按钮');
  assert.deepEqual(writes,[],'不执行正式业务写入');assert.deepEqual(errors,[],'页面无未处理异常');
  await writeFile(resolve(dir,'verification.json'),JSON.stringify({kind:'controlled-composer-ui',testedAt:new Date().toISOString(),realDatabaseUsed:false,realLoginUsed:false,modelCalls:0,businessWrites:0,fixtureAnalysisSubmissions:sent.length,checks,measurements,screenshots,errors,unexpectedWrites:writes,blockedExternal},null,2));
  console.log(JSON.stringify({passed:checks.length,screenshots:screenshots.length,fixtureAnalysisSubmissions:sent.length,modelCalls:0,businessWrites:0}));
 }
}catch(error){const suffix=new Date().toISOString().replaceAll(':','-');await capture('failure-'+suffix).catch(()=>{});await writeFile(resolve(dir,'failure-'+suffix+'.json'),JSON.stringify({error:String(error),checks,measurements,screenshots,errors,writes,submittedQuestions:sent.length},null,2));throw error;}
finally{for(const item of pending.values())item.release();await context.close();await browser.close();}
