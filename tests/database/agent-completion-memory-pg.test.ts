import {afterAll,beforeAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {execute,queryOne} from '@/platform/database';
import type {AgentActor,AgentStepVO,AgentTurnContext} from '@/modules/agent/contracts';
import type {ActionPlanVO} from '@/modules/agent/contracts/actions';
import {DatabaseActionPlanStore} from '@/modules/agent/services/action-store';
import {DatabaseAgentRepository} from '@/modules/agent/repositories/repository';
import {emptyTaskState} from '@/modules/agent/domain/task-state';

const org=randomUUID(),user=randomUUID(),datasetId=randomUUID(),foreign=randomUUID();
const actor:AgentActor={organizationId:org,userId:user,role:'operator'},store=new DatabaseActionPlanStore(),repository=new DatabaseAgentRepository();
const context:AgentTurnContext={datasetId,scope:{organizationId:org,authorizedCampusIds:[],startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[]}};
let verified=false;
function testOnly(){const url=new URL(process.env.DATABASE_URL??'');if(url.hostname!=='127.0.0.1'||url.port!=='25432'||url.pathname!=='/education_cleanup_test')throw Error('确认记忆测试仅允许25432 education_cleanup_test专用库');}
beforeAll(async()=>{testOnly();expect((await queryOne<{name:string}>('SELECT current_database() name'))?.name).toBe('education_cleanup_test');verified=true;});
afterAll(async()=>{if(!verified)return;testOnly();await execute('DELETE FROM agent_message WHERE "organizationId"=$1',[org]);await execute('DELETE FROM agent_execution WHERE "organizationId"=$1',[org]);await execute('DELETE FROM agent_session WHERE "organizationId"=$1',[org]);});
async function fixture(partial=false){
 const sessionId=randomUUID(),runId=randomUUID(),now=new Date().toISOString(),segmentId=randomUUID(),taskId=randomUUID(),reportId=randomUUID();
 const snapshot={...emptyTaskState(context,now,2),goal:'核对已确认对象',userConditions:['仅使用模拟范围']},state={...snapshot,revision:3};
 await execute('INSERT INTO agent_session(id,"organizationId","createdBy",title,"datasetId",scope,"taskState") VALUES($1,$2,$3,\'确认记忆专用测试\',$4,$5::jsonb,$6::jsonb)',[sessionId,org,user,datasetId,JSON.stringify(context.scope),JSON.stringify(state)]);
 const plan:ActionPlanVO={id:randomUUID(),version:1,runId,datasetId,scope:context.scope,status:partial?'partially_failed':'completed',steps:[
  {id:randomUUID(),kind:'save_segment',title:'保存测试人群',input:{kind:'save_segment',publishStepId:randomUUID(),name:'测试人群'},status:'completed',result:{id:segmentId,label:'查看测试人群',url:'/dashboard/data/portrait'}},
  {id:randomUUID(),kind:'create_decision_task',title:'测试跟进',input:{kind:'create_decision_task',sourceRunId:runId,task:{action:'核对来源',priority:'normal',dueDate:'2026-10-31',reviewMethod:'检查对应依据',recommendationIndex:0}},status:partial?'failed':'completed',result:{id:taskId,label:'查看测试任务',url:'/dashboard/decisions'}},
  {id:randomUUID(),kind:'generate_report',title:'测试月报',input:{kind:'generate_report',kindOfReport:'monthly',anchorDate:'2026-08-01'},status:partial?'pending':'completed',result:{id:reportId,label:'查看测试报告',url:'/dashboard/reports'}},
 ],evidence:[],sourceFingerprint:'test-only',createdAt:now,updatedAt:now};
 const steps:AgentStepVO[]=[{id:'context',tool:'resolve_context',status:'completed',context,evidence:[],runtime:{engineVersion:'business-agent-v3',model:'fixture',promptVersion:'fixture',recordedAt:now,taskMemory:snapshot}},{id:'plan',tool:'prepare_action_plan',status:'completed',context,evidence:[],actionPlan:plan}];
 await execute('INSERT INTO agent_execution(id,"organizationId","createdBy","sessionId","requestKey","requestHash",status,message,steps,proposals,evidence,"deadlineAt","completedAt") VALUES($1,$2,$3,$4,$5,\'fixture\',\'awaiting_confirmation\',\'确认后的对象引用\',$6::jsonb,\'[]\'::jsonb,\'[]\'::jsonb,NOW(),NOW())',[runId,org,user,sessionId,randomUUID(),JSON.stringify(steps)]);
 const persist=()=>execute('UPDATE agent_execution SET steps=$3::jsonb WHERE id=$1 AND "organizationId"=$2',[runId,org,JSON.stringify(steps)]);
 return {sessionId,runId,plan,segmentId,taskId,reportId,persist};
}
describe('正式确认对象记忆的专用PostgreSQL验证',()=>{
 it('并发重复合并只增一次revision，超过八条新历史仍可从会话取回对象引用',async()=>{
  const f=await fixture();await Promise.all([store.rememberResults(actor,f.runId,f.plan.id),store.rememberResults(actor,f.runId,f.plan.id)]);
  const state=await repository.getTaskState(actor,f.sessionId);expect(state.revision).toBe(4);expect(state.selectedObjects.map(item=>item.id)).toEqual([f.segmentId,f.taskId,f.reportId]);expect(state.completionReceipt).toEqual({runId:f.runId,planId:f.plan.id,revision:4});
  for(let i=0;i<9;i++)await execute('INSERT INTO agent_execution(id,"organizationId","createdBy","sessionId","requestKey","requestHash",status,message,"startedAt","deadlineAt","completedAt") VALUES($1,$2,$3,$4,$5,\'history-fixture\',\'completed\',\'后续纯交流\',NOW()+($6::int*INTERVAL \'1 second\'),NOW(),NOW())',[randomUUID(),org,user,f.sessionId,randomUUID(),i+1]);
  const detail=await repository.getSession(actor,f.sessionId);expect(detail.runs.slice(-8).some(run=>run.id===f.runId)).toBe(false);expect(detail.session.taskState?.selectedObjects.map(item=>item.id)).toEqual([f.segmentId,f.taskId,f.reportId]);
 });
 it('部分成功只记已完成对象，同计划恢复可追加；新的用户任务阻止旧计划继续补入',async()=>{
  const f=await fixture(true);await store.rememberResults(actor,f.runId,f.plan.id);let state=await repository.getTaskState(actor,f.sessionId);expect(state.revision).toBe(4);expect(state.selectedObjects.map(item=>item.id)).toEqual([f.segmentId]);
  f.plan.steps[1].status='completed';await f.persist();await store.rememberResults(actor,f.runId,f.plan.id);state=await repository.getTaskState(actor,f.sessionId);expect(state.revision).toBe(5);expect(state.selectedObjects.map(item=>item.id)).toEqual([f.segmentId,f.taskId]);
  const newer=await repository.updateTaskState(actor,f.sessionId,{action:'update',expectedRevision:5,goal:'新的任务目标'});f.plan.steps[2].status='completed';f.plan.status='completed';await f.persist();await store.rememberResults(actor,f.runId,f.plan.id);expect(await repository.getTaskState(actor,f.sessionId)).toEqual(newer);
 });
 it('正在分析、他人账号与外机构不写引用，保留正式计划结果',async()=>{
  const f=await fixture(),before=await repository.getTaskState(actor,f.sessionId);
  const running=randomUUID();await execute('INSERT INTO agent_execution(id,"organizationId","createdBy","sessionId","requestKey","requestHash",status,message,"deadlineAt") VALUES($1,$2,$3,$4,$5,\'running-fixture\',\'running\',\'正在进行的分析\',NOW()+INTERVAL \'1 minute\')',[running,org,user,f.sessionId,randomUUID()]);
  await store.rememberResults(actor,f.runId,f.plan.id);await execute('UPDATE agent_execution SET status=\'completed\',"completedAt"=NOW() WHERE id=$1 AND "organizationId"=$2',[running,org]);
  await store.rememberResults({...actor,userId:randomUUID()},f.runId,f.plan.id);await store.rememberResults({...actor,organizationId:foreign},f.runId,f.plan.id);expect(await repository.getTaskState(actor,f.sessionId)).toEqual(before);
  const saved=await repository.getRun(actor,f.runId);expect(saved.run.actionPlan?.steps.every(step=>step.status==='completed')).toBe(true);
 });
});
