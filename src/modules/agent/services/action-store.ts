import 'server-only';
import {execute,queryOne,transaction} from '@/platform/database';
import type {AgentActor,AgentAnswerVO,AgentRunVO,AgentStepVO} from '../contracts';
import type {AuthorizedAnalysisScope,EvidenceReference} from '@/shared/contracts/analysis';
import type {ActionPlanVO} from '../contracts/actions';
import {AgentError} from '../domain/errors';
import {readTaskState,taskScopeKey} from '../domain/task-state';
import {taskStateSchema} from '../contracts/task-state';

export interface ActionRunSource {
 id:string;sessionId:string;createdBy:string;status:AgentRunVO['status'];
 context:{datasetId:string;scope:AuthorizedAnalysisScope};answer:AgentAnswerVO|null;evidence:EvidenceReference[];
 proposals:AgentRunVO['proposals'];steps:AgentStepVO[];
}
export interface ActionPlanStore {
 get(actor:AgentActor,runId:string):Promise<ActionRunSource>;
 append?(actor:AgentActor,runId:string,plan:ActionPlanVO):Promise<ActionPlanVO>;
 mutate(actor:AgentActor,runId:string,planId:string,change:(plan:ActionPlanVO,run:ActionRunSource)=>void):Promise<ActionPlanVO>;
 rememberResults?(actor:AgentActor,runId:string,planId:string):Promise<void>;
}
type StoredRow={id:string;sessionId:string;createdBy:string;status:AgentRunVO['status'];datasetId:string;scope:AuthorizedAnalysisScope;answer:AgentAnswerVO|null;evidence:EvidenceReference[];steps:AgentStepVO[];proposals:AgentRunVO['proposals']};
const select=`SELECT e.id,e."sessionId",e."createdBy",e.status,e.answer,e.evidence,e.steps,e.proposals,s."datasetId",s.scope FROM agent_execution e JOIN agent_session s ON s.id=e."sessionId" AND s."organizationId"=e."organizationId" WHERE e.id=$1::uuid AND e."organizationId"=$2::uuid`;
function source(row:StoredRow):ActionRunSource {
 const contexts=row.steps.map(s=>(s as AgentStepVO&{context?:ActionRunSource['context']}).context).filter(Boolean);
 return {...row,context:contexts.at(-1)??{datasetId:row.datasetId,scope:row.scope}};
}
export function plansFromSteps(steps:AgentStepVO[]):ActionPlanVO[]{return steps.flatMap(s=>{const plan=(s as AgentStepVO&{actionPlan?:ActionPlanVO}).actionPlan;return plan?[plan]:[];});}
export class DatabaseActionPlanStore implements ActionPlanStore {
 /** Called after plan mutations commit. Never hold an execution row while waiting on a session. */
 async rememberResults(actor:AgentActor,runId:string,planId:string):Promise<void>{
  if(!['admin','operator'].includes(actor.role))return;
  try{
   const located=await queryOne<StoredRow>(select,[runId,actor.organizationId]);
   if(!located||actor.role!=='admin'&&located.createdBy!==actor.userId)return;
   await transaction(async client=>{
    await execute('SELECT pg_advisory_xact_lock(hashtext($1))',[located.sessionId],client);
    const session=await queryOne<{id:string;createdBy:string;datasetId:string;scope:AuthorizedAnalysisScope;taskState:unknown;updatedAt:Date}>('SELECT id,"createdBy","datasetId",scope,"taskState","updatedAt" FROM agent_session WHERE id=$1::uuid AND "organizationId"=$2::uuid FOR UPDATE',[located.sessionId,actor.organizationId],client);
    if(!session||actor.role!=='admin'&&session.createdBy!==actor.userId)return;
    if(await queryOne<{id:string}>(`SELECT id FROM agent_execution WHERE "sessionId"=$1::uuid AND "organizationId"=$2::uuid AND status='running' AND "deadlineAt">NOW() LIMIT 1`,[session.id,actor.organizationId],client))return;
    // Plain MVCC read: no execution lock is acquired in this session-only transaction.
    const row=await queryOne<StoredRow>(select,[runId,actor.organizationId],client);
    if(!row||row.sessionId!==session.id||actor.role!=='admin'&&row.createdBy!==actor.userId)return;
    const run=source(row),plan=plansFromSteps(run.steps).find(item=>item.id===planId);
    if(!plan||!['completed','partially_failed','invalid'].includes(plan.status)||plan.runId!==run.id||plan.datasetId!==run.context.datasetId||plan.scope.organizationId!==actor.organizationId)return;
    const snapshot=taskStateSchema.safeParse(run.steps.find(step=>step.id==='context')?.runtime?.taskMemory);
    if(!snapshot.success)return;
    const key=taskScopeKey({datasetId:plan.datasetId,scope:plan.scope}),state=readTaskState(session.taskState,{datasetId:session.datasetId,scope:session.scope},session.updatedAt.toISOString());
    if(taskScopeKey({datasetId:session.datasetId,scope:session.scope})!==key||taskScopeKey(run.context)!==key||state.datasetId!==plan.datasetId||state.scopeKey!==key||snapshot.data.datasetId!==plan.datasetId||snapshot.data.scopeKey!==key||state.needsReview||state.goal!==snapshot.data.goal||JSON.stringify(state.userConditions)!==JSON.stringify(snapshot.data.userConditions))return;
    const receipt=state.completionReceipt,compatible=receipt?.runId===run.id&&receipt.planId===plan.id&&receipt.revision===state.revision;
    if(!compatible&&state.revision!==snapshot.data.revision+1||state.revision>=1000000000)return;
    const selected=[...state.selectedObjects];
    for(const step of plan.steps){
     if(step.status!=='completed'||!step.result?.id)continue;
     const kind=step.kind==='publish_tag'?'tag':step.kind==='save_segment'?'segment':step.kind==='create_decision_task'?'task':step.kind==='generate_report'?'report':null;
     if(!kind)continue;
     const id=step.input.kind==='publish_tag'?step.input.proposalId:step.result.id;
     const item={kind,id,name:(step.input.kind==='publish_tag'?run.proposals.find(proposal=>proposal.id===id)?.name??plan.preview?.name??step.title:step.result.label||step.title).slice(0,200),...(step.input.kind==='publish_tag'?{version:step.input.version}:{})};
     const parsed=taskStateSchema.shape.selectedObjects.element.safeParse(item);if(!parsed.success)continue;
     const at=selected.findIndex(existing=>existing.kind===parsed.data.kind&&existing.id===parsed.data.id);if(at<0)selected.push(parsed.data);else selected[at]=parsed.data;
    }
    const selectedObjects=[...new Map(selected.map(item=>[item.kind+':'+item.id,item])).values()].slice(-8);
    if(JSON.stringify(selectedObjects)===JSON.stringify(state.selectedObjects))return;
    const revision=state.revision+1,next=taskStateSchema.parse({...state,selectedObjects,revision,updatedAt:new Date().toISOString(),completionReceipt:{runId:run.id,planId:plan.id,revision}});
    await execute('UPDATE agent_session SET "taskState"=$3::jsonb,"updatedAt"=NOW() WHERE id=$1::uuid AND "organizationId"=$2::uuid AND COALESCE("taskState"->>\'revision\',\'0\')=$4',[session.id,actor.organizationId,JSON.stringify(next),String(state.revision)],client);
   },{timeoutMs:5000});
  }catch{/* Formal results are already committed; memory failure cannot undo or fail them. */}
 }
 async get(actor:AgentActor,runId:string){
  const row=await queryOne<StoredRow>(select,[runId,actor.organizationId]);
  if(!row)throw new AgentError('NOT_FOUND','分析记录不存在或无权访问',404);return source(row);
 }
 async append(actor:AgentActor,runId:string,plan:ActionPlanVO){
  return transaction(async client=>{
   const row=await queryOne<StoredRow>(select+' FOR UPDATE OF e',[runId,actor.organizationId],client);
   if(!row)throw new AgentError('NOT_FOUND','分析记录不存在或无权访问',404);
   if(actor.role!=='admin'&&row.createdBy!==actor.userId)throw new AgentError('PLAN_READ_ONLY','只能准备自己会话的操作',403);
   if(!['admin','operator'].includes(actor.role))throw new AgentError('FORBIDDEN_TOOL','只读账号不能准备操作计划',403);
   if(row.status==='running')throw new AgentError('RUN_BUSY','分析尚未完成，请稍后操作',409);
   const run=source(row),existing=plansFromSteps(run.steps).find(p=>p.id===plan.id);if(existing)return existing;
   if(plansFromSteps(run.steps).some(p=>p.status==='executing'))throw new AgentError('PLAN_BUSY','当前计划仍在执行，请等待完成',409);
   if(plan.runId!==run.id||plan.datasetId!==run.context.datasetId||JSON.stringify(plan.scope)!==JSON.stringify(run.context.scope)||plan.scope.organizationId!==actor.organizationId)throw new AgentError('PLAN_CONTEXT_CHANGED','计划范围与原分析记录不一致',409);
   run.steps.push({id:plan.id,tool:'prepare_action_plan',status:'completed',evidence:plan.evidence,context:run.context,actionPlan:plan});
   await execute('UPDATE agent_execution SET steps=$3::jsonb,status=\'awaiting_confirmation\' WHERE id=$1::uuid AND "organizationId"=$2::uuid',[runId,actor.organizationId,JSON.stringify(run.steps)],client);return plan;
  });
 }
 async mutate(actor:AgentActor,runId:string,planId:string,change:(plan:ActionPlanVO,run:ActionRunSource)=>void){
  if(!['admin','operator'].includes(actor.role))throw new AgentError('FORBIDDEN_TOOL','只读账号不能变更操作计划',403);
  return transaction(async client=>{
   const row=await queryOne<StoredRow>(select+' FOR UPDATE OF e',[runId,actor.organizationId],client);
   if(!row)throw new AgentError('NOT_FOUND','分析记录不存在或无权访问',404);
   if(actor.role!=='admin'&&row.createdBy!==actor.userId)throw new AgentError('PLAN_READ_ONLY','只能操作自己会话中的计划',403);
   const run=source(row),plans=plansFromSteps(run.steps),plan=plans.find(p=>p.id===planId);
   if(!plan)throw new AgentError('PLAN_NOT_FOUND','操作计划不存在，请刷新分析记录',404);
   const latest=plans.at(-1);
   if(latest?.id!==plan.id&&plan.status!=='completed')throw new AgentError('PLAN_SUPERSEDED','已有更新的操作计划，请使用最新确认卡',409);
   if(run.status==='running')throw new AgentError('RUN_BUSY','分析仍在进行，请等待回答完成再确认',409);
   change(plan,run);plan.updatedAt=new Date().toISOString();
   for(const step of plan.steps){if(step.kind==='publish_tag'&&step.status==='completed'&&step.input.kind==='publish_tag'){
    const input=step.input,proposal=run.proposals.find(p=>p.id===input.proposalId);if(proposal){proposal.status='published';proposal.publishedTagId=step.result?.id??null;}
   }}
   const status=plan.status==='completed'&&run.proposals.every(p=>p.status==='published')?'completed':'awaiting_confirmation';
   await execute('UPDATE agent_execution SET steps=$3::jsonb,proposals=$4::jsonb,status=$5 WHERE id=$1::uuid AND "organizationId"=$2::uuid',[runId,actor.organizationId,JSON.stringify(run.steps),JSON.stringify(run.proposals),status],client);
   return structuredClone(plan);
  });
 }
}
