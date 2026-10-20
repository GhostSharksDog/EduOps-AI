import 'server-only';
import {createHash} from 'node:crypto';
import {queryRows,queryOne} from '@/platform/database';
import {requireCompanyContext} from '@/platform/company/context';
import type {AgentActor,AgentRunVO,AgentRunCandidate} from '../contracts';
import {agentTaskComparisonSchema} from '../contracts/research';
import {DatabaseAgentRepository} from '../repositories/repository';
import {AgentError} from '../domain/errors';
import {identifyAgentVersion,describeAgentTask,compareAgentTasks} from '../domain/research';
const repository=new DatabaseAgentRepository();
export function assertAgentResearchActor(actor:AgentActor){
 const {company,actor:verified}=requireCompanyContext();
 if(!verified||verified.userId!==actor.userId||verified.role!==actor.role||company.organizationId!==actor.organizationId||!['admin','operator','viewer'].includes(actor.role))throw new AgentError('FORBIDDEN','请使用本公司已验证账号查询评价记录',403);
}
export const agentResearchService={
 async list(actor:AgentActor):Promise<AgentRunCandidate[]>{
  assertAgentResearchActor(actor);
  const rows=await queryRows<{id:string;sessionId:string;title:string;message:string;startedAt:Date;status:AgentRunVO['status'];steps:AgentRunVO['steps'];answer:AgentRunVO['answer']}>(`SELECT e.id,e."sessionId",s.title,e.message,e."startedAt",e.status,e.steps,e.answer FROM agent_execution e JOIN agent_session s ON s.id=e."sessionId" AND s."organizationId"=e."organizationId" WHERE e."organizationId"=$1::uuid ORDER BY e."startedAt" DESC LIMIT 200`,[actor.organizationId]);
  return rows.map(row=>({id:row.id,sessionId:row.sessionId,title:row.title,question:row.message,startedAt:row.startedAt.toISOString(),status:row.status,engineLabel:identifyAgentVersion(row as unknown as AgentRunVO).engineLabel}));
 },
 async compare(actor:AgentActor,input:unknown){
  assertAgentResearchActor(actor);const selected=agentTaskComparisonSchema.parse(input);
  const describe=async(id:string)=>{
   const saved=await repository.getRun(actor,id);
   const count=await queryOne<{n:number}>(`SELECT count(*)::int n FROM agent_message WHERE "organizationId"=$1::uuid AND "sessionId"=$2::uuid AND role='user' AND "createdAt"<=$3`,[actor.organizationId,saved.run.sessionId,new Date(saved.run.startedAt)]);
   const description=describeAgentTask(saved,count?.n?count.n:null),input=saved.run.steps.find(s=>s.runtime?.input)?.runtime?.input;
   if(input)description.inputHash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
   return description;
  };
  const [old,next]=await Promise.all([describe(selected.oldRunId),describe(selected.newRunId)]);return compareAgentTasks(old,next);
 }
};
