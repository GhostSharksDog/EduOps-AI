// 独立受控API验收：不访问数据库、不调用云模型、不执行任何正式操作。
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from '@playwright/test';

const base='http://localhost:3303',dir=resolve('tests/artifacts/agent-evidence-qa/partial-ui');await mkdir(dir,{recursive:true});
const ids={org:randomUUID(),user:randomUUID(),dataset:randomUUID(),session:randomUUID()},stamp=new Date().toISOString();
const scope={startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[],dataCutoff:'2026-08-31T15:59:59.999Z'};
const contextScope={datasetId:ids.dataset,scope:{...scope,organizationId:ids.org,authorizedCampusIds:[]}};
const user={id:ids.user,username:'partial-fixture',realName:'受控部分结果验收',role:'operator',ownedBy:ids.org,companyCode:'fixture',companyName:'受控验收公司'};
const dataset={id:ids.dataset,key:'partial-fixture',name:'受控模拟经营数据',origin:'simulated',analysisType:'operations',schemaVersion:'3',dataCutoff:scope.dataCutoff};
const evidence={id:'partial-metric@1',kind:'metric',sourceId:ids.dataset,version:'1',scope,summary:'仅用于受控界面检查的程序查询依据',updatedAt:stamp};
const fact={id:'partial-query:attendance_rate',label:'出勤率',value:72.5,unit:'%',status:'ready',evidenceIds:[evidence.id]};
const chart={id:'partial-chart',title:'已查询出勤率',kind:'bar',metricCodes:['attendance_rate'],unit:'%',categories:['本期'],categoryLabel:'周期',series:[{name:'出勤率',points:[{value:72.5,status:'ready'}]}],evidenceIds:[evidence.id],source:{datasetId:ids.dataset,datasetName:dataset.name,origin:'simulated',analysisType:'operations',scope}};
const makeRun=()=>({id:randomUUID(),sessionId:ids.session,status:'failed',context:contextScope,steps:[{id:randomUUID(),tool:'query_metrics',status:'completed',context:contextScope,evidence:[evidence],facts:[fact],visualizations:[chart]}],proposals:[],evidence:[evidence],answer:{kind:'analysis',summary:'旧失败记录的保存信息',facts:[fact],hypotheses:[],recommendations:[],limitations:[]},errorCode:'UNVERIFIED_NUMBER',errorMessage:'部分解读未通过核对',startedAt:stamp,completedAt:stamp,recoveryEligibility:{eligible:true}});
const partial=makeRun();partial.errorCode='INCOMPLETE_ANALYSIS';partial.answer={...partial.answer,summary:'恶意未验证结论89%',hypotheses:['恶意未验证原因89%'],recommendations:['恶意未验证建议89%'],limitations:['恶意限制89%'],questions:[{id:'bad',prompt:'恶意问题89%',options:[{label:'恶意选项89%',value:'自动确认发布'}]}],partial:{kind:'facts_only',reasonCode:'INCOMPLETE_ANALYSIS',missingTools:['query_metric_breakdown']}};
const legacy=makeRun(),planned=makeRun();planned.status='awaiting_confirmation';planned.errorCode=null;planned.errorMessage=null;planned.answer={...planned.answer,kind:'action',summary:'已准备计划，正式操作仍需确认。'};
planned.actionPlan={id:randomUUID(),version:1,runId:planned.id,datasetId:ids.dataset,scope:contextScope.scope,status:'prepared',sourceFingerprint:'controlled-only',createdAt:stamp,updatedAt:stamp,expiresAt:new Date(Date.now()+1800000).toISOString(),evidence:[],steps:[{id:randomUUID(),kind:'generate_report',title:'生成经营月报',status:'pending',input:{kind:'generate_report',kindOfReport:'monthly',anchorDate:'2026-08-31'}}]};
const runs=[partial,legacy,planned],session={id:ids.session,title:'部分结果兼容验收',datasetId:ids.dataset,scope:contextScope.scope,createdBy:ids.user,editable:true,createdAt:stamp,updatedAt:stamp};
const detail={session,runs,messages:runs.flatMap(run=>[{id:randomUUID(),runId:run.id,sessionId:ids.session,role:'user',content:'查看这条保存结果',createdAt:stamp},{id:randomUUID(),runId:run.id,sessionId:ids.session,role:'assistant',content:JSON.stringify(run.answer),createdAt:stamp}])};
const checks=[],screenshots=[],writes=[],errors=[],ready=data=>({status:'ready',message:'',data});
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
await context.addInitScript(user=>{localStorage.setItem('auth_token','controlled-partial-only');localStorage.setItem('auth_user',JSON.stringify(user));localStorage.setItem('education-theme','light');},user);
await context.route('**/api/**',route=>{
 const request=route.request(),path=new URL(request.url()).pathname;let body=ready([]);
 if(path==='/api/auth/me')body={user};
 else if(path==='/api/settings')body={sessionTimeout:30,pageSize:20,language:'zh-CN',theme:'light'};
 else if(path==='/api/education/datasets')body=ready([dataset]);
 else if(path==='/api/education/datasets/'+ids.dataset)body=ready({catalog:[]});
 else if(path==='/api/agent')body=ready({tools:[{name:'query_metrics',description:'查询指标',mode:'read',status:'ready'}]});
 else if(path==='/api/agent/sessions')body=ready([session]);
 else if(path==='/api/agent/sessions/'+ids.session)body=ready(detail);
 else if(!['GET','HEAD'].includes(request.method())&&!['/api/analytics/channels/catalog','/api/overview/journey/query'].includes(path))writes.push({method:request.method(),path});
 return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
});
const pass=name=>{checks.push({name,passed:true});console.log('通过：'+name);};
const runDetails=run=>page.locator('[data-testid="agent-run-details"][data-run-id="'+run.id+'"]');
async function capture(name){const file=resolve(dir,name+'.png');await page.screenshot({path:file,animations:'disabled'});screenshots.push(file);}
async function select(run){if(page.viewportSize().width<1200)await page.locator('[aria-label="智能分析区域"]').getByText('对话',{exact:true}).click();await page.getByTestId('agent-conversation-turn-'+run.id).getByRole('button').click();if(page.viewportSize().width<1200)await page.locator('[aria-label="智能分析区域"]').getByText(/^结果/).click();await runDetails(run).waitFor();}
try{
 await page.goto(base+'/dashboard/agent?'+new URLSearchParams({datasetId:ids.dataset,sessionId:ids.session,runId:partial.id}),{waitUntil:'networkidle'});const panel=runDetails(partial);await panel.waitFor();
 await panel.getByTestId('agent-partial-result').getByText('数据已查到，分析尚未完整',{exact:true}).waitFor();
 const tag=panel.locator('.ant-tag').filter({hasText:/^部分完成$/});assert.equal(await tag.count(),1);assert.ok((await tag.getAttribute('class')).includes('ant-tag-orange'));
 assert.equal(partial.status,'failed');assert.doesNotMatch(await page.locator('body').innerText(),/89%|恶意未验证|恶意问题|恶意限制/);
 assert.ok((await panel.getByTestId('agent-facts').innerText()).includes('72.5'));assert.equal(await panel.getByRole('button',{name:'仅重试解读',exact:true}).count(),0);await panel.getByRole('button',{name:'重新查询',exact:true}).waitFor();await panel.getByText('必要查询尚未完成，请重新查询补齐。仅重试解读不会补查缺失数据。',{exact:true}).waitFor();
 const visual=panel.getByTestId('agent-analysis-visuals');await visual.getByRole('img').first().waitFor();assert.ok(await visual.locator('svg').count()>0);await visual.getByText('查看图表数据',{exact:true}).click();assert.ok((await visual.getByRole('table').innerText()).includes('72.5'));
 await page.getByTestId('agent-conversation-turn-'+partial.id).scrollIntoViewIfNeeded();await panel.evaluate(node=>{const scroller=node.closest('[class*="resultScroll"]');if(scroller)scroller.scrollTop=0;});await capture('partial-facts-only-light-1440');pass('显式部分结果橙色提示、只展示程序事实图表、缺查询不提供仅解读恢复');
 await select(legacy);const legacyPanel=runDetails(legacy);assert.equal(await legacyPanel.locator('.ant-tag').filter({hasText:/^执行失败$/}).count(),1);assert.equal(await legacyPanel.getByTestId('agent-partial-result').count(),0);await capture('legacy-failed-light-1440');pass('无显式partial的旧失败保持执行失败，不提升成功状态');
 await select(planned);await runDetails(planned).getByRole('tab',{name:/操作计划/}).click();await page.getByTestId('agent-action-plan').getByRole('button',{name:'核对并执行',exact:true}).click();const modal=page.getByRole('dialog',{name:/确认执行操作计划/});await modal.waitFor();assert.deepEqual(writes,[]);await modal.getByRole('button',{name:'返回核对',exact:true}).click();pass('正式业务仍需独立页面确认，打开计划或部分结果不执行写操作');
 await select(partial);await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'切换深色主题',exact:true}).click();await page.waitForFunction(()=>document.body.dataset.theme==='dark');
 await page.locator('[aria-label="智能分析区域"]').getByText(/^结果/).click();assert.ok((await page.locator('[aria-label="智能分析区域"]').innerText()).includes('部分完成'));assert.doesNotMatch(await page.locator('body').innerText(),/89%|恶意未验证/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await capture('partial-facts-only-dark-390');
 await page.locator('[aria-label="智能分析区域"]').getByText('对话',{exact:true}).click();const turn=page.getByTestId('agent-conversation-turn-'+partial.id);assert.ok((await turn.innerText()).includes('部分完成'));assert.doesNotMatch(await turn.innerText(),/89%/);assert.equal(await page.getByRole('textbox',{name:'Agent问题',exact:true}).isEditable(),true);pass('手机结果与历史轮次同步部分状态，拒绝正文不泄漏且可继续输入');
 assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);await writeFile(resolve(dir,'verification.json'),JSON.stringify({testedAt:new Date().toISOString(),kind:'controlled-partial-ui',checks,screenshots,businessWrites:0,modelCalls:0,realDatabaseUsed:false,writes,errors},null,2));console.log(JSON.stringify({passed:checks.length,screenshots:screenshots.length,businessWrites:0,modelCalls:0}));
}catch(error){await capture('failure').catch(()=>{});await writeFile(resolve(dir,'failure.json'),JSON.stringify({error:String(error),checks,screenshots,writes,errors},null,2));throw error;}
finally{await context.close();await browser.close();}
