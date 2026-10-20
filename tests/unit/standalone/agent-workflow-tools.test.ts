import {randomUUID} from 'node:crypto';
import {describe,expect,it,vi} from 'vitest';
vi.mock('@/modules/tag/server',async()=>({sourceFingerprint:(await import('@/modules/tag/services/risk-service')).sourceFingerprint}));
vi.mock('@/modules/analytics/server',async()=>({reportPeriod:(await import('@/modules/analytics/domain/period')).reportPeriod}));
import {registerWorkflowTools,type WorkflowToolPorts} from '@/modules/agent/services/workflow-tools';
import {ToolRegistry} from '@/modules/agent/services/registry';
import type {ActionPlanService} from '@/modules/agent/services/actions';
import type {AgentActor,ToolExecutionContext,AgentToolPayload} from '@/modules/agent/contracts';
import type {AuthorizedAnalysisScope,AuthorizedScope} from '@/shared/contracts/analysis';
import type {RiskProposalVO} from '@/modules/tag/contracts';
import type {KnowledgeSource} from '@/modules/knowledge/contracts';
import type {DecisionTask} from '@/modules/decision/contracts';
import type {ReportVO} from '@/modules/report/contracts';
import type {AlertVO} from '@/modules/alert/contracts';
import type {ActionPlanVO} from '@/modules/agent/contracts/actions';

function setup(mode:'operations'|'learning'|'finance'='operations'){
 const org=randomUUID(),actor:AgentActor={userId:randomUUID(),organizationId:org,role:'operator'},datasetId=randomUUID(),scope:AuthorizedScope={organizationId:org,authorizedCampusIds:[],startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[]},proposalId=randomUUID();
 const source:KnowledgeSource={id:randomUUID(),logicalSourceId:randomUUID(),title:'口径草稿',kind:'definition',organizationId:org,version:'1',content:'待核对',contentHash:'a'.repeat(64),status:'draft',isCurrent:false,indexStatus:'pending',embeddingModel:null,embeddingDimensions:null,updatedAt:new Date().toISOString(),createdAt:new Date().toISOString(),approvedAt:null,indexedAt:null,error:null,evidence:[]};
 const proposal:RiskProposalVO={id:proposalId,datasetId,name:'运营标签',scope,rule:{type:'renewal_due',withinDays:30},version:1,status:'awaiting_confirmation',preview:null,publishedTagId:null,createdAt:source.createdAt,updatedAt:source.updatedAt};
 const ports:WorkflowToolPorts={datasets:{list:vi.fn(async()=>[{id:datasetId,key:'test',name:'模拟',origin:'simulated' as const,schemaVersion:'3' as const,license:'测试',description:'模拟',dataCutoff:'2026-09-30T15:59:59.999Z',createdAt:source.createdAt}])},tags:{get:vi.fn(async()=>proposal),edit:vi.fn(async(_org,_id,_version,input)=>({...proposal,name:input.name,rule:input.rule,version:2,status:'draft',preview:null}))},alerts:{list:vi.fn(async()=>[])},reports:{list:vi.fn(async()=>[]),get:vi.fn()},decisions:{list:vi.fn(async()=>[]),owners:vi.fn(async()=>[{id:actor.userId,name:'当前运营'}])},knowledge:{list:vi.fn(async()=>[]),create:vi.fn(async()=>source)}};
 const registry=new ToolRegistry<AuthorizedAnalysisScope>(),actions={prepareDecision:vi.fn(),prepareFollowup:vi.fn(),prepareReport:vi.fn()} as unknown as ActionPlanService;
 registerWorkflowTools(registry,{mode,ports,actions});
 const ctx:ToolExecutionContext={actor,runId:randomUUID(),toolCallId:'tool',datasetId,signal:new AbortController().signal,sourceProposalIds:[proposalId]};
 return {actor,org,datasetId,scope,proposalId,proposal,source,ports,registry,actions,ctx};
}
describe('内置业务工具网关',()=>{
 it('学习仅目录查询，财务不注册标签、人群、报告写入，模型没有正式确认工具',()=>{
  const learning=setup('learning'),finance=setup('finance'),operations=setup();
  expect(learning.registry.list().map(t=>t.name)).toEqual(['list_datasets']);expect(finance.registry.list().map(t=>t.name)).toContain('prepare_decision_task');
  for(const name of ['edit_tag_draft','prepare_action_plan','prepare_report','save_knowledge_draft','query_alerts'])expect(finance.registry.list().map(t=>t.name)).not.toContain(name);
  for(const name of ['confirm','publish_tag','save_segment','create_decision_task','delete'])expect(operations.registry.list().map(t=>t.name)).not.toContain(name);
 });
 it('只读账号能够查目录，但提出草稿工具不可见且直接伪造调用被拒绝',async()=>{
  const f=setup(),actor={...f.actor,role:'viewer'},ctx={...f.ctx,actor};expect(f.registry.listFor(actor).every(t=>t.mode==='read')).toBe(true);
  expect((await f.registry.execute('list_datasets',{},f.scope,ctx)).status).toBe('ready');await expect(f.registry.execute('edit_tag_draft',{proposalId:f.proposalId,version:1,name:'变化'},f.scope,ctx)).rejects.toMatchObject({code:'FORBIDDEN_TOOL'});expect(f.ports.tags.edit).not.toHaveBeenCalled();
 });
 it('草稿编辑仅接受同会话及同范围对象，递增版本并要求重新预览',async()=>{
  const f=setup(),result=await f.registry.execute('edit_tag_draft',{proposalId:f.proposalId,version:1,rule:{type:'renewal_due',withinDays:20}},f.scope,f.ctx),payload=result.data as AgentToolPayload;
  expect(payload.proposal).toMatchObject({version:2,status:'draft',estimatedCount:null,previewToken:null});expect(f.ports.tags.edit).toHaveBeenCalledWith(f.org,f.proposalId,1,expect.objectContaining({datasetId:f.datasetId,scope:{startDate:f.scope.startDate,endDate:f.scope.endDate,campusIds:[],courseIds:[],channelIds:[]}}));
  await expect(f.registry.execute('edit_tag_draft',{proposalId:randomUUID(),version:1,name:'其他草稿'},f.scope,f.ctx)).rejects.toMatchObject({code:'UNLINKED_PROPOSAL'});
 });
 it('不改写已发布标签，跨数据集草稿拒绝编辑',async()=>{
  const f=setup();f.proposal.status='published';await expect(f.registry.execute('edit_tag_draft',{proposalId:f.proposalId,version:1,name:'修改'},f.scope,f.ctx)).rejects.toMatchObject({code:'PUBLISHED_DRAFT'});
  f.proposal.status='draft';f.proposal.datasetId=randomUUID();await expect(f.registry.execute('edit_tag_draft',{proposalId:f.proposalId,version:1,name:'修改'},f.scope,f.ctx)).rejects.toMatchObject({code:'OUTSIDE_SCOPE'});expect(f.ports.tags.edit).not.toHaveBeenCalled();
 });
 it('任务查询按真实冻结范围筛选，不泄露其他范围或个人成员信息',async()=>{
  const f=setup(),make=(scope:AuthorizedScope)=>({id:randomUUID(),datasetId:f.datasetId,sourceSnapshot:{scope,evidence:[]},action:'核查后安排跟进',ownerId:f.actor.userId,priority:'normal',dueDate:'2026-10-31',state:'accepted',recordType:'demonstration',segmentSnapshotId:null,version:1}) as DecisionTask;
  const selected=make(f.scope),outside=make({...f.scope,courseIds:['other']});vi.mocked(f.ports.decisions.list).mockResolvedValue([selected,outside]);
  const payload=(await f.registry.execute('query_decision_tasks',{},f.scope,f.ctx)).data as AgentToolPayload;expect((payload.result as {tasks:{id:string}[]}).tasks.map(t=>t.id)).toEqual([selected.id]);expect(JSON.stringify(payload)).not.toContain(outside.id);
 });
 it('任务数量、状态和截止日期均绑定数据库记录，精确查询不声称范围内只有一项任务',async()=>{
  const f=setup(),task={id:randomUUID(),datasetId:f.datasetId,sourceSnapshot:{scope:f.scope,evidence:[]},action:'按出勤名单安排跟进',ownerId:f.actor.userId,ownerName:'本公司运营',priority:'normal',dueDate:'2026-10-31',state:'accepted',recordType:'demonstration',segmentSnapshotId:null,version:3,updatedAt:'2026-10-15T08:00:00Z'} as DecisionTask;
  f.ports.decisions.get=vi.fn(async()=>task);const payload=(await f.registry.execute('query_decision_tasks',{taskId:task.id},f.scope,f.ctx)).data as AgentToolPayload;
  expect(payload.facts.find(v=>v.id.endsWith(':tasks:count'))).toMatchObject({label:'本次查询任务数',value:1});expect(payload.facts.find(v=>v.id.endsWith(':due_date'))).toMatchObject({value:null,displayValue:'2026-10-31',status:'ready'});expect(payload.facts.find(v=>v.id.endsWith(':state'))?.displayValue).toBe('待执行');expect(payload.facts.find(v=>v.id.endsWith(':owner'))?.displayValue).toBe('本公司运营');
  for(const fact of payload.facts)expect(fact.evidenceIds.every(id=>payload.evidence.some(e=>e.id===id))).toBe(true);
  task.sourceSnapshot.scope={...f.scope,courseIds:['outside']};await expect(f.registry.execute('query_decision_tasks',{taskId:task.id},f.scope,f.ctx)).rejects.toMatchObject({code:'OUTSIDE_SCOPE'});
 });
 it('精确报告查询返回冻结数字、生成状态与时间，不把缺失数值补成零',async()=>{
  const f=setup(),reference={id:'attendance',kind:'metric' as const,sourceId:f.datasetId,version:'frozen-v1',summary:'冻结统计',scope:f.scope,updatedAt:'2026-08-31T15:59:59Z'},report={id:randomUUID(),datasetId:f.datasetId,kind:'monthly',status:'completed',snapshot:{scope:f.scope},answer:{summary:'请核查出勤变化',facts:[],hypotheses:[],recommendations:[],limitations:[]},facts:[{id:'metric',label:'出勤率',value:78,unit:'%',status:'ready',evidenceIds:['attendance/frozen-v1']},{id:'unknown',label:'续费率',value:null,unit:'%',status:'insufficient_data',evidenceIds:[]}],evidence:[reference],steps:[],errorMessage:null,createdAt:'2026-10-15T08:00:00Z',completedAt:'2026-10-15T08:01:00Z'} as unknown as ReportVO;
  vi.mocked(f.ports.reports.get).mockResolvedValue(report);const payload=(await f.registry.execute('query_reports',{reportId:report.id},f.scope,f.ctx)).data as AgentToolPayload;
  expect(payload.facts.find(v=>v.id.endsWith(':state'))?.displayValue).toBe('已生成');expect(payload.facts.find(v=>v.id.endsWith(':created_at'))?.displayValue).toBe('2026-10-15 16:00:00（北京时间）');expect(payload.facts.find(v=>v.label==='报告冻结 · 出勤率')).toMatchObject({value:78,evidenceIds:expect.arrayContaining(['attendance@frozen-v1'])});expect(payload.facts.find(v=>v.label==='报告冻结 · 续费率')).toMatchObject({value:null,status:'insufficient_data'});
  report.snapshot.scope={...f.scope,courseIds:['outside']};await expect(f.registry.execute('query_reports',{reportId:report.id},f.scope,f.ctx)).rejects.toMatchObject({code:'OUTSIDE_SCOPE'});
 });
 it('预警数量、百分点阈值、历史状态与时间都有依据，缺失对比值保持未知',async()=>{
  const f=setup(),alert={id:randomUUID(),datasetId:f.datasetId,rule:'attendance_drop',title:'出勤下降',value:72,baseline:null,threshold:5,denominator:40,state:'acknowledged',active:true,version:2,createdAt:'2026-10-15T09:00:00Z',updatedAt:'2026-10-15T09:01:00Z',snapshot:{scope:f.scope,metrics:[]}} as unknown as AlertVO;
  f.ports.alerts.get=vi.fn(async()=>alert);const payload=(await f.registry.execute('query_alerts',{alertId:alert.id},f.scope,f.ctx)).data as AgentToolPayload;
  expect(payload.facts.find(v=>v.id.endsWith(':alerts:active'))?.value).toBe(1);expect(payload.facts.find(v=>v.id.endsWith(':threshold'))).toMatchObject({value:5,unit:'个百分点'});expect(payload.facts.find(v=>v.id.endsWith(':baseline'))).toMatchObject({value:null,status:'insufficient_data'});expect(payload.facts.find(v=>v.id.endsWith(':state'))?.displayValue).toBe('已关注');expect(payload.facts.find(v=>v.id.endsWith(':created_at'))?.displayValue).toBe('2026-10-15 17:00:00（北京时间）');
  alert.snapshot.scope={...f.scope,courseIds:['outside']};await expect(f.registry.execute('query_alerts',{alertId:alert.id},f.scope,f.ctx)).rejects.toMatchObject({code:'OUTSIDE_SCOPE'});
 });
 it('空目录返回核验的零条记录；达到列表上限时明确说明不是全部任务数',async()=>{
  const f=setup(),empty=(await f.registry.execute('query_decision_tasks',{},f.scope,f.ctx)).data as AgentToolPayload;expect(empty.facts.find(v=>v.id.endsWith(':tasks:count'))?.value).toBe(0);expect((empty.result as {complete:boolean}).complete).toBe(true);
  const row={id:randomUUID(),datasetId:f.datasetId,sourceSnapshot:{scope:f.scope,evidence:[]},action:'跟进',ownerId:f.actor.userId,priority:'normal',dueDate:'2026-10-31',state:'accepted',recordType:'demonstration',segmentSnapshotId:null,version:1} as DecisionTask;vi.mocked(f.ports.decisions.list).mockResolvedValue(Array.from({length:200},()=>({...row,id:randomUUID()})));
  const limited=(await f.registry.execute('query_decision_tasks',{},f.scope,f.ctx)).data as AgentToolPayload;expect((limited.result as {complete:boolean}).complete).toBe(false);expect(limited.facts.find(v=>v.id.endsWith(':tasks:count'))).toMatchObject({value:200,label:'本次返回的任务数'});expect(limited.evidence[0].summary).toContain('不作为全部任务总数');expect(JSON.stringify(limited).length).toBeLessThan(60000);
 });
 it('组合操作计划提供可信步骤、规则版本、覆盖、未知、任务期限及公司内责任人，不执行正式动作',async()=>{
  const f=setup(),plan:ActionPlanVO={id:randomUUID(),version:2,runId:f.ctx.runId,datasetId:f.datasetId,scope:f.scope,status:'prepared',sourceFingerprint:'snapshot',createdAt:'2026-10-15T08:00:00Z',updatedAt:'2026-10-15T08:00:00Z',expiresAt:'2026-10-15T08:30:00Z',evidence:[{id:'coverage',kind:'metric',sourceId:f.datasetId,version:'batch-v1',summary:'实际预览名单',updatedAt:'2026-10-15T08:00:00Z'}],preview:{proposalId:f.proposalId,version:1,name:f.proposal.name,rule:f.proposal.rule,memberCount:7,unknownCount:2,expiresAt:'2026-10-15T08:20:00Z'},steps:[{id:'publish',kind:'publish_tag',title:'发布标签',status:'pending',input:{kind:'publish_tag',proposalId:f.proposalId,version:1,previewToken:randomUUID(),previewFingerprint:'fingerprint',sourceFingerprint:'snapshot'}},{id:'segment',kind:'save_segment',title:'保存人群',status:'pending',input:{kind:'save_segment',publishStepId:'publish',name:'跟进人群'}},{id:'task',kind:'create_decision_task',title:'建立任务',status:'pending',input:{kind:'create_decision_task',sourceRunId:f.ctx.runId,segmentStepId:'segment',task:{action:'安排跟进',priority:'high',dueDate:'2026-10-31',reviewMethod:'核对后续出勤',recommendationIndex:0}}}]};
  vi.mocked(f.actions.prepareFollowup).mockResolvedValue(plan);const payload=(await f.registry.execute('prepare_action_plan',{proposalId:f.proposalId,version:1,segmentName:'跟进人群',task:plan.steps[2].input.kind==='create_decision_task'?plan.steps[2].input.task:undefined},f.scope,f.ctx)).data as AgentToolPayload;
  expect(payload.facts.find(v=>v.id.endsWith(':plan:steps'))?.value).toBe(3);expect(payload.facts.find(v=>v.id.endsWith(':plan:pending_steps'))?.value).toBe(3);expect(payload.facts.find(v=>v.id.endsWith(':plan:tag_version'))?.value).toBe(1);expect(payload.facts.find(v=>v.id.endsWith(':plan:coverage'))?.value).toBe(7);expect(payload.facts.find(v=>v.id.endsWith(':plan:unknown'))?.value).toBe(2);expect(payload.facts.find(v=>v.id.endsWith(':plan:task_due_date'))?.displayValue).toBe('2026-10-31');expect(payload.facts.find(v=>v.id.endsWith(':plan:task_priority'))?.displayValue).toBe('高');expect(payload.facts.find(v=>v.id.endsWith(':plan:task_owner_name'))?.displayValue).toBe('当前运营');expect(payload.facts.find(v=>v.id.endsWith(':plan:expires_at'))?.displayValue).toBe('2026-10-15 16:20:00（北京时间）');expect(payload.evidence.find(v=>v.sourceId===plan.id)?.summary).toContain('等待页面确认');expect(JSON.stringify(payload.result)).not.toContain(plan.steps[0].input.kind==='publish_tag'?plan.steps[0].input.previewToken:'unavailable');for(const fact of payload.facts)expect(fact.evidenceIds.every(id=>payload.evidence.some(e=>e.id===id))).toBe(true);
 });
 it('报告和单任务准备返回具体日期、类型和优先级的可信绑定，不以裸数字让模型猜测',async()=>{
  const f=setup(),base:ActionPlanVO={id:randomUUID(),version:1,runId:f.ctx.runId,datasetId:f.datasetId,scope:f.scope,status:'prepared',sourceFingerprint:'snapshot',createdAt:'2026-10-15T08:00:00Z',updatedAt:'2026-10-15T08:00:00Z',evidence:[],steps:[{id:'report',kind:'generate_report',title:'生成报告',status:'pending',input:{kind:'generate_report',kindOfReport:'monthly',anchorDate:'2026-08-15'}}]};vi.mocked(f.actions.prepareReport).mockResolvedValue(base);
  const report=(await f.registry.execute('prepare_report',{kind:'monthly',anchorDate:'2026-08-15'},f.scope,f.ctx)).data as AgentToolPayload;expect(report.facts.find(v=>v.id.endsWith(':plan:steps'))?.value).toBe(1);expect(report.facts.find(v=>v.id.endsWith(':plan:report_anchor_date'))?.displayValue).toBe('2026-08-15');expect(report.facts.find(v=>v.id.endsWith(':plan:report_type'))?.displayValue).toBe('月报');expect(report.facts.find(v=>v.id.endsWith(':plan:report_period'))?.displayValue).toBe('2026-08-01 至 2026-08-31');
  const task={action:'核对经营建议',priority:'normal' as const,dueDate:'2026-10-31',reviewMethod:'查看执行记录',recommendationIndex:0};vi.mocked(f.actions.prepareDecision).mockResolvedValue({...base,steps:[{id:'task',kind:'create_decision_task',title:'任务',status:'pending',input:{kind:'create_decision_task',sourceRunId:f.ctx.runId,task}}]});const prepared=(await f.registry.execute('prepare_decision_task',{task},f.scope,f.ctx)).data as AgentToolPayload;expect(prepared.facts.find(v=>v.id.endsWith(':plan:task_due_date'))?.displayValue).toBe(task.dueDate);expect(prepared.facts.find(v=>v.id.endsWith(':plan:task_priority'))?.displayValue).toBe('普通');expect(prepared.facts.find(v=>v.id.endsWith(':plan:task_owner_name'))?.displayValue).toBe('当前运营');expect(prepared.actionPlan?.status).toBe('prepared');
 });
 it('知识保存使用稳定的工具来源幂等键，保存结果可定位但不自动审核索引',async()=>{
  const f=setup(),input={title:'出勤字段口径',kind:'definition',content:'缺失签到保持未知。'};
  const response=await f.registry.execute('save_knowledge_draft',input,f.scope,f.ctx),payload=response.data as AgentToolPayload;
  expect(f.ports.knowledge.create).toHaveBeenCalledTimes(1);expect(vi.mocked(f.ports.knowledge.create).mock.calls[0][3]).toMatch(/^[0-9a-f-]{36}$/);expect(payload.evidence[0]).toMatchObject({kind:'knowledge',sourceId:f.source.id,version:'1'});expect(payload.evidence[0].summary).toContain('未审核');expect((payload.result as {url:string}).url).toContain('sourceId='+f.source.id);expect(f.source.status).toBe('draft');expect(f.source.indexStatus).toBe('pending');
 });
 it('知识摘要不接受缺失报告的裸模型经营数字，工具参数不允许自报公司或SQL',async()=>{
  const f=setup();await expect(f.registry.execute('save_knowledge_draft',{title:'摘要',kind:'analysis_snapshot',content:'待核验'},f.scope,f.ctx)).rejects.toThrow();await expect(f.registry.execute('list_datasets',{organizationId:randomUUID()},f.scope,f.ctx)).rejects.toThrow();await expect(f.registry.execute('query_reports',{sql:'SELECT * FROM local_user'},f.scope,f.ctx)).rejects.toThrow();expect(f.ports.knowledge.create).not.toHaveBeenCalled();
 });
});
