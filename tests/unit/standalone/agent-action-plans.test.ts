import {randomUUID} from 'node:crypto';
import {beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('@/modules/tag/server',async()=>({sourceFingerprint:(await import('@/modules/tag/services/risk-service')).sourceFingerprint}));
vi.mock('@/modules/analytics/server',async()=>({reportPeriod:(await import('@/modules/analytics/domain/period')).reportPeriod}));
import {ActionPlanService,stableActionKey,type ActionBusinessPorts} from '@/modules/agent/services/actions';
import type {ActionPlanStore,ActionRunSource} from '@/modules/agent/services/action-store';
import {sourceFingerprint} from '@/modules/tag/services/risk-service';
import type {ActionPlanVO,ActionTaskInput} from '@/modules/agent/contracts/actions';
import {confirmActionPlanSchema,editActionPlanSchema} from '@/modules/agent/contracts/actions';
import type {AgentActor,ToolExecutionContext} from '@/modules/agent/contracts';
import type {AuthorizedScope} from '@/shared/contracts/analysis';
import type {DatasetVO,ImportResultVO} from '@/modules/education/contracts';
import type {RiskProposalVO} from '@/modules/tag/contracts';
import {AgentError} from '@/modules/agent/domain/errors';
import type {DecisionTask} from '@/modules/decision/contracts';
import {WorkflowError} from '@/shared/errors/workflow-error';

class MemoryPlans implements ActionPlanStore {
 constructor(public run:ActionRunSource){}
 async get(actor:AgentActor,id:string){if(id!==this.run.id||actor.organizationId!==this.run.context.scope.organizationId)throw new AgentError('NOT_FOUND','无权访问',404);return structuredClone(this.run);}
 async mutate(actor:AgentActor,id:string,planId:string,change:(p:ActionPlanVO,r:ActionRunSource)=>void){
  const copy=await this.get(actor,id),plan=copy.steps.find(s=>s.actionPlan?.id===planId)?.actionPlan;if(!plan)throw new AgentError('PLAN_NOT_FOUND','无计划',404);
  change(plan,copy);plan.updatedAt=new Date().toISOString();this.run=copy;return structuredClone(plan);
 }
 add(plan:ActionPlanVO){this.run.steps.push({id:plan.id,tool:'prepare_action_plan',status:'completed',evidence:plan.evidence,context:this.run.context,actionPlan:structuredClone(plan)});this.run.status='awaiting_confirmation';}
}
function fixture(){
 const actor:AgentActor={userId:randomUUID(),organizationId:randomUUID(),role:'operator'},id=randomUUID(),scope:AuthorizedScope={organizationId:actor.organizationId,authorizedCampusIds:[],startDate:'2026-08-01',endDate:'2026-08-31',campusIds:['campus'],courseIds:['course'],channelIds:['web'],dataCutoff:'2026-08-31T15:59:59.999Z'};
 const dataset:DatasetVO={id,key:'unit',name:'独立模拟测试',origin:'simulated',schemaVersion:'3',license:'测试',dataCutoff:scope.dataCutoff!,description:'仅用于测试',createdAt:new Date().toISOString()};
 const batches:ImportResultVO[]=[{id:randomUUID(),datasetId:id,kind:'attendance',filename:'attendance.csv',status:'completed',inputRows:100,acceptedRows:100,rejectedRows:0,duplicateRows:0,issues:[],createdAt:dataset.createdAt,completedAt:dataset.createdAt,error:null,fileHash:'hash'}];
 const token=randomUUID(),proposal:RiskProposalVO={id:randomUUID(),datasetId:id,name:'出勤跟进',scope,version:2,status:'awaiting_confirmation',rule:{type:'attendance_below',thresholdPercent:80,minimumDue:4},publishedTagId:null,createdAt:dataset.createdAt,updatedAt:dataset.createdAt,preview:{token,fingerprint:'a'.repeat(64),sourceFingerprint:sourceFingerprint(id,batches),scope,dataset,ruleVersion:2,calculatorVersion:'attendance-v1',memberCount:7,observedCount:10,unknownStudentCount:2,members:[],evidence:[{id:'source',kind:'metric',sourceId:id,version:'v1',summary:'已计算的覆盖范围',scope,updatedAt:scope.dataCutoff!}],batches:[],catalog:[],createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+1800000).toISOString()}};
 const run:ActionRunSource={id:randomUUID(),sessionId:randomUUID(),createdBy:actor.userId,status:'completed',context:{datasetId:id,scope},answer:{summary:'需跟进出勤',facts:[],hypotheses:[],recommendations:['核查缺勤原因并复核出勤'],limitations:[]},evidence:proposal.preview!.evidence,proposals:[],steps:[]};
 const store=new MemoryPlans(run),writes:string[]=[],tagId=randomUUID(),segmentId=randomUUID(),decisionId=randomUUID(),reportId=randomUUID();
 const ports:ActionBusinessPorts={authorize:vi.fn(async()=>{}),inspect:vi.fn(async()=>({dataset,batches})),tags:{get:vi.fn(async()=>structuredClone(proposal)),confirm:vi.fn(async()=>{writes.push('publish');proposal.status='published';proposal.publishedTagId=tagId;return structuredClone(proposal);})},segments:{create:vi.fn(async(_org:string,_user:string,input:{name:string})=>{writes.push('segment');return {id:segmentId,name:input.name};})},decisions:{owners:vi.fn(async()=>[{id:actor.userId,name:'运营'}]),source:vi.fn(async()=>({datasetId:id,scope})),create:vi.fn(async()=>{writes.push('decision');return {id:decisionId};})},reports:{generate:vi.fn(async()=>{writes.push('report');return {id:reportId,status:'completed',errorMessage:null};})}};
 const context:ToolExecutionContext={actor,runId:run.id,toolCallId:'prepare',datasetId:id,signal:new AbortController().signal,sourceProposalIds:[proposal.id],proposalIds:[]},service=new ActionPlanService(store,ports);
 const task:ActionTaskInput={action:'核查缺勤并安排跟进',priority:'normal',dueDate:'2026-10-31',reviewMethod:'核对后续出勤与处理记录',recommendationIndex:0};
 const prepare=async(withTask=true)=>{const plan=await service.prepareFollowup({proposalId:proposal.id,version:2,segmentName:'出勤跟进人群',...(withTask?{task}:{})},scope,context);store.add(plan);return plan;};
 const confirm=(plan:ActionPlanVO,extra:Record<string,unknown>={})=>service.confirm({runId:run.id,planId:plan.id,version:plan.version,requestKey:randomUUID(),...extra},actor);
 return {actor,scope,dataset,batches,proposal,run,store,writes,ports,service,context,task,prepare,confirm,segmentId,decisionId,tagId};
}
function savedTask(f:ReturnType<typeof fixture>,changes:Partial<DecisionTask>={}):DecisionTask{return {id:f.decisionId,datasetId:f.dataset.id,source:{kind:'agent',id:f.run.id,index:0},sourceSnapshot:{key:'agent:'+f.run.id+':0',source:{kind:'agent',id:f.run.id,index:0},datasetId:f.dataset.id,scope:f.scope,answer:f.run.answer!,recommendation:'核查缺勤原因并复核出勤',evidence:f.run.evidence,createdAt:f.dataset.createdAt,dataOrigin:'simulated',analysisType:'operations'},action:f.task.action,ownerId:f.actor.userId,ownerName:'运营',createdBy:f.actor.userId,priority:f.task.priority,dueDate:f.task.dueDate,reviewMethod:f.task.reviewMethod,segmentSnapshotId:null,recordType:'demonstration',state:'executing',version:2,createdAt:f.dataset.createdAt,updatedAt:f.dataset.createdAt,feedback:[],...changes};}
beforeEach(()=>vi.restoreAllMocks());
describe('Agent页面确认计划',()=>{
 it('确认提交完成后再保存任务对象记忆，重复确认亦可补偿记忆且不重执行业务',async()=>{
  const f=fixture(),plan=await f.prepare(),rememberResults=vi.fn(async()=>{expect(f.writes).toEqual(['publish','segment','decision']);expect(f.store.run.steps.at(-1)?.actionPlan?.status).toBe('completed');});Object.assign(f.store,{rememberResults});
  expect((await f.confirm(plan)).status).toBe('completed');expect((await f.confirm(plan)).status).toBe('completed');expect(rememberResults).toHaveBeenCalledTimes(2);expect(rememberResults).toHaveBeenLastCalledWith(f.actor,f.run.id,plan.id);expect(f.writes).toEqual(['publish','segment','decision']);
 });
 it('记忆失败不会倒写正式确认失败；部分执行仍尝试保存已完成对象',async()=>{
  const f=fixture(),plan=await f.prepare(),rememberResults=vi.fn(async()=>{throw new Error('memory unavailable');});Object.assign(f.store,{rememberResults});expect((await f.confirm(plan)).status).toBe('completed');expect(f.writes).toEqual(['publish','segment','decision']);
  const partial=fixture(),p=await partial.prepare(),remember=vi.fn(async()=>{});Object.assign(partial.store,{rememberResults:remember});vi.mocked(partial.ports.decisions.create).mockRejectedValueOnce(new Error('temporary failure'));expect((await partial.confirm(p)).status).toBe('partially_failed');expect(remember).toHaveBeenCalledWith(partial.actor,partial.run.id,p.id);
 });
 it('准备只生成计划，冻结实际规则、覆盖与未知人数，不执行正式写入',async()=>{
  const f=fixture(),plan=await f.prepare();expect(f.writes).toEqual([]);expect(plan.steps.map(s=>s.kind)).toEqual(['publish_tag','save_segment','create_decision_task']);expect(plan.preview).toMatchObject({version:2,memberCount:7,unknownCount:2});expect(plan.sourceFingerprint).toBe(f.proposal.preview!.sourceFingerprint);expect(plan.scope).toEqual(f.scope);
 });
 it('页面一次确认顺序完成，重复确认返回相同对象且不重复写',async()=>{
  const f=fixture(),plan=await f.prepare(),done=await f.confirm(plan);expect(done.status).toBe('completed');expect(f.writes).toEqual(['publish','segment','decision']);expect(done.steps.every(s=>s.status==='completed')).toBe(true);
  const again=await f.confirm(plan);expect(again.steps.map(s=>s.result?.id)).toEqual(done.steps.map(s=>s.result?.id));expect(f.writes).toEqual(['publish','segment','decision']);const memberUrl=new URL(done.steps[1].result!.url,'http://unit.invalid');expect(memberUrl.pathname).toBe('/dashboard/data/portrait');expect(memberUrl.searchParams.get('datasetId')).toBe(f.dataset.id);expect(memberUrl.searchParams.get('snapshotId')).toBe(f.segmentId);expect(JSON.parse(memberUrl.searchParams.get('scope')!)).toMatchObject({startDate:f.scope.startDate,endDate:f.scope.endDate,campusIds:f.scope.campusIds,courseIds:f.scope.courseIds,channelIds:f.scope.channelIds});
 });
 it('已发布标签可复用，不受旧预览TTL阻止保存人群，也不重新发布',async()=>{
  const f=fixture();f.proposal.status='published';f.proposal.publishedTagId=randomUUID();f.proposal.preview!.expiresAt=new Date(Date.now()-1).toISOString();
  const plan=await f.prepare(false);expect(plan.steps[0]).toMatchObject({status:'completed',result:{id:f.proposal.publishedTagId,reused:true}});
  const edited=await f.service.edit({runId:f.run.id,planId:plan.id,version:1,segmentName:'继续保存的人群'},f.actor),done=await f.confirm(edited);expect(done.status).toBe('completed');expect(f.writes).toEqual(['segment']);expect(f.ports.tags.confirm).not.toHaveBeenCalled();expect(vi.mocked(f.ports.segments.create).mock.calls[0][2].name).toBe('继续保存的人群');
 });
 it('任务责任人无效时在发布标签之前拒绝整张计划',async()=>{
  const f=fixture(),plan=await f.prepare();vi.mocked(f.ports.decisions.owners).mockResolvedValue([]);const result=await f.confirm(plan);expect(result.status).toBe('invalid');expect(result.errorCode).toBe('OWNER_INVALID');expect(f.writes).toEqual([]);
 });
 it('默认负责人在准备时冻结，管理员确认其他账号的计划不会改成管理员本人',async()=>{
  for(const legacy of [false,true]){const f=fixture(),plan=await f.prepare(),admin={...f.actor,userId:randomUUID(),role:'admin'};expect(plan.steps[2].input).toMatchObject({task:{ownerId:f.actor.userId},ownerName:'运营'});if(legacy){const saved=f.store.run.steps.at(-1)!.actionPlan!.steps[2].input;if(saved.kind==='create_decision_task')delete saved.task.ownerId;}const done=await f.service.confirm({runId:f.run.id,planId:plan.id,version:1,requestKey:randomUUID()},admin);expect(done.status).toBe('completed');expect(vi.mocked(f.ports.decisions.create).mock.calls[0][1].ownerId).toBe(f.actor.userId);}
 });
 it('部分执行失败保留已完成标签；恢复跳过已完成步骤并使用固定任务幂等键',async()=>{
  const f=fixture(),plan=await f.prepare();vi.mocked(f.ports.decisions.create).mockRejectedValueOnce(new Error('connection failed'));
  const partial=await f.confirm(plan);expect(partial.status).toBe('partially_failed');expect(partial.steps.map(s=>s.status)).toEqual(['completed','completed','failed']);expect(f.writes).toEqual(['publish','segment']);
  const done=await f.confirm(partial);expect(done.status).toBe('completed');expect(f.writes).toEqual(['publish','segment','decision']);const calls=vi.mocked(f.ports.decisions.create).mock.calls;expect(calls[0][1].requestKey).toBe(calls[1][1].requestKey);expect(calls[1][1].segmentSnapshotId).toBe(done.steps[1].result?.id);
 });
 it('不接受其他公司的分析或其他账号的计划',async()=>{
  const f=fixture(),plan=await f.prepare();await expect(f.service.confirm({runId:f.run.id,planId:plan.id,version:1,requestKey:randomUUID()},{...f.actor,organizationId:randomUUID()})).rejects.toMatchObject({code:'NOT_FOUND'});
  await expect(f.service.confirm({runId:f.run.id,planId:plan.id,version:1,requestKey:randomUUID()},{...f.actor,userId:randomUUID()})).rejects.toMatchObject({code:'PLAN_READ_ONLY'});expect(f.writes).toEqual([]);
 });
 it('只读用户没有准备与确认权限',async()=>{
  const f=fixture(),plan=await f.prepare(),viewer={...f.actor,role:'viewer'};await expect(f.service.prepareFollowup({proposalId:f.proposal.id,version:2},f.scope,{...f.context,actor:viewer})).rejects.toMatchObject({code:'FORBIDDEN_TOOL'});await expect(f.service.confirm({runId:f.run.id,planId:plan.id,version:1,requestKey:randomUUID()},viewer)).rejects.toMatchObject({code:'FORBIDDEN_TOOL'});expect(f.writes).toEqual([]);
 });
 it('规则版本、凭证和批次改变均阻止任何正式操作',async()=>{
  for(const change of ['version','token','batch'] as const){const f=fixture(),plan=await f.prepare();if(change==='version')f.proposal.version++;else if(change==='token')f.proposal.preview!.token=randomUUID();else f.batches[0].acceptedRows++;const result=await f.confirm(plan);expect(result.status).toBe('invalid');expect(f.writes).toEqual([]);}
 });
 it('预览或计划过期不可发布，未知不补成零',async()=>{
  const f=fixture(),plan=await f.prepare();f.proposal.preview!.expiresAt=new Date(Date.now()-1).toISOString();const invalid=await f.confirm(plan);expect(invalid.errorCode).toBe('PREVIEW_EXPIRED');expect(f.writes).toEqual([]);
  const second=fixture(),p=await second.prepare();second.store.run.steps.at(-1)!.actionPlan!.expiresAt=new Date(Date.now()-1).toISOString();expect((await second.confirm(p)).errorCode).toBe('PLAN_EXPIRED');expect(second.writes).toEqual([]);
 });
 it('编辑递增版本，旧确认卡失效；不允许修改已执行的计划',async()=>{
  const f=fixture(),plan=await f.prepare(),edited=await f.service.edit({runId:f.run.id,planId:plan.id,version:1,segmentName:'新名单'},f.actor);expect(edited.version).toBe(2);expect(edited.steps[1].input).toMatchObject({name:'新名单'});await expect(f.confirm(plan)).rejects.toMatchObject({code:'PLAN_VERSION_CHANGED'});
  await f.confirm(edited);await expect(f.service.edit({runId:f.run.id,planId:plan.id,version:2,segmentName:'事后改名'},f.actor)).rejects.toMatchObject({code:'PLAN_STARTED'});
 });
 it('每一步重查权限，发布后被降权不会继续创建人群',async()=>{
  const f=fixture(),plan=await f.prepare();let count=0;vi.mocked(f.ports.authorize!).mockImplementation(async()=>{if(++count===3)throw new AgentError('IDENTITY_CHANGED','权限变化',403);});
  const result=await f.confirm(plan);expect(result.status).toBe('invalid');expect(result.steps[0].status).toBe('completed');expect(f.writes).toEqual(['publish']);
 });
 it('并发确认持久化执行租约，第二次请求不会重复发布',async()=>{
  const f=fixture(),plan=await f.prepare();let release!:()=>void,start!:()=>void;const entered=new Promise<void>(r=>{start=r;}),wait=new Promise<void>(r=>{release=r;});const original=vi.mocked(f.ports.tags.confirm).getMockImplementation()!;vi.mocked(f.ports.tags.confirm).mockImplementation(async(...args)=>{start();await wait;return original(...args);});
  const first=f.confirm(plan);await entered;await expect(f.confirm(plan)).rejects.toMatchObject({code:'PLAN_BUSY'});release();expect((await first).status).toBe('completed');expect(f.writes).toEqual(['publish','segment','decision']);
 });
 it('任务建议来源必须与冻结范围一致，不能借同公司其他范围越界',async()=>{
  const f=fixture(),plan=await f.prepare();vi.mocked(f.ports.decisions.source).mockResolvedValue({datasetId:f.dataset.id,scope:{...f.scope,courseIds:['another-course']}});const result=await f.confirm(plan);expect(result.errorCode).toBe('SOURCE_CHANGED');expect(f.writes).toEqual([]);
 });
 it('报告准备不调用模型；确认才生成，并使用稳定幂等请求',async()=>{
  const f=fixture(),plan=await f.service.prepareReport({kind:'monthly',anchorDate:'2026-08-15'},f.scope,f.context);f.store.add(plan);expect(f.writes).toEqual([]);const result=await f.confirm(plan);expect(result.status).toBe('completed');expect(f.writes).toEqual(['report']);expect(vi.mocked(f.ports.reports.generate).mock.calls[0][1]).toMatchObject({datasetId:f.dataset.id,kind:'monthly',campusIds:f.scope.campusIds,channelIds:f.scope.channelIds,requestKey:stableActionKey(plan.id,plan.steps[0].id)});
 });
 it('生成报告失败仍提供原报告入口，不冒充成功',async()=>{
  const f=fixture(),plan=await f.service.prepareReport({kind:'monthly',anchorDate:'2026-08-01'},f.scope,f.context);f.store.add(plan);vi.mocked(f.ports.reports.generate).mockResolvedValue({id:randomUUID(),status:'failed',errorMessage:'模型不可用'});const result=await f.confirm(plan);expect(result.status).toBe('partially_failed');expect(result.steps[0].status).toBe('failed');expect(result.steps[0].result?.url).toContain('/dashboard/reports/');expect(result.errorCode).toBe('REPORT_FAILED');
 });
 it('同建议安排一致时只复用已有任务，卡片和结果明确复用且不重置执行状态',async()=>{
  const f=fixture(),existing=savedTask(f);f.ports.decisions.existing=vi.fn(async()=>existing);
  const plan=await f.service.prepareDecision({task:f.task},f.scope,f.context);f.store.add(plan);expect(plan.steps[0]).toMatchObject({status:'completed',title:'使用已有任务（保留当前状态）',result:{id:existing.id,reused:true}});
  const done=await f.confirm(plan);expect(done.status).toBe('completed');expect(done.steps[0].result?.reused).toBe(true);expect(f.ports.decisions.create).not.toHaveBeenCalled();expect(existing.state).toBe('executing');expect(f.writes).toEqual([]);
 });
 it('确认前出现不同期限的已有任务，发布前拒绝并保留已有任务入口',async()=>{
  const f=fixture(),plan=await f.prepare();f.ports.decisions.existing=vi.fn(async()=>savedTask(f,{dueDate:'2026-11-05'}));
  const result=await f.confirm(plan);expect(result.status).toBe('invalid');expect(result.errorCode).toBe('DECISION_SOURCE_CONFLICT');expect(result.steps[2].result).toMatchObject({id:f.decisionId,reused:true});expect(result.steps[2].result?.url).toContain('taskId='+f.decisionId);expect(f.writes).toEqual([]);
 });
 it('准备时已有不同人群或责任安排，不能将旧任务当成新安排',async()=>{
  for(const changes of [{ownerId:randomUUID()},{segmentSnapshotId:randomUUID()}]){const f=fixture();f.ports.decisions.existing=vi.fn(async()=>savedTask(f,changes));await expect(f.service.prepareDecision({task:f.task},f.scope,f.context)).rejects.toMatchObject({code:'DECISION_SOURCE_CONFLICT'});expect(f.writes).toEqual([]);}
 });
 it('正式创建发生并发来源冲突仍保留已有任务入口，已完成标签人群不重复写',async()=>{
  const f=fixture(),plan=await f.prepare();let conflict=false;f.ports.decisions.existing=vi.fn(async()=>conflict?savedTask(f,{segmentSnapshotId:f.segmentId,dueDate:'2026-11-05'}):null);vi.mocked(f.ports.decisions.create).mockImplementation(async()=>{conflict=true;throw new WorkflowError('已有不同安排',409,'DECISION_SOURCE_CONFLICT');});
  const result=await f.confirm(plan);expect(result.status).toBe('invalid');expect(result.errorCode).toBe('DECISION_SOURCE_CONFLICT');expect(result.steps[2].result?.id).toBe(f.decisionId);expect(result.steps.slice(0,2).every(s=>s.status==='completed')).toBe(true);expect(f.writes).toEqual(['publish','segment']);expect(f.ports.decisions.create).toHaveBeenCalledTimes(1);
 });
 it('同标签已有名单时返回其真实名称，并明确复用而不宣称另存名称',async()=>{
  const f=fixture(),plan=await f.prepare(false);f.ports.segments.find=vi.fn(async()=>({id:f.segmentId,name:'原有名单'}));vi.mocked(f.ports.segments.create).mockResolvedValue({id:f.segmentId,name:'原有名单'});
  const result=await f.confirm(plan);expect(result.status).toBe('completed');expect(result.steps[1].result).toMatchObject({id:f.segmentId,label:'查看人群“原有名单”',reused:true});expect(result.steps[1].result?.label).not.toContain('出勤跟进人群');expect(f.ports.segments.create).not.toHaveBeenCalled();
 });
 it('已发布标签已有保存人群时卡片直接展示实际名称与入口，不准备另存',async()=>{
  const f=fixture();f.proposal.status='published';f.proposal.publishedTagId=f.tagId;f.ports.segments.find=vi.fn(async()=>({id:f.segmentId,name:'原保存名单'}));const plan=await f.prepare(false);expect(plan.steps[1]).toMatchObject({status:'completed',input:{name:'原保存名单'},title:'使用已保存人群“原保存名单”',result:{id:f.segmentId,reused:true}});expect((await f.confirm(plan)).status).toBe('completed');expect(f.writes).toEqual([]);
 });
 it('失败报告不能恢复原计划；明确准备新计划才使用新的请求键，旧记录保留',async()=>{
  const f=fixture(),plan=await f.service.prepareReport({kind:'monthly',anchorDate:'2026-08-01'},f.scope,f.context),failedId=randomUUID();f.store.add(plan);vi.mocked(f.ports.reports.generate).mockResolvedValueOnce({id:failedId,status:'failed',errorMessage:'模型不可用'});
  const failed=await f.confirm(plan);await expect(f.confirm(failed)).rejects.toMatchObject({code:'REPORT_REPREPARE_REQUIRED'});expect(f.ports.reports.generate).toHaveBeenCalledTimes(1);expect(failed.steps[0].result?.id).toBe(failedId);
  const next=await f.service.prepareReport({kind:'monthly',anchorDate:'2026-08-01'},f.scope,f.context);f.store.add(next);expect((await f.confirm(next)).status).toBe('completed');expect(vi.mocked(f.ports.reports.generate).mock.calls[1][1].requestKey).not.toBe(vi.mocked(f.ports.reports.generate).mock.calls[0][1].requestKey);expect(f.store.run.steps.find(s=>s.actionPlan?.id===plan.id)?.actionPlan?.steps[0].result?.id).toBe(failedId);
 });
 it('学习不能代办经营操作，财务只能准备决策任务',async()=>{
  const f=fixture(),learning={organizationId:f.actor.organizationId,courseKeys:[]},finance={organizationId:f.actor.organizationId,years:[2024]};await expect(f.service.prepareDecision({task:f.task},learning,f.context)).rejects.toMatchObject({code:'MODE_UNSUPPORTED'});await expect(f.service.prepareFollowup({proposalId:f.proposal.id,version:2},finance,f.context)).rejects.toMatchObject({code:'MODE_UNSUPPORTED'});await expect(f.service.prepareReport({kind:'monthly',anchorDate:'2026-08-01'},finance,f.context)).rejects.toMatchObject({code:'MODE_UNSUPPORTED'});
 });
 it('严格确认与编辑参数拒绝公司、SQL、外部动作和任意字段',()=>{
  const common={runId:randomUUID(),planId:randomUUID(),version:1};expect(confirmActionPlanSchema.safeParse({...common,requestKey:randomUUID(),organizationId:randomUUID()}).success).toBe(false);expect(editActionPlanSchema.safeParse({...common,sql:'DELETE FROM local_user'}).success).toBe(false);expect(stableActionKey(common.planId,'step')).toBe(stableActionKey(common.planId,'step'));expect(stableActionKey(common.planId,'other')).not.toBe(stableActionKey(common.planId,'step'));
 });
});
