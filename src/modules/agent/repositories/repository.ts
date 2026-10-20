import 'server-only';
import {randomUUID} from 'node:crypto';
import {execute,queryOne,queryRows,transaction,type DbClient} from '@/platform/database';
import type {AuthorizedAnalysisScope} from '@/shared/contracts/analysis';
import type {AgentActor,AgentRepository,AgentRunDTO,AgentRunVO,AgentRunStatus,AgentSessionVO,AgentMessageVO,StoredAgentRun,TaskMemoryInput,TaskStateUpdate,AgentTaskStatePatch,PrepareAgentRecoveryInput} from '../contracts';
import {taskStatePatchSchema,taskStateSchema} from '../contracts/task-state';
import {readTaskState,prepareTaskState,patchTaskState,taskScopeKey,evidenceScopeKey,taskMemoryInput} from '../domain/task-state';
import {AgentError} from '../domain/errors';
import {boundedAgentVisualizations} from '../domain/visualization';

interface SessionRow {
  id:string;organizationId:string;createdBy:string;title:string;datasetId:string;scope:AuthorizedAnalysisScope;createdAt:Date;updatedAt:Date;taskState?:unknown;
}
interface ExecutionRow {
  id:string;organizationId:string;createdBy:string;sessionId:string;requestKey:string;requestHash:string;status:string;message:string;
  answer:AgentRunVO['answer'];steps:AgentRunVO['steps'];proposals:AgentRunVO['proposals'];evidence:AgentRunVO['evidence'];
  errorCode:string|null;errorMessage:string|null;startedAt:Date;deadlineAt:Date;completedAt:Date|null;
}
interface MessageRow {id:string;organizationId:string;sessionId:string;runId:string|null;role:string;content:string;createdAt:Date;}
const sessionVO=(s:SessionRow,actor:AgentActor):AgentSessionVO=>({id:s.id,title:s.title,datasetId:s.datasetId,scope:s.scope,createdBy:s.createdBy,editable:s.createdBy===actor.userId||actor.role==='admin',createdAt:s.createdAt.toISOString(),updatedAt:s.updatedAt.toISOString(),taskState:readTaskState(s.taskState,{datasetId:s.datasetId,scope:s.scope},s.updatedAt.toISOString())});
function runVO(r:ExecutionRow):AgentRunVO{
 const steps=Array.isArray(r.steps)?r.steps.filter(s=>s&&typeof s==='object'):[],runtime=steps.find(s=>s.runtime?.recoveryOf)?.runtime;
 return {id:r.id,sessionId:r.sessionId,status:r.status as AgentRunVO['status'],steps,proposals:Array.isArray(r.proposals)?r.proposals:[],evidence:Array.isArray(r.evidence)?r.evidence:[],answer:r.answer,errorCode:r.errorCode,errorMessage:r.errorMessage,startedAt:r.startedAt.toISOString(),completedAt:r.completedAt?.toISOString()??null,context:steps.findLast(s=>s.context)?.context,actionPlan:steps.findLast(s=>s.actionPlan)?.actionPlan,...(runtime?.recoveryOf?{recoveryOf:{runId:runtime.recoveryOf.runId,kind:'interpretation' as const}}:{})};
}
const messageVO=(m:MessageRow):AgentMessageVO=>({id:m.id,sessionId:m.sessionId,runId:m.runId,role:m.role as AgentMessageVO['role'],content:m.content,createdAt:m.createdAt.toISOString()});
const record=(r:ExecutionRow,s:SessionRow,actor:AgentActor):StoredAgentRun=>({run:{...runVO(r),context:runVO(r).context??{datasetId:s.datasetId,scope:s.scope}},session:sessionVO(s,actor),message:r.message,deadlineAt:r.deadlineAt.toISOString()});

async function freezeLegacyContext(session:SessionRow,client:DbClient){
 // 范围变更前给旧执行补充原范围元数据，既有数字、回答和证据不改写。
 const steps=JSON.stringify([{id:'legacy-context',tool:'resolve_context',status:'completed',evidence:[],context:{datasetId:session.datasetId,scope:session.scope}}]);
 await execute(`UPDATE agent_execution SET steps=$3::jsonb || CASE WHEN jsonb_typeof(steps)='array' THEN steps ELSE '[]'::jsonb END WHERE "sessionId"=$1::uuid AND "organizationId"=$2::uuid AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(steps)='array' THEN steps ELSE '[]'::jsonb END) step WHERE step ? 'context')`,[session.id,session.organizationId,steps],client);
}
function updateRun(actor:AgentActor,run:AgentRunVO,expectedStatuses:AgentRunStatus[],client?:DbClient,requireOwner=false){
 const parameters:unknown[]=[run.id,actor.organizationId,run.status,JSON.stringify(run.steps),JSON.stringify(run.proposals),JSON.stringify(run.evidence),run.answer?JSON.stringify(run.answer):null,run.errorCode,run.errorMessage,run.completedAt?new Date(run.completedAt):null,expectedStatuses];
 if(requireOwner)parameters.push(actor.userId);
 return execute(`UPDATE agent_execution SET status=$3,steps=$4::jsonb,proposals=$5::jsonb,evidence=$6::jsonb,answer=$7::jsonb,"errorCode"=$8,"errorMessage"=$9,"completedAt"=$10 WHERE id=$1::uuid AND "organizationId"=$2::uuid AND status=ANY($11::text[])${requireOwner?' AND "createdBy"=$12::uuid':''}`,parameters,client);
}
export class DatabaseAgentRepository implements AgentRepository {
 async getTaskState(actor:AgentActor,sessionId:string){
  const session=await queryOne<SessionRow>('SELECT * FROM agent_session WHERE id=$1::uuid AND "organizationId"=$2::uuid',[sessionId,actor.organizationId]);
  if(!session)throw new AgentError('NOT_FOUND','会话不存在或无权访问',404);
  return readTaskState(session.taskState,{datasetId:session.datasetId,scope:session.scope},session.updatedAt.toISOString());
 }
 async updateTaskState(actor:AgentActor,sessionId:string,raw:AgentTaskStatePatch){
  const input=taskStatePatchSchema.parse(raw);
  return transaction(async client=>{
   await execute('SELECT pg_advisory_xact_lock(hashtext($1))',[sessionId],client);
   const session=await queryOne<SessionRow>('SELECT * FROM agent_session WHERE id=$1::uuid AND "organizationId"=$2::uuid FOR UPDATE',[sessionId,actor.organizationId],client);
   if(!session)throw new AgentError('NOT_FOUND','会话不存在或无权访问',404);
   if(session.createdBy!==actor.userId&&actor.role!=='admin')throw new AgentError('SESSION_READ_ONLY','只能管理自己可继续会话的任务',403);
   const running=await queryOne<{id:string}>(`SELECT id FROM agent_execution WHERE "sessionId"=$1::uuid AND "organizationId"=$2::uuid AND status='running' AND "deadlineAt">NOW() LIMIT 1`,[sessionId,actor.organizationId],client);
   if(running)throw new AgentError('SESSION_BUSY','会话仍在分析，请完成后修改当前任务',409);
   const context={datasetId:session.datasetId,scope:session.scope},state=readTaskState(session.taskState,context,session.updatedAt.toISOString());
   if(state.revision!==input.expectedRevision)throw new AgentError('TASK_STATE_CONFLICT','当前任务已变化，请刷新后重新保存',409);
   const updated=patchTaskState(state,input,context);
   const count=await execute(`UPDATE agent_session SET "taskState"=$3::jsonb,"updatedAt"=NOW() WHERE id=$1::uuid AND "organizationId"=$2::uuid AND COALESCE("taskState"->>'revision','0')=$4`,[sessionId,actor.organizationId,JSON.stringify(updated),String(input.expectedRevision)],client);
   if(count!==1)throw new AgentError('TASK_STATE_CONFLICT','当前任务已变化，请刷新后重新保存',409);
   return updated;
  });
 }
 async prepare(actor:AgentActor,input:AgentRunDTO,requestHash:string,scope?:AuthorizedAnalysisScope,_memoryInput?:TaskMemoryInput){
  return transaction(async client=>{
   await execute('SELECT pg_advisory_xact_lock(hashtext($1))',[actor.organizationId+':'+actor.userId+':'+input.requestKey],client);
   const old=await queryOne<ExecutionRow>('SELECT * FROM agent_execution WHERE "organizationId"=$1::uuid AND "createdBy"=$2::uuid AND "requestKey"=$3',[actor.organizationId,actor.userId,input.requestKey],client);
   if(old){
    if(old.requestHash!==requestHash)throw new AgentError('REQUEST_KEY_CONFLICT','相同请求编号不能用于不同分析内容',409);
    const session=await queryOne<SessionRow>('SELECT * FROM agent_session WHERE id=$1::uuid AND "organizationId"=$2::uuid',[old.sessionId,actor.organizationId],client);
    if(!session)throw new AgentError('NOT_FOUND','会话不存在或无权访问',404);return {execution:record(old,session,actor),reused:true};
   }
   const now=new Date();let session:SessionRow|null=null;
   if(input.sessionId){
    await execute('SELECT pg_advisory_xact_lock(hashtext($1))',[input.sessionId],client);
    session=await queryOne<SessionRow>('SELECT * FROM agent_session WHERE id=$1::uuid AND "organizationId"=$2::uuid FOR UPDATE',[input.sessionId,actor.organizationId],client);
    if(!session)throw new AgentError('NOT_FOUND','会话不存在或无权访问',404);
    if(session.createdBy!==actor.userId&&actor.role!=='admin')throw new AgentError('SESSION_READ_ONLY','只能继续自己创建的会话',403);
    const running=await queryOne<{id:string}>(`SELECT id FROM agent_execution WHERE "sessionId"=$1::uuid AND "organizationId"=$2::uuid AND status='running' AND "deadlineAt">$3 LIMIT 1`,[session.id,actor.organizationId,now],client);
    if(running)throw new AgentError('SESSION_BUSY','此会话仍在分析，请等待当前执行完成',409);
    if(scope&&input.datasetId){
     await freezeLegacyContext(session,client);
     session=await queryOne<SessionRow>('UPDATE agent_session SET "datasetId"=$3::uuid,scope=$4::jsonb,"updatedAt"=$5 WHERE id=$1::uuid AND "organizationId"=$2::uuid RETURNING *',[session.id,actor.organizationId,input.datasetId,JSON.stringify(scope),now],client);
    }
   }else{
    if(!scope||!input.datasetId)throw new AgentError('INVALID_SCOPE','新会话缺少数据集或统计范围');
    session=await queryOne<SessionRow>('INSERT INTO agent_session (id,"organizationId","createdBy",title,"datasetId",scope,"createdAt","updatedAt") VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5::uuid,$6::jsonb,$7,$7) RETURNING *',[randomUUID(),actor.organizationId,actor.userId,input.message.slice(0,80),input.datasetId,JSON.stringify(scope),now],client);
   }
   const context={datasetId:session!.datasetId,scope:session!.scope};
   const currentTask=readTaskState(session!.taskState,context,now.toISOString());
   // Re-evaluate the authenticated user's original text while holding the session lock.
   // A first-goal suggestion computed before a concurrent explicit edit cannot overwrite it.
   const taskState=prepareTaskState(currentTask,context,taskMemoryInput(input.message,currentTask),now.toISOString());
   await execute('UPDATE agent_session SET "taskState"=$3::jsonb WHERE id=$1::uuid AND "organizationId"=$2::uuid',[session!.id,actor.organizationId,JSON.stringify(taskState)],client);session!.taskState=taskState;
   const steps=JSON.stringify([{id:'context',tool:'resolve_context',status:'completed',evidence:[],context,runtime:{engineVersion:'business-agent-v3',model:process.env.CHAT_MODEL??null,promptVersion:'conversational-v3',recordedAt:now.toISOString(),taskMemory:taskState}}]);
   const run=await queryOne<ExecutionRow>(`INSERT INTO agent_execution (id,"organizationId","createdBy","sessionId","requestKey","requestHash",status,message,steps,proposals,evidence,"startedAt","deadlineAt") VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,'running',$7,$10::jsonb,'[]'::jsonb,'[]'::jsonb,$8,$9) RETURNING *`,[randomUUID(),actor.organizationId,actor.userId,session!.id,input.requestKey,requestHash,input.message,now,new Date(now.getTime()+120000),steps],client);
   await execute('INSERT INTO agent_message (id,"organizationId","sessionId","runId",role,content,"createdAt") VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7)',[randomUUID(),actor.organizationId,session!.id,run!.id,'user',input.message,now],client);
   await execute('UPDATE agent_session SET "updatedAt"=$3 WHERE id=$1::uuid AND "organizationId"=$2::uuid',[session!.id,actor.organizationId,now],client);
   return {execution:record(run!,session!,actor),reused:false};
  },{timeoutMs:15000});
 }
 async prepareRecovery(actor:AgentActor,input:PrepareAgentRecoveryInput){
  return transaction(async client=>{
   await execute('SELECT pg_advisory_xact_lock(hashtext($1))',[actor.organizationId+':'+actor.userId+':'+input.requestKey],client);
   const old=await queryOne<ExecutionRow>('SELECT * FROM agent_execution WHERE "organizationId"=$1::uuid AND "createdBy"=$2::uuid AND "requestKey"=$3',[actor.organizationId,actor.userId,input.requestKey],client);
   if(old){
    if(old.requestHash!==input.requestHash||runVO(old).recoveryOf?.runId!==input.sourceRunId)throw new AgentError('REQUEST_KEY_CONFLICT','相同请求编号不能用于不同解读来源',409);
    const session=await queryOne<SessionRow>('SELECT * FROM agent_session WHERE id=$1::uuid AND "organizationId"=$2::uuid',[old.sessionId,actor.organizationId],client);
    if(!session)throw new AgentError('NOT_FOUND','会话不存在或无权访问',404);
    if(session.createdBy!==actor.userId&&actor.role!=='admin')throw new AgentError('SESSION_READ_ONLY','只能恢复自己可继续会话的分析',403);
    return {execution:record(old,session,actor),reused:true};
   }
   let source=await queryOne<ExecutionRow>('SELECT * FROM agent_execution WHERE id=$1::uuid AND "organizationId"=$2::uuid',[input.sourceRunId,actor.organizationId],client);
   if(!source)throw new AgentError('NOT_FOUND','原分析不存在或无权访问',404);
   await execute('SELECT pg_advisory_xact_lock(hashtext($1))',[source.sessionId],client);
   const session=await queryOne<SessionRow>('SELECT * FROM agent_session WHERE id=$1::uuid AND "organizationId"=$2::uuid FOR UPDATE',[source.sessionId,actor.organizationId],client);
   if(!session)throw new AgentError('NOT_FOUND','会话不存在或无权访问',404);
   if(session.createdBy!==actor.userId&&actor.role!=='admin')throw new AgentError('SESSION_READ_ONLY','只能恢复自己可继续会话的分析',403);
   source=await queryOne<ExecutionRow>('SELECT * FROM agent_execution WHERE id=$1::uuid AND "organizationId"=$2::uuid FOR SHARE',[input.sourceRunId,actor.organizationId],client);
   if(!source||source.status!=='failed'||input.sourceStatus!=='failed'||!source.completedAt||!input.sourceCompletedAt||source.completedAt.toISOString()!==new Date(input.sourceCompletedAt).toISOString())throw new AgentError('RECOVERY_SOURCE_CHANGED','原分析状态已变化，请刷新后重新准备解读',409);
   if(await queryOne<{id:string}>(`SELECT id FROM agent_execution WHERE "sessionId"=$1::uuid AND "organizationId"=$2::uuid AND status='running' AND "deadlineAt">NOW() LIMIT 1`,[session.id,actor.organizationId],client))throw new AgentError('SESSION_BUSY','会话仍在分析，请等待本轮完成',409);
   const saved=runVO(source),sourceContext=saved.context??{datasetId:session.datasetId,scope:session.scope};
   if(input.context.scope.organizationId!==actor.organizationId||evidenceScopeKey(sourceContext)!==evidenceScopeKey(input.context)||input.freeze.datasetId!==input.context.datasetId||input.freeze.scopeKey!==evidenceScopeKey(input.context)||!input.facts.length||!input.evidence.length)throw new AgentError('RECOVERY_CONTEXT_CHANGED','原分析的冻结依据不完整或范围已变化，请重新查询',409);
   const now=new Date(),id=randomUUID(),context=structuredClone(input.context),facts=structuredClone(input.facts),evidence=structuredClone(input.evidence);
   const visualizations=boundedAgentVisualizations(saved.steps.filter(step=>step.status==='completed'&&(!step.context||evidenceScopeKey(step.context)===evidenceScopeKey(sourceContext))).flatMap(step=>step.visualizations??[]),evidence);
   const steps=JSON.stringify([
    {id:'context',tool:'resolve_context',status:'completed',evidence:[],context,runtime:{engineVersion:'business-agent-v3',model:process.env.CHAT_MODEL??null,promptVersion:'interpretation-recovery-v1',recordedAt:now.toISOString(),freeze:input.freeze,recoveryOf:{runId:source.id,kind:'interpretation',fingerprint:input.freeze.dataFingerprint}}},
    {id:'frozen-facts',tool:'restore_frozen_facts',status:'completed',context,facts,evidence,...(visualizations.length?{visualizations}:{})},
   ]);
   const run=await queryOne<ExecutionRow>(`INSERT INTO agent_execution(id,"organizationId","createdBy","sessionId","requestKey","requestHash",status,message,steps,proposals,evidence,"startedAt","deadlineAt") VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,'running',$7,$8::jsonb,'[]'::jsonb,$9::jsonb,$10,$11) RETURNING *`,[id,actor.organizationId,actor.userId,session.id,input.requestKey,input.requestHash,source.message,steps,JSON.stringify(evidence),now,new Date(now.getTime()+120000)],client);
   await execute(`INSERT INTO agent_message(id,"organizationId","sessionId","runId",role,content,"createdAt") VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,'user','仅重新解读原查询结果',$5)`,[randomUUID(),actor.organizationId,session.id,id,now],client);
   // Restoring an old answer must not move the next-query range or rewrite current task memory.
   return {execution:record(run!,session,actor),reused:false};
  },{timeoutMs:15000});
 }
 async save(actor:AgentActor,run:AgentRunVO){
  const changed=await updateRun(actor,run,['running'],undefined,true);
  if(changed!==1)throw new AgentError('EXECUTION_ENDED','执行已结束，请刷新记录',409);
 }
 async finish(actor:AgentActor,run:AgentRunVO,expectedStatuses:AgentRunStatus[]=['running'],taskStateUpdate?:TaskStateUpdate){
  const snapshot=structuredClone(run);
  return transaction(async client=>{
   await execute('SELECT pg_advisory_xact_lock(hashtext($1))',[run.id],client);
   const current=await queryOne<ExecutionRow>('SELECT * FROM agent_execution WHERE id=$1::uuid AND "organizationId"=$2::uuid',[run.id,actor.organizationId],client);
   if(!current)throw new AgentError('NOT_FOUND','执行不存在或无权访问',404);
   if(!expectedStatuses.includes(current.status as AgentRunStatus))return false;
   if(expectedStatuses.includes('awaiting_confirmation')){
    const existing=runVO(current).proposals;snapshot.proposals=snapshot.proposals.map(p=>existing.find(e=>e.id===p.id&&e.version===p.version&&e.status==='published')??p);
    const pendingPlan=snapshot.steps.findLast(s=>s.actionPlan)?.actionPlan;
    snapshot.status=snapshot.proposals.every(p=>p.status==='published')&&(!pendingPlan||pendingPlan.status==='completed')?'completed':'awaiting_confirmation';
   }
   if(await updateRun(actor,snapshot,expectedStatuses,client)!==1)return false;
   const existing=await queryOne<{id:string}>('SELECT id FROM agent_message WHERE "organizationId"=$1::uuid AND "runId"=$2::uuid AND role=$3 LIMIT 1',[actor.organizationId,run.id,'assistant'],client);
   const content=snapshot.answer?.summary??snapshot.errorMessage??'执行已结束';
   if(existing)await execute('UPDATE agent_message SET content=$3 WHERE id=$1::uuid AND "organizationId"=$2::uuid',[existing.id,actor.organizationId,content],client);
   else await execute('INSERT INTO agent_message (id,"organizationId","sessionId","runId",role,content,"createdAt") VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,NOW())',[randomUUID(),actor.organizationId,run.sessionId,run.id,'assistant',content],client);
   const recovery=!!snapshot.recoveryOf||snapshot.steps.some(s=>s.runtime?.recoveryOf?.kind==='interpretation');
   if(!recovery&&snapshot.context){
    const session=await queryOne<SessionRow>('SELECT * FROM agent_session WHERE id=$1::uuid AND "organizationId"=$2::uuid FOR UPDATE',[run.sessionId,actor.organizationId],client);
    if(session&&JSON.stringify(session.scope)!==JSON.stringify(snapshot.context.scope))await freezeLegacyContext(session,client);
    await execute('UPDATE agent_session SET "updatedAt"=NOW(),"datasetId"=$3::uuid,scope=$4::jsonb WHERE id=$1::uuid AND "organizationId"=$2::uuid',[run.sessionId,actor.organizationId,snapshot.context.datasetId,JSON.stringify(snapshot.context.scope)],client);
    if(session&&taskStateUpdate&&['completed','awaiting_confirmation'].includes(snapshot.status)){
     if(session.createdBy!==actor.userId&&actor.role!=='admin')throw new AgentError('SESSION_READ_ONLY','不能改写其他会话的任务',403);
     const state=taskStateSchema.parse(taskStateUpdate.state);
     if(state.datasetId!==snapshot.context.datasetId||state.scopeKey!==taskScopeKey(snapshot.context))throw new AgentError('TASK_CONTEXT_CHANGED','任务状态与本轮范围不一致',409);
     const next={...state,revision:taskStateUpdate.expectedRevision+1,updatedAt:new Date().toISOString()};
     // A newer user edit wins. A stale completion may still save its answer but never overwrite it.
     await execute(`UPDATE agent_session SET "taskState"=$3::jsonb WHERE id=$1::uuid AND "organizationId"=$2::uuid AND COALESCE("taskState"->>'revision','0')=$4`,[run.sessionId,actor.organizationId,JSON.stringify(next),String(taskStateUpdate.expectedRevision)],client);
    }
   }else if(!recovery)await execute('UPDATE agent_session SET "updatedAt"=NOW() WHERE id=$1::uuid AND "organizationId"=$2::uuid',[run.sessionId,actor.organizationId],client);
   Object.assign(run,snapshot);return true;
  });
 }
 async progress(actor:AgentActor,requestKey:string){
  const run=await queryOne<ExecutionRow>('SELECT * FROM agent_execution WHERE "organizationId"=$1::uuid AND "createdBy"=$2::uuid AND "requestKey"=$3',[actor.organizationId,actor.userId,requestKey]);
  return {prepared:!!run,run:run?runVO(run):null,deadlineAt:run?.deadlineAt.toISOString()??null,expired:!!run&&run.status==='running'&&Date.now()>=run.deadlineAt.getTime()};
 }
 async findRunForProposal(actor:AgentActor,proposalId:string){
  const runs=await queryRows<ExecutionRow>('SELECT * FROM agent_execution WHERE "organizationId"=$1::uuid AND proposals @> $2::jsonb ORDER BY "startedAt" ASC LIMIT 2',[actor.organizationId,JSON.stringify([{id:proposalId}])]);
  if(runs.length!==1)return undefined;
  return this.getRun(actor,runs[0].id);
 }
 async getRun(actor:AgentActor,id:string){
  const run=await queryOne<ExecutionRow>('SELECT * FROM agent_execution WHERE id=$1::uuid AND "organizationId"=$2::uuid',[id,actor.organizationId]);
  if(!run)throw new AgentError('NOT_FOUND','执行不存在或无权访问',404);
  const session=await queryOne<SessionRow>('SELECT * FROM agent_session WHERE id=$1::uuid AND "organizationId"=$2::uuid',[run.sessionId,actor.organizationId]);
  if(!session)throw new AgentError('NOT_FOUND','会话不存在或无权访问',404);return record(run,session,actor);
 }
 async listSessions(actor:AgentActor){return(await queryRows<SessionRow>('SELECT * FROM agent_session WHERE "organizationId"=$1::uuid ORDER BY "updatedAt" DESC LIMIT 50',[actor.organizationId])).map(s=>sessionVO(s,actor));}
 async getSession(actor:AgentActor,id:string){
  const session=await queryOne<SessionRow>('SELECT * FROM agent_session WHERE id=$1::uuid AND "organizationId"=$2::uuid',[id,actor.organizationId]);
  if(!session)throw new AgentError('NOT_FOUND','会话不存在或无权访问',404);
  const [messages,runs]=await Promise.all([
   queryRows<MessageRow>('SELECT * FROM agent_message WHERE "organizationId"=$1::uuid AND "sessionId"=$2::uuid ORDER BY "createdAt" DESC LIMIT 200',[actor.organizationId,id]),
   queryRows<ExecutionRow>('SELECT * FROM agent_execution WHERE "organizationId"=$1::uuid AND "sessionId"=$2::uuid ORDER BY "startedAt" DESC LIMIT 100',[actor.organizationId,id]),
  ]);
  return {session:sessionVO(session,actor),messages:messages.reverse().map(messageVO),runs:runs.reverse().map(runVO)};
 }
 async history(actor:AgentActor,sessionId:string){
  const session=await queryOne<{id:string}>('SELECT id FROM agent_session WHERE id=$1::uuid AND "organizationId"=$2::uuid',[sessionId,actor.organizationId]);
  if(!session)throw new AgentError('NOT_FOUND','会话不存在或无权访问',404);
  return(await queryRows<MessageRow>('SELECT * FROM agent_message WHERE "organizationId"=$1::uuid AND "sessionId"=$2::uuid ORDER BY "createdAt" DESC LIMIT 12',[actor.organizationId,sessionId])).reverse().map(messageVO);
 }
}

