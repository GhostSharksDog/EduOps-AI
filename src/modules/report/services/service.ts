import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {queryOne,queryRows,execute} from '@/platform/database';
import {CloudModelClient} from '@/platform/ai/client';
import {WorkflowError} from '@/shared/errors/workflow-error';
import {operations,reportPeriod} from '@/modules/analytics/server';
import {knowledgeService} from '@/modules/knowledge/server';
import {safeAgentError} from '@/modules/agent/server';
import type {AgentActor,AgentFactVO} from '@/modules/agent/contracts';
import type {OperationalAnalysis} from '@/modules/analytics/contracts';
import {metricLabels} from '@/modules/analytics/contracts';
import type {ReportVO,ReportInput} from '../contracts';
import {generateReport,reportPrompt} from '../domain/generation';
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
type Row=Omit<ReportVO,'createdAt'|'completedAt'> & {requestHash:string;deadlineAt:Date;createdAt:Date;completedAt:Date|null};
const view=(r:Row):ReportVO=>({id:r.id,datasetId:r.datasetId,kind:r.kind,status:r.status,snapshot:r.snapshot,facts:r.facts,answer:r.answer,evidence:r.evidence,steps:r.steps,errorMessage:r.errorMessage,createdAt:r.createdAt.toISOString(),completedAt:r.completedAt?.toISOString()??null});
export function reportFacts(snapshot:OperationalAnalysis):AgentFactVO[]{return [...snapshot.metrics.map(m=>({prefix:'current',m})),...(snapshot.comparison?.metrics??[]).map(m=>({prefix:'previous',m}))].map(({prefix,m})=>({id:prefix+'/'+m.code,label:(prefix==='current'?'本期':'对比期')+' '+(m.displayName??metricLabels[m.code]??m.code),value:m.value,unit:m.unit==='currency'?'元':m.unit==='count'?'条':'%',status:m.status,numerator:m.numerator,denominator:m.denominator,evidenceIds:m.evidence.map(e=>e.id+'/'+e.version)}));}
const expire=async(org:string)=>execute(`UPDATE operational_report SET status='failed',"errorMessage"='生成超时或服务中断；已保存的数据依据保留',"completedAt"=NOW() WHERE "organizationId"=$1 AND status='generating' AND "deadlineAt"<NOW()`,[org]);
export const reportService={
 async listFrozen(organizationId:string){return (await queryRows<Row>('SELECT * FROM operational_report WHERE "organizationId"=$1 ORDER BY "createdAt" DESC LIMIT 50',[organizationId])).map(view);},
 async getFrozen(organizationId:string,id:string){
  const row=await queryOne<Row>('SELECT * FROM operational_report WHERE "organizationId"=$1 AND id=$2',[organizationId,id]);
  if(!row)throw new WorkflowError('报告不存在或无权访问',404);return view(row);
 },
 async list(actor:AgentActor){await expire(actor.organizationId);return (await queryRows<Row>('SELECT * FROM operational_report WHERE "organizationId"=$1 ORDER BY "createdAt" DESC LIMIT 50',[actor.organizationId])).map(view);},
 async get(actor:AgentActor,id:string){await expire(actor.organizationId);const row=await queryOne<Row>('SELECT * FROM operational_report WHERE "organizationId"=$1 AND id=$2',[actor.organizationId,id]);if(!row)throw new WorkflowError('报告不存在',404);return view(row);},
 async generate(actor:AgentActor,input:ReportInput){
  if(!['admin','operator'].includes(actor.role))throw new WorkflowError('只读用户不能生成报告',403);
  const requestHash=hash(input),existing=await queryOne<Row>('SELECT * FROM operational_report WHERE "organizationId"=$1 AND "createdBy"=$2 AND "requestKey"=$3',[actor.organizationId,actor.userId,input.requestKey]);
  if(existing){if(existing.requestHash!==requestHash)throw new WorkflowError('幂等键已用于不同的报告请求',409);return this.get(actor,existing.id);}
  const period=reportPeriod(input.kind,input.anchorDate),scope={...period,campusIds:input.campusIds,courseIds:input.courseIds,channelIds:input.channelIds??[],...(input.dataCutoff?{dataCutoff:input.dataCutoff}:{}),organizationId:actor.organizationId,authorizedCampusIds:[]};
  const snapshot:ReportVO['snapshot']=await operations.query(input.datasetId,scope),facts=reportFacts(snapshot),id=randomUUID(),evidence=snapshot.metrics.flatMap(m=>m.evidence).concat(snapshot.comparison?.metrics.flatMap(m=>m.evidence)??[]).filter((e,i,all)=>all.findIndex(v=>v.id===e.id&&v.version===e.version)===i);
  snapshot.evaluationContext={version:'evaluation-input-v1',model:process.env.CHAT_MODEL??'',promptVersion:'report-tools-v3-concise',systemPrompt:reportPrompt,facts,knowledge:[],inputs:[]};
  const inserted=await queryOne<Row>(`INSERT INTO operational_report (id,"organizationId","createdBy","requestKey","requestHash","datasetId",kind,snapshot,facts,evidence,"deadlineAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,NOW()+INTERVAL '120 seconds') ON CONFLICT ("organizationId","createdBy","requestKey") DO NOTHING RETURNING *`,[id,actor.organizationId,actor.userId,input.requestKey,requestHash,input.datasetId,input.kind,JSON.stringify(snapshot),JSON.stringify(facts),JSON.stringify(evidence)]);
  if(!inserted){const reused=await queryOne<Row>('SELECT * FROM operational_report WHERE "organizationId"=$1 AND "createdBy"=$2 AND "requestKey"=$3',[actor.organizationId,actor.userId,input.requestKey]);if(!reused||reused.requestHash!==requestHash)throw new WorkflowError('幂等键冲突',409);return this.get(actor,reused.id);}
  try{
   if(snapshot.dataset.origin!=='simulated'||!snapshot.metrics.some(m=>m.status==='ready'))throw new WorkflowError('本数据集没有可计算的经营指标，无法生成报告',422);
   const model=new CloudModelClient({baseUrl:process.env.CHAT_API_BASE_URL??'',apiKey:process.env.CHAT_API_KEY??'',model:process.env.CHAT_MODEL??''}),signal=AbortSignal.timeout(120000);
   const recordingModel:Parameters<typeof generateReport>[0]={chat:async(messages,tools,options)=>{snapshot.evaluationContext!.inputs.push({messages:structuredClone(messages),tools:structuredClone(tools),json:!!options?.json});await execute('UPDATE operational_report SET snapshot=$3::jsonb WHERE id=$1 AND "organizationId"=$2 AND status=\'generating\'',[id,actor.organizationId,JSON.stringify(snapshot)]);return model.chat(messages,tools,options);}};
   const generated=await generateReport(recordingModel,facts,async(query,signal)=>{const result=await knowledgeService.search(query,snapshot.scope,{limit:5,includeSnapshots:false,signal});if(result.status!=='ready'||!result.data)throw new WorkflowError(result.message??'知识检索不可用',503);const hits=result.data.hits.map(h=>({title:h.title,text:h.text,evidence:h.evidence}));for(const hit of hits)if(!snapshot.evaluationContext!.knowledge.some(k=>k.evidence.id===hit.evidence.id&&k.evidence.version===hit.evidence.version))snapshot.evaluationContext!.knowledge.push(hit);return {hits};},signal,async(steps,knowledge)=>{await execute(`UPDATE operational_report SET steps=$3::jsonb,evidence=$4::jsonb,snapshot=$5::jsonb WHERE id=$1 AND "organizationId"=$2 AND status='generating' AND "deadlineAt">NOW()`,[id,actor.organizationId,JSON.stringify(steps),JSON.stringify([...evidence,...knowledge]),JSON.stringify(snapshot)]);});
   evidence.push(...generated.evidence.filter(e=>!evidence.some(v=>v.id===e.id&&v.version===e.version)));
   await execute(`UPDATE operational_report SET status='completed',answer=$3::jsonb,evidence=$4::jsonb,steps=$5::jsonb,"completedAt"=NOW() WHERE id=$1 AND "organizationId"=$2 AND status='generating' AND "deadlineAt">NOW()`,[id,actor.organizationId,JSON.stringify(generated.answer),JSON.stringify(evidence),JSON.stringify(generated.steps)]);
  }catch(error){const safe=safeAgentError(error);const message=error instanceof Error&&['报告缺少只读工具查询依据','报告工具调用超过上限','报告模型调用超过上限','报告禁止调用未授权工具','报告工具参数不是有效JSON','报告工具参数无效','冻结事实查询不接受范围参数','报告知识查询参数无效'].includes(error.message)?error.message:safe.message;await execute(`UPDATE operational_report SET status='failed',"errorMessage"=$3,"completedAt"=NOW() WHERE id=$1 AND "organizationId"=$2 AND status='generating'`,[id,actor.organizationId,message]);}
  return this.get(actor,id);
 }
};
