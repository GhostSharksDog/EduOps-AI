import assert from 'node:assert/strict';
import {randomBytes,randomUUID,scryptSync} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {chromium} from '@playwright/test';
const base=process.env.TEST_BASE_URL??'http://127.0.0.1:3302';
const database=new URL(process.env.DATABASE_URL??'');
if(!/^http:\/\/127\.0\.0\.1:330[23]$/.test(base)||database.hostname!=='127.0.0.1'||database.port!=='25432'||database.pathname!=='/education_cleanup_test')throw Error('只允许显式指定第四阶段本机_test环境');
const qa=process.env.TEST_ARTIFACT_DIR??'tests/artifacts/phase4-qa';
const db=new pg.Client({connectionString:database.toString()}),org='6f40f555-5f1b-4d1f-807c-b209e817bfdd',password=randomBytes(24).toString('base64url');
await db.connect();await mkdir(qa,{recursive:true});
const stamp=Date.now(),accounts=['admin','operator','viewer','other'].map(role=>({id:randomUUID(),username:'phase4_'+role+'_'+stamp,role:role==='other'?'admin':role,org:role==='other'?randomUUID():org}));
async function request(path,body,identity,expected=200,method){
 const r=await fetch(base+path,{method:method??(body===undefined?'GET':'POST'),headers:{'Content-Type':'application/json',...(identity?{Authorization:'Bearer '+identity.token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const value=await r.json();assert.equal(r.status,expected,path+' '+JSON.stringify({status:value.status,message:value.message,error:value.error}).slice(0,250));return value;
}
const control=async body=>{const r=await fetch('http://127.0.0.1:3391/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200);};
const providerState=async()=> (await fetch('http://127.0.0.1:3391/state')).json();
try{
 for(const a of accounts){const salt=randomBytes(16).toString('hex');await db.query('INSERT INTO local_user (id,username,password_hash,real_name,role,organization_id,updated_at) VALUES($1,$2,$3,$4,$5,$6,now())',[a.id,a.username,'scrypt:'+salt+':'+scryptSync(password,salt,64).toString('hex'),'第四阶段验收',a.role,a.org]);}
 const [admin,operator,viewer,other]=await Promise.all(accounts.map(a=>request('/api/auth/login',{username:a.username,password})));
 const datasets=(await request('/api/education/datasets',undefined,admin)).data,sim=datasets.find(d=>d.key==='training-sim-20261009');assert.ok(sim,'需先导入固定模拟数据');
 const scope={startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[]};
 const createSource=async(content,title='出勤率口径-'+stamp,extra={})=>(await request('/api/knowledge/sources',{title,kind:'definition',content,evidence:[],...extra},admin,201)).data;
 const approve=async(source,expected=200)=>(await request('/api/knowledge/sources/'+source.id+'/approve',{expectedVersion:Number(source.version),expectedContentHash:source.contentHash},admin,expected)).data;
 const source=await createSource('出勤率按照实际出勤人次除以应出勤人次计算。未知签到不等于缺勤；存在未知签到时不报告完整出勤率。取消课程、退班后的课次与截止时间之后的课次排除。');
 await request('/api/knowledge/sources',undefined,undefined,401);
 await request('/api/knowledge/sources/'+source.id,undefined,other,404);
 await request('/api/knowledge/sources',{title:'禁止',kind:'definition',content:'禁止',evidence:[]},viewer,403);
 await request('/api/knowledge/sources',{title:'伪造机构',kind:'definition',content:'测试',organizationId:org},admin,400);
 await request('/api/knowledge/sources/'+source.id+'/approve',{expectedVersion:1,expectedContentHash:'0'.repeat(64)},admin,409);
 const approved=await approve(source);assert.equal(approved.isCurrent,true);assert.equal(approved.indexStatus,'ready');
 const hits=(await request('/api/knowledge/search',{query:'出勤率未知签到是什么',scope},viewer)).data.hits;assert.ok(hits.some(h=>h.sourceId===source.id));assert.ok(hits.every(h=>h.evidence.version&&h.evidence.sourceId));
 assert.equal((await request('/api/knowledge/search',{query:'出勤率',scope},other)).data.hits.length,0);
 await request('/api/knowledge/sources/'+source.id,{title:source.title,content:'非法原位编辑',expectedContentHash:source.contentHash},admin,409,'PATCH');
 const next=await createSource(source.content+' 请假单独记录并计入应出勤。',source.title,{logicalSourceId:source.logicalSourceId,expectedVersion:1});
 await control({failNextEmbedding:1});const failed=await approve(next,503);assert.equal(failed.indexStatus,'failed');
 assert.ok((await request('/api/knowledge/search',{query:'出勤率',scope},admin)).data.hits.some(h=>h.sourceId===source.id));
 const retried=await approve(next);assert.equal(retried.isCurrent,true);assert.equal((await request('/api/knowledge/sources/'+source.id,undefined,admin)).data.status,'superseded');
 assert.ok((await request('/api/knowledge/search',{query:'出勤率',scope},admin)).data.hits.every(h=>h.sourceId!==source.id));
 const fill=await createSource('满班率按有效班级在班人数总和除以班级容量总和计算，按班级及学员编号去重，排除退班生效日之后的记录。','满班率口径-'+stamp);await approve(fill);
 const hours=await createSource('课耗进度按累计已消耗课时除以合同购买课时计算，课时单位一致，合同与课程范围一致。','课耗进度口径-'+stamp);await approve(hours);
 const policy=(await request('/api/knowledge/sources',{title:'模拟机构跟进制度-'+stamp,kind:'procedure',content:'此制度为模拟机构的演示材料。出勤下降先核查签到和排课，再由运营人员核对风险规则、人群覆盖及证据，经页面确认后联系家长记录反馈。该流程不能证明流失原因。',evidence:[]},admin,201)).data;await approve(policy);
 const expected=(await request('/api/analytics/query',{datasetId:sim.id,scope,metricCodes:['attendance_rate','class_fill_rate','hours_progress']},admin)).data;
 const input={message:'解释出勤变化并创建出勤风险标签草稿，先预览，等待我在页面确认。',requestKey:randomUUID(),datasetId:sim.id,scope};
 await request('/api/agent/runs',input,viewer,403);
 await request('/api/agent/runs',{...input,scope:{...scope,organizationId:other.user.ownedBy}},admin,400);
 const run=(await request('/api/agent/runs',input,admin)).data;assert.equal(run.status,'awaiting_confirmation');assert.equal(run.proposals.length,1);assert.deepEqual(run.steps.map(s=>s.tool),['query_metrics','search_knowledge','propose_tag','preview_tag_rule']);
 for(const m of expected.metrics){const fact=run.answer.facts.find(f=>f.label===({attendance_rate:'出勤率',class_fill_rate:'满班率',hours_progress:'课耗进度'}[m.code]));assert.ok(fact);assert.equal(fact.value,m.value);assert.equal(fact.numerator,m.numerator);assert.equal(fact.denominator,m.denominator);}
 const proposal=run.proposals[0];assert.equal(proposal.estimatedCount,151);assert.ok(proposal.previewToken);
 const stateBefore=await providerState(),same=(await request('/api/agent/runs',input,admin)).data;assert.equal(same.id,run.id);assert.equal((await providerState()).chatRequests,stateBefore.chatRequests);
 await request('/api/agent/runs',{...input,message:'另一问题'},admin,409);
 const count=await db.query('SELECT COUNT(*)::int AS n FROM education_risk_proposal WHERE "agentOperationKey"=$1',[run.id+':fixture-propose_tag']);assert.equal(count.rows[0].n,1);
 const viewerSessions=(await request('/api/agent/sessions',undefined,viewer)).data;assert.ok(viewerSessions.some(s=>s.id===run.sessionId));assert.equal((await request('/api/agent/runs/'+run.id,undefined,viewer)).data.id,run.id);
 await request('/api/agent/runs/'+run.id,undefined,other,404);
 await request('/api/agent/runs',{message:'继续查询',requestKey:randomUUID(),sessionId:run.sessionId},operator,403);
 await request('/api/agent/runs',{message:'确认发布',requestKey:randomUUID(),sessionId:run.sessionId},admin);
 assert.equal((await request('/api/tags/proposals/'+proposal.id,undefined,admin)).data.status,'awaiting_confirmation','聊天确认不能发布');
 const confirm={runId:run.id,proposalId:proposal.id,version:proposal.version,previewToken:proposal.previewToken};
 await request('/api/agent/proposals/confirm',confirm,viewer,403);await request('/api/agent/proposals/confirm',confirm,other,404);
 await request('/api/agent/proposals/confirm',{...confirm,previewToken:randomUUID()},admin,409);await request('/api/agent/proposals/confirm',{...confirm,version:2},admin,409);
 const confirmed=await Promise.all([1,2].map(()=>request('/api/agent/proposals/confirm',confirm,admin)));const published=confirmed[0].data.proposals[0];assert.equal(published.publishedTagId,confirmed[1].data.proposals[0].publishedTagId);
 const tag=(await request('/api/tags/proposals/'+proposal.id,undefined,admin)).data;
 const snapshot=(await request('/api/segments/risk-snapshots',{tagId:published.publishedTagId,tagVersion:published.version,previewFingerprint:tag.preview.fingerprint,name:'Agent确认风险人群-'+stamp},admin)).data;
 const profile=(await request('/api/profiles/search',{snapshotId:snapshot.id},viewer)).data;assert.equal(profile.snapshot.memberCount,151);
 for(const [message,code]of [['测试未知工具','UNKNOWN_TOOL'],['测试恶意参数','INVALID_ARGUMENTS'],['测试循环上限','DUPLICATE_TOOL_CALL']]){const result=await request('/api/agent/runs',{message,requestKey:randomUUID(),datasetId:sim.id,scope},admin,502);assert.equal(result.data.status,'failed');assert.equal(result.data.errorCode,code);}
 await control({failNextChat:1});const failure=await request('/api/agent/runs',{message:'模型故障验证',requestKey:randomUUID(),datasetId:sim.id,scope},admin,502);assert.equal(failure.data.errorCode,'MODEL_HTTP');
 const state=await providerState();assert.equal(state.sentMemberDetails,false);assert.ok(state.requestedTools.every(t=>!['publish_tag','confirm_tag','create_segment'].includes(t)));
 const browser=await chromium.launch({channel:'msedge',headless:true}),errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}});page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(({token,user})=>{localStorage.setItem('auth_token',token);localStorage.setItem('auth_user',JSON.stringify(user));},admin);
  await page.goto(base+'/dashboard/knowledge',{waitUntil:'networkidle'});await page.getByRole('heading',{name:/业务知识库/}).waitFor();await page.screenshot({path:qa+'/knowledge.png',fullPage:true});
  await page.getByRole('button',{name:'录入知识',exact:true}).click();
  await page.locator('input[type="file"]').setInputFiles({name:'phase4-import.md',mimeType:'text/markdown',buffer:Buffer.from('# 模拟知识导入\n\n仅验证文本导入填入草稿。','utf8')});
  await page.getByRole('dialog').getByLabel('来源标题').fill('浏览器导入知识-'+stamp);
  assert.ok((await page.getByRole('dialog').getByLabel('正文',{exact:true}).inputValue()).includes('模拟知识导入'));
  await page.getByRole('dialog').getByRole('button',{name:'保存草稿',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.goto(base+'/dashboard/agent?'+new URLSearchParams({datasetId:sim.id,scope:JSON.stringify(scope),sessionId:run.sessionId,runId:run.id}),{waitUntil:'networkidle'});await page.getByTestId('agent-workspace').waitFor();
  await page.getByRole('combobox',{name:'Agent会话',exact:true}).waitFor();
  await page.getByTestId('agent-run-details').first().waitFor();await page.screenshot({path:qa+'/agent-record.png',fullPage:true});
  await page.getByRole('button',{name:'新建会话',exact:true}).click();
  const browserMessage='浏览器验证：创建出勤风险标签草稿并预览，等待页面确认。';
  const generatedResponse=page.waitForResponse(r=>r.url().endsWith('/api/agent/runs')&&r.request().method()==='POST');
  await page.getByLabel('Agent问题',{exact:true}).fill(browserMessage);await page.getByLabel('发送Agent问题',{exact:true}).click();
  const browserRun=(await(await generatedResponse).json()).data;assert.equal(browserRun.status,'awaiting_confirmation');assert.equal(browserRun.proposals[0].estimatedCount,151);
  await page.getByTestId('agent-proposals').getByRole('button',{name:/确认发布/}).click();await page.getByRole('dialog',{name:'确认发布运营标签'}).waitFor();await page.screenshot({path:qa+'/agent-human-confirmation.png',fullPage:true});
  await page.getByRole('dialog',{name:'确认发布运营标签'}).getByRole('button',{name:'确认发布此版本',exact:true}).click();
  await page.getByRole('link',{name:'前往运营工作台建立人群',exact:true}).click();await page.waitForURL('**/dashboard/tags/risk?**');
  await page.getByRole('button',{name:'确认建立人群快照',exact:true}).waitFor();await page.getByRole('button',{name:'确认建立人群快照',exact:true}).click();await page.getByRole('button',{name:'确认建立',exact:true}).click();
  await page.waitForURL('**/dashboard/data/portrait?**');await page.getByText('人群概况',{exact:true}).waitFor();await page.screenshot({path:qa+'/agent-human-profile.png',fullPage:true});
  assert.equal((await request('/api/tags/proposals/'+browserRun.proposals[0].id,undefined,admin)).data.status,'published');
  await page.goto(base+'/dashboard/data/portrait?snapshotId='+snapshot.id,{waitUntil:'networkidle'});await page.getByText('人群概况',{exact:true}).waitFor();await page.screenshot({path:qa+'/agent-profile.png',fullPage:true});
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
 await writeFile(qa+'/verification.json',JSON.stringify({testedAt:new Date().toISOString(),base,database:'education_cleanup_test',provider:'本机固定响应；不代表真实云模型效果',knowledgeApproval:true,versionRetryAndSwitch:true,organizationIsolation:true,viewerReadOnly:true,serverMetricConsistency:true,riskCoverage:151,requestIdempotency:true,chatCannotPublish:true,concurrentConfirmationIdempotency:true,profileLinked:true,unknownToolRejected:true,invalidToolArgumentsRejected:true,modelFailureStored:true,noMemberDetailsToModel:true,browserMarkdownImport:true,browserAgentQuestion:true,browserHumanTagAndSegmentConfirmation:true,pageErrors:errors},null,2)+'\n');
 console.log('RAG真实向量入库、Agent工具执行、人工确认、人群画像与权限验收通过；风险人数151。');
}finally{await control({}).catch(()=>{});await db.end();}
