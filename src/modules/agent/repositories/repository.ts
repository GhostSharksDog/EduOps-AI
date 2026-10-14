import 'server-only';
import {randomUUID} from 'node:crypto';
import {execute,queryOne,queryRows,transaction,type DbClient} from '@/platform/database';
import type {AuthorizedAnalysisScope} from '@/shared/contracts/analysis';
import type {AgentActor,AgentRepository,AgentRunDTO,AgentRunVO,AgentRunStatus,AgentSessionVO,AgentMessageVO,StoredAgentRun} from '../contracts';
import {AgentError} from '../domain/errors';

interface SessionRow {
  id:string;organizationId:string;createdBy:string;title:string;datasetId:string;scope:AuthorizedAnalysisScope;createdAt:Date;updatedAt:Date;
}
interface ExecutionRow {
  id:string;organizationId:string;createdBy:string;sessionId:string;requestKey:string;requestHash:string;status:string;message:string;
  answer:AgentRunVO['answer'];steps:AgentRunVO['steps'];proposals:AgentRunVO['proposals'];evidence:AgentRunVO['evidence'];
  errorCode:string|null;errorMessage:string|null;startedAt:Date;deadlineAt:Date;completedAt:Date|null;
}
interface MessageRow {id:string;organizationId:string;sessionId:string;runId:string|null;role:string;content:string;createdAt:Date;}
const sessionVO=(s:SessionRow,actor:AgentActor):AgentSessionVO=>({id:s.id,title:s.title,datasetId:s.datasetId,scope:s.scope,createdBy:s.createdBy,editable:s.createdBy===actor.userId||actor.role==='admin',createdAt:s.createdAt.toISOString(),updatedAt:s.updatedAt.toISOString()});
const runVO=(r:ExecutionRow):AgentRunVO=>({id:r.id,sessionId:r.sessionId,status:r.status as AgentRunVO['status'],steps:r.steps,proposals:r.proposals,evidence:r.evidence,answer:r.answer,errorCode:r.errorCode,errorMessage:r.errorMessage,startedAt:r.startedAt.toISOString(),completedAt:r.completedAt?.toISOString()??null});
const messageVO=(m:MessageRow):AgentMessageVO=>({id:m.id,sessionId:m.sessionId,runId:m.runId,role:m.role as AgentMessageVO['role'],content:m.content,createdAt:m.createdAt.toISOString()});
const record=(r:ExecutionRow,s:SessionRow,actor:AgentActor):StoredAgentRun=>({run:runVO(r),session:sessionVO(s,actor),message:r.message,deadlineAt:r.deadlineAt.toISOString()});
function updateRun(actor:AgentActor,run:AgentRunVO,expectedStatuses:AgentRunStatus[],client?:DbClient,requireOwner=false){
 const parameters:unknown[]=[run.id,actor.organizationId,run.status,JSON.stringify(run.steps),JSON.stringify(run.proposals),JSON.stringify(run.evidence),run.answer?JSON.stringify(run.answer):null,run.errorCode,run.errorMessage,run.completedAt?new Date(run.completedAt):null,expectedStatuses];
 if(requireOwner)parameters.push(actor.userId);
 return execute(`UPDATE agent_execution SET status=$3,steps=$4::jsonb,proposals=$5::jsonb,evidence=$6::jsonb,answer=$7::jsonb,"errorCode"=$8,"errorMessage"=$9,"completedAt"=$10 WHERE id=$1::uuid AND "organizationId"=$2::uuid AND status=ANY($11::text[])${requireOwner?' AND "createdBy"=$12::uuid':''}`,parameters,client);
}
export class DatabaseAgentRepository implements AgentRepository {
 async prepare(actor:AgentActor,input:AgentRunDTO,requestHash:string,scope?:AuthorizedAnalysisScope){
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
    session=await queryOne<SessionRow>('SELECT * FROM agent_session WHERE id=$1::uuid AND "organizationId"=$2::uuid',[input.sessionId,actor.organizationId],client);
    if(!session)throw new AgentError('NOT_FOUND','会话不存在或无权访问',404);
    if(session.createdBy!==actor.userId&&actor.role!=='admin')throw new AgentError('SESSION_READ_ONLY','只能继续自己创建的会话',403);
    const running=await queryOne<{id:string}>(`SELECT id FROM agent_execution WHERE "sessionId"=$1::uuid AND "organizationId"=$2::uuid AND status='running' AND "deadlineAt">$3 LIMIT 1`,[session.id,actor.organizationId,now],client);
    if(running)throw new AgentError('SESSION_BUSY','此会话仍在分析，请等待当前执行完成',409);
   }else{
    if(!scope||!input.datasetId)throw new AgentError('INVALID_SCOPE','新会话缺少数据集或统计范围');
    session=await queryOne<SessionRow>('INSERT INTO agent_session (id,"organizationId","createdBy",title,"datasetId",scope,"createdAt","updatedAt") VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5::uuid,$6::jsonb,$7,$7) RETURNING *',[randomUUID(),actor.organizationId,actor.userId,input.message.slice(0,80),input.datasetId,JSON.stringify(scope),now],client);
   }
   const run=await queryOne<ExecutionRow>(`INSERT INTO agent_execution (id,"organizationId","createdBy","sessionId","requestKey","requestHash",status,message,steps,proposals,evidence,"startedAt","deadlineAt") VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,'running',$7,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,$8,$9) RETURNING *`,[randomUUID(),actor.organizationId,actor.userId,session!.id,input.requestKey,requestHash,input.message,now,new Date(now.getTime()+120000)],client);
   await execute('INSERT INTO agent_message (id,"organizationId","sessionId","runId",role,content,"createdAt") VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7)',[randomUUID(),actor.organizationId,session!.id,run!.id,'user',input.message,now],client);
   await execute('UPDATE agent_session SET "updatedAt"=$3 WHERE id=$1::uuid AND "organizationId"=$2::uuid',[session!.id,actor.organizationId,now],client);
   return {execution:record(run!,session!,actor),reused:false};
  },{timeoutMs:15000});
 }
 async save(actor:AgentActor,run:AgentRunVO){
  const changed=await updateRun(actor,run,['running'],undefined,true);
  if(changed!==1)throw new AgentError('EXECUTION_ENDED','执行已结束，请刷新记录',409);
 }
 async finish(actor:AgentActor,run:AgentRunVO,expectedStatuses:AgentRunStatus[]=['running']){
  const snapshot=structuredClone(run);
  return transaction(async client=>{
   await execute('SELECT pg_advisory_xact_lock(hashtext($1))',[run.id],client);
   const current=await queryOne<ExecutionRow>('SELECT * FROM agent_execution WHERE id=$1::uuid AND "organizationId"=$2::uuid',[run.id,actor.organizationId],client);
   if(!current)throw new AgentError('NOT_FOUND','执行不存在或无权访问',404);
   if(!expectedStatuses.includes(current.status as AgentRunStatus))return false;
   if(expectedStatuses.includes('awaiting_confirmation')){
    const existing=runVO(current).proposals;snapshot.proposals=snapshot.proposals.map(p=>existing.find(e=>e.id===p.id&&e.version===p.version&&e.status==='published')??p);
    snapshot.status=snapshot.proposals.every(p=>p.status==='published')?'completed':'awaiting_confirmation';
   }
   if(await updateRun(actor,snapshot,expectedStatuses,client)!==1)return false;
   const existing=await queryOne<{id:string}>('SELECT id FROM agent_message WHERE "organizationId"=$1::uuid AND "runId"=$2::uuid AND role=$3 LIMIT 1',[actor.organizationId,run.id,'assistant'],client);
   const content=snapshot.answer?.summary??snapshot.errorMessage??'执行已结束';
   if(existing)await execute('UPDATE agent_message SET content=$3 WHERE id=$1::uuid AND "organizationId"=$2::uuid',[existing.id,actor.organizationId,content],client);
   else await execute('INSERT INTO agent_message (id,"organizationId","sessionId","runId",role,content,"createdAt") VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,NOW())',[randomUUID(),actor.organizationId,run.sessionId,run.id,'assistant',content],client);
   await execute('UPDATE agent_session SET "updatedAt"=NOW() WHERE id=$1::uuid AND "organizationId"=$2::uuid',[run.sessionId,actor.organizationId],client);
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

