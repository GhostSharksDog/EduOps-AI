import {beforeEach,describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {AgentActor,AgentStepVO,AgentTurnContext} from '@/modules/agent/contracts';
import type {ActionPlanVO} from '@/modules/agent/contracts/actions';
import {emptyTaskState} from '@/modules/agent/domain/task-state';
const db=vi.hoisted(()=>({queryOne:vi.fn(),execute:vi.fn(),transaction:vi.fn(async fn=>fn({query:vi.fn()}))}));
vi.mock('@/platform/database',()=>db);
import {DatabaseActionPlanStore} from '@/modules/agent/services/action-store';
const clone=<T>(value:T):T=>structuredClone(value);
function fixture(){
 const actor:AgentActor={organizationId:randomUUID(),userId:randomUUID(),role:'operator'},datasetId=randomUUID(),sessionId=randomUUID(),runId=randomUUID(),proposalId=randomUUID();
 const context:AgentTurnContext={datasetId,scope:{organizationId:actor.organizationId,authorizedCampusIds:[],startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[]}};
 const before={...emptyTaskState(context,undefined,2),goal:'建立出勤跟进人群',userConditions:['保留未知签到'],selectedObjects:[{kind:'tag' as const,id:proposalId,version:1,name:'出勤跟进'}]};
 const state={...clone(before),revision:3};
 const now=new Date().toISOString(),publishedId=randomUUID(),segmentId=randomUUID(),taskId=randomUUID(),reportId=randomUUID();
 const plan:ActionPlanVO={id:randomUUID(),version:1,runId,datasetId,scope:context.scope,status:'completed',steps:[
  {id:randomUUID(),kind:'publish_tag',title:'发布标签',input:{kind:'publish_tag',proposalId,version:1,previewToken:randomUUID(),previewFingerprint:'preview',sourceFingerprint:'batch'},status:'completed',result:{id:publishedId,label:'查看标签',url:'/dashboard/tags/risk'}},
  {id:randomUUID(),kind:'save_segment',title:'保存人群',input:{kind:'save_segment',publishStepId:'fixture',name:'跟进人群'},status:'completed',result:{id:segmentId,label:'查看人群',url:'/dashboard/data/portrait'}},
  {id:randomUUID(),kind:'create_decision_task',title:'安排跟进',input:{kind:'create_decision_task',sourceRunId:runId,task:{action:'核对签到',priority:'normal',dueDate:'2026-10-31',reviewMethod:'复核签到完整性',recommendationIndex:0}},status:'completed',result:{id:taskId,label:'查看任务',url:'/dashboard/decisions'}},
  {id:randomUUID(),kind:'generate_report',title:'月报',input:{kind:'generate_report',kindOfReport:'monthly',anchorDate:'2026-08-01'},status:'completed',result:{id:reportId,label:'查看报告',url:'/dashboard/reports'}},
 ],evidence:[],sourceFingerprint:'batch',createdAt:now,updatedAt:now};
 const steps:AgentStepVO[]=[{id:'context',tool:'resolve_context',status:'completed',context,evidence:[],runtime:{engineVersion:'business-agent-v3',model:'fixture',promptVersion:'fixture',recordedAt:now,taskMemory:before}},{id:'plan',tool:'prepare_action_plan',status:'completed',context,evidence:[],actionPlan:plan}];
 const row={id:runId,sessionId,createdBy:actor.userId,status:'completed',datasetId,scope:context.scope,answer:null,evidence:[],proposals:[{id:proposalId,name:'出勤跟进'}],steps};
 const session={id:sessionId,createdBy:actor.userId,datasetId,scope:context.scope,taskState:state,updatedAt:new Date()};
 let running=false;
 db.queryOne.mockImplementation(async(sql:string)=>sql.includes('FROM agent_session')?clone(session):sql.includes("status='running'")?running?{id:randomUUID()}:null:clone(row));
 db.execute.mockImplementation(async(sql:string,parameters:unknown[])=>{if(sql.startsWith('UPDATE agent_session'))session.taskState=JSON.parse(parameters[2] as string);return 1;});
 return {actor,row,session,plan,context,runId,proposalId,publishedId,segmentId,taskId,reportId,store:new DatabaseActionPlanStore(),setRunning:(value:boolean)=>{running=value;}};
}
beforeEach(()=>{vi.clearAllMocks();});
describe('正式确认结果的独立任务记忆事务',()=>{
 it('模型结束revision加一后追加真实人群任务报告，仅保存引用而非成员或数字',async()=>{
  const f=fixture();await f.store.rememberResults(f.actor,f.runId,f.plan.id);
  expect(f.session.taskState.revision).toBe(4);expect(f.session.taskState.selectedObjects.map(item=>item.id)).toEqual([f.proposalId,f.segmentId,f.taskId,f.reportId]);
  expect(f.session.taskState.selectedObjects.some(item=>item.id===f.publishedId)).toBe(false);
  expect(f.session.taskState).toMatchObject({goal:'建立出勤跟进人群',userConditions:['保留未知签到'],completionReceipt:{runId:f.runId,planId:f.plan.id,revision:4}});
  for(const item of f.session.taskState.selectedObjects)expect(Object.keys(item).every(key=>['id','kind','name','version'].includes(key))).toBe(true);
  const statements=db.queryOne.mock.calls.map(call=>call[0]);expect(statements.filter(sql=>sql.includes('FOR UPDATE'))).toEqual([expect.stringContaining('FROM agent_session')]);
  expect(db.execute.mock.calls.some(call=>call[0].startsWith('UPDATE agent_execution'))).toBe(false);
 });
 it('重复调用不增加版本；部分成功后同plan凭回执继续补上后续成功对象',async()=>{
  const f=fixture();f.plan.status='partially_failed';f.plan.steps[2].status='failed';f.plan.steps[3].status='pending';
  await f.store.rememberResults(f.actor,f.runId,f.plan.id);expect(f.session.taskState.revision).toBe(4);expect(f.session.taskState.selectedObjects.map(item=>item.id)).toEqual([f.proposalId,f.segmentId]);
  await f.store.rememberResults(f.actor,f.runId,f.plan.id);expect(f.session.taskState.revision).toBe(4);
  f.plan.status='completed';f.plan.steps[2].status='completed';f.plan.steps[3].status='completed';
  await f.store.rememberResults(f.actor,f.runId,f.plan.id);expect(f.session.taskState.revision).toBe(5);expect(f.session.taskState.selectedObjects.map(item=>item.id)).toEqual([f.proposalId,f.segmentId,f.taskId,f.reportId]);
 });
 it('用户新目标、同文案新revision、范围变化或分析进行中均不合并旧任务对象',async()=>{
  for(const change of ['goal','revision','scope','running','review']){
   const f=fixture();if(change==='goal')f.session.taskState.goal='新的招生分析';if(change==='revision')f.session.taskState.revision++;if(change==='scope')f.session.scope={...f.session.scope,startDate:'2026-09-01'} as typeof f.session.scope;if(change==='running')f.setRunning(true);if(change==='review')Object.assign(f.session.taskState,{needsReview:true});
   const before=clone(f.session.taskState);await f.store.rememberResults(f.actor,f.runId,f.plan.id);expect(f.session.taskState).toEqual(before);
  }
 });
 it('已有回执被后续人工编辑revision打断后不能继续向新任务补旧结果',async()=>{
  const f=fixture();f.plan.status='partially_failed';f.plan.steps[2].status='failed';f.plan.steps[3].status='pending';await f.store.rememberResults(f.actor,f.runId,f.plan.id);
  f.session.taskState.revision++;f.plan.steps[2].status='completed';const before=clone(f.session.taskState);
  await f.store.rememberResults(f.actor,f.runId,f.plan.id);expect(f.session.taskState).toEqual(before);
 });
 it('只读、他人会话及缺少历史任务快照时不修改记忆',async()=>{
  const f=fixture(),before=clone(f.session.taskState);await f.store.rememberResults({...f.actor,role:'viewer'},f.runId,f.plan.id);expect(db.transaction).not.toHaveBeenCalled();await f.store.rememberResults({...f.actor,userId:randomUUID()},f.runId,f.plan.id);expect(f.session.taskState).toEqual(before);
  delete f.row.steps[0].runtime!.taskMemory;await f.store.rememberResults(f.actor,f.runId,f.plan.id);expect(f.session.taskState).toEqual(before);
 });
 it('记忆存储读取失败安全返回，不触碰已经提交的正式结果',async()=>{
  const f=fixture(),before=clone(f.row);db.queryOne.mockRejectedValueOnce(new Error('test read failed'));
  await expect(f.store.rememberResults(f.actor,f.runId,f.plan.id)).resolves.toBeUndefined();expect(f.row).toEqual(before);
 });
});
