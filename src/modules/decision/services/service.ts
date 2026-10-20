import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {execute,queryOne,queryRows,transaction} from '@/platform/database';
import {agentService} from '@/modules/agent/server';
import {reportService} from '@/modules/report/server';
import {educationData} from '@/modules/education/server';
import {datasetAnalysisType} from '@/modules/education/contracts';
import {riskSegments} from '@/modules/segment/server';
import type {AgentActor} from '@/modules/agent/contracts';
import {isFinanceScope,isLearningScope} from '@/shared/contracts/analysis';
import {sameAnalysisRange} from '@/shared/lib/analysis-navigation';
import {WorkflowError} from '@/shared/errors/workflow-error';
import type {DecisionCreate,DecisionFeedback,DecisionTask,DecisionUpdate,QuantitativeReview,RecommendationSource,RecommendationVO,ReviewPreviewInput} from '../contracts';
import {nextDecisionState} from '../domain/workflow';
import {defaultReviewPeriod,reviewBaselineScope,validateDecisionGoals} from '../domain/review';
import {decisionArrangementMatches} from '../domain/arrangement';
import {calculateDecisionReview,completedBatchSignature} from './review';
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const writer=(a:AgentActor)=>{if(!['admin','operator'].includes(a.role))throw new WorkflowError('只读账号不能修改决策',403);};
type Row=Omit<DecisionTask,'createdAt'|'updatedAt'|'feedback'> & {createdAt:Date;updatedAt:Date;requestKey:string;requestHash:string};
const view=(r:Row,feedback:DecisionFeedback[]=[]):DecisionTask=>{const {requestKey:_key,requestHash:_hash,...record}=r;return {...record,createdAt:r.createdAt.toISOString(),updatedAt:r.updatedAt.toISOString(),feedback};};
export const decisionService={
 async existing(actor:AgentActor,source:RecommendationSource){const key=source.kind+':'+source.id+':'+source.index,row=await queryOne<{id:string}>('SELECT id FROM decision_task WHERE "organizationId"=$1 AND "sourceKey"=$2',[actor.organizationId,key]);return row?this.get(actor,row.id):null;},
 async source(actor:AgentActor,source:RecommendationSource):Promise<RecommendationVO>{
  let scope,answer,evidence,createdAt,datasetId;
  if(source.kind==='agent'){const run=await agentService.getRun(actor,source.id),session=(await agentService.getSession(actor,run.sessionId)).session;if(!['completed','awaiting_confirmation'].includes(run.status)||!run.answer)throw new WorkflowError('分析尚未成功，不能采纳其建议',409);({answer,evidence}=run);scope=run.context?.scope??session.scope;createdAt=run.completedAt!;datasetId=run.context?.datasetId??session.datasetId;}
  else{const report=await reportService.get(actor,source.id);if(report.status!=='completed'||!report.answer)throw new WorkflowError('报告尚未成功，不能采纳其建议',409);({answer,evidence}=report);scope=report.snapshot.scope;createdAt=report.completedAt!;datasetId=report.datasetId;}
  if(isLearningScope(scope))throw new WorkflowError('学习分析不属于经营决策任务来源',400);
  if(!answer)throw new WorkflowError('分析尚未成功',409);
  const {dataset}=await educationData.inspect(actor.organizationId,datasetId),mode=datasetAnalysisType(dataset);
  if(mode!=='operations'&&mode!=='finance')throw new WorkflowError('不支持此决策来源',400);
  const recommendation=answer.recommendations[source.index];if(!recommendation?.trim()||!answer.facts.length||!evidence.length)throw new WorkflowError('建议缺少有效数据依据',422);
  return {key:source.kind+':'+source.id+':'+source.index,source,datasetId,scope,answer:structuredClone(answer),evidence:structuredClone(evidence),recommendation,createdAt,dataOrigin:dataset.origin,analysisType:mode};
 },
 async recommendations(actor:AgentActor){
  const sessions=await agentService.listSessions(actor),reports=await reportService.list(actor),sources:RecommendationVO[]=[];
  for(const session of sessions.slice(0,40)){const detail=await agentService.getSession(actor,session.id);for(const run of detail.runs.filter(r=>r.answer&&['completed','awaiting_confirmation'].includes(r.status))){try{if(isLearningScope(run.context?.scope??session.scope)||!run.answer!.recommendations.length)continue;const base=await this.source(actor,{kind:'agent',id:run.id,index:0});for(let index=0;index<run.answer!.recommendations.length;index++)sources.push({...base,key:'agent:'+run.id+':'+index,source:{kind:'agent',id:run.id,index},recommendation:run.answer!.recommendations[index]});}catch(e){if(!(e instanceof WorkflowError))throw e;}}}
  for(const report of reports.filter(r=>r.status==='completed'&&r.answer)){try{if(!report.answer!.recommendations.length)continue;const base=await this.source(actor,{kind:'report',id:report.id,index:0});for(let index=0;index<report.answer!.recommendations.length;index++)sources.push({...base,key:'report:'+report.id+':'+index,source:{kind:'report',id:report.id,index},recommendation:report.answer!.recommendations[index]});}catch(e){if(!(e instanceof WorkflowError))throw e;}}
  const tasks=await this.list(actor);for(const source of sources)source.taskId=tasks.find(t=>t.sourceSnapshot.key===source.key)?.id;
  return sources.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,200);
 },
 async owners(actor:AgentActor){return queryRows<{id:string;name:string}>(`SELECT id,real_name AS name FROM local_user WHERE organization_id=$1 AND enabled=TRUE AND role=ANY($2::text[])${actor.role==='admin'?'':' AND id=$3'} ORDER BY real_name`,actor.role==='admin'?[actor.organizationId,['admin','operator']]:[actor.organizationId,['admin','operator'],actor.userId]);},
 async list(actor:AgentActor){return (await queryRows<Row>(`SELECT t.*,u.real_name AS "ownerName" FROM decision_task t JOIN local_user u ON u.id=t."ownerId" WHERE t."organizationId"=$1 ORDER BY t."updatedAt" DESC LIMIT 200`,[actor.organizationId])).map(r=>view(r));},
 async get(actor:AgentActor,id:string){const row=await queryOne<Row>(`SELECT t.*,u.real_name AS "ownerName" FROM decision_task t JOIN local_user u ON u.id=t."ownerId" WHERE t.id=$1::uuid AND t."organizationId"=$2::uuid`,[id,actor.organizationId]);if(!row)throw new WorkflowError('任务不存在或无权访问',404);const feedback=await queryRows<DecisionFeedback&{createdAt:Date}>(`SELECT id,kind,note,"reviewResult","adoptionIntention","quantitativeReview","fromState" AS "from","toState" AS "to",version,"createdBy","createdAt" FROM decision_feedback WHERE "taskId"=$1 AND "organizationId"=$2 ORDER BY version,id`,[id,actor.organizationId]);return view(row,feedback.map(f=>({...f,createdAt:f.createdAt.toISOString()})));},
 async previewReview(actor:AgentActor,id:string,input:ReviewPreviewInput){return calculateDecisionReview(actor,await this.get(actor,id),input);},
 async create(actor:AgentActor,input:DecisionCreate){
  writer(actor);const ownerId=input.ownerId??actor.userId;
  if(actor.role!=='admin'&&ownerId!==actor.userId)throw new WorkflowError('运营账号只能将任务分配给自己',403);
  if(!(await this.owners(actor)).some(u=>u.id===ownerId))throw new WorkflowError('责任人不属于本机构的有效操作账号',400);
  const source=await this.source(actor,input.source),requestHash=hash(input);
  if(input.goals)validateDecisionGoals(source,input.goals);
  const goals=input.goals?{...input.goals,reviewPeriod:input.goals.reviewPeriod??defaultReviewPeriod(reviewBaselineScope(source)),setAt:new Date().toISOString(),setBy:actor.userId,version:'decision-goals-v1' as const}:null;
  if(source.dataOrigin==='simulated'&&input.recordType!=='demonstration')throw new WorkflowError('模拟数据任务必须标为演示记录',400);
  if(input.segmentSnapshotId){if(isFinanceScope(source.scope))throw new WorkflowError('集团财务案例不能关联模拟学员人群',400);const {snapshot:segment}=await riskSegments.page(actor.organizationId,input.segmentSnapshotId,{page:1,pageSize:1});if(!segment||segment.datasetId!==source.datasetId||!sameAnalysisRange(segment.preview.scope,source.scope))throw new WorkflowError('人群须来自同数据集与分析范围',400);}
  const id=await transaction(async client=>{
   await execute('SELECT pg_advisory_xact_lock(hashtext($1))',[actor.organizationId+':decision:'+source.key],client);
   const old=await queryOne<Row>('SELECT * FROM decision_task WHERE "organizationId"=$1 AND ("sourceKey"=$2 OR ("createdBy"=$3 AND "requestKey"=$4))',[actor.organizationId,source.key,actor.userId,input.requestKey],client);
   if(old){if(old.requestKey===input.requestKey&&old.requestHash!==requestHash)throw new WorkflowError('请求编号已用于不同任务',409);if(old.sourceSnapshot.key!==source.key)throw new WorkflowError('请求来源已变化',409);if(!decisionArrangementMatches(old,input,ownerId))throw new WorkflowError('该建议已有不同安排的任务，请打开已有任务修改安排；不会重复创建或覆盖',409,'DECISION_SOURCE_CONFLICT');return old.id;}
   const id=randomUUID();await execute(`INSERT INTO decision_task (id,"organizationId","datasetId",source,"sourceKey","sourceSnapshot",action,"ownerId","createdBy",priority,"dueDate","reviewMethod","segmentSnapshotId","recordType",state,"requestKey","requestHash",goals) VALUES ($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb)`,[id,actor.organizationId,source.datasetId,JSON.stringify(input.source),source.key,JSON.stringify(source),input.action,ownerId,actor.userId,input.priority,input.dueDate,input.reviewMethod,input.segmentSnapshotId??null,input.recordType,input.disposition,input.requestKey,requestHash,goals?JSON.stringify(goals):null],client);
   await execute(`INSERT INTO decision_feedback (id,"organizationId","taskId","requestKey","requestHash",kind,note,"fromState","toState",version,"createdBy") VALUES ($1,$2,$3,$4,$5,'adoption',$6,$7,$7,1,$8)`,[randomUUID(),actor.organizationId,id,input.requestKey,requestHash,'页面确认：'+input.disposition+'；'+input.action,input.disposition,actor.userId],client);return id;
  });return this.get(actor,id);
 },
 async update(actor:AgentActor,id:string,input:DecisionUpdate){
  writer(actor);
  const current=await this.get(actor,id);
  if(actor.role!=='admin'&&current.ownerId!==actor.userId&&current.createdBy!==actor.userId)throw new WorkflowError('只能更新自己负责或建立的任务',403);
  const prior=await queryOne<{requestHash:string}>('SELECT "requestHash" FROM decision_feedback WHERE "organizationId"=$1 AND "taskId"=$2 AND "requestKey"=$3',[actor.organizationId,id,input.requestKey]);
  if(prior){if(prior.requestHash!==hash(input))throw new WorkflowError('反馈请求编号冲突',409);return current;}
  if(input.arrangement){if(!['accepted','deferred'].includes(current.state))throw new WorkflowError('任务已经开始执行或结束，不能改写原安排；请补充执行记录',409,'TASK_ALREADY_STARTED');if(actor.role!=='admin'&&input.arrangement.ownerId!==actor.userId)throw new WorkflowError('运营账号只能分配给自己',403);if(!(await this.owners(actor)).some(u=>u.id===input.arrangement!.ownerId))throw new WorkflowError('责任人须为本公司的有效操作账号',400);}
  let quantitativeReview:QuantitativeReview|null=null;
  if(input.quantitativeReview){
   const preview=await calculateDecisionReview(actor,current,{expectedVersion:input.expectedVersion,period:input.quantitativeReview.period});
   if(preview.previewToken!==input.quantitativeReview.previewToken)throw new WorkflowError('复核数字、任务版本或数据批次已变化，请重新预览',409,'REVIEW_PREVIEW_CHANGED');
   if(!preview.canConfirm)throw new WorkflowError(preview.reasons.join('；')||'任务尚未进入可确认的复核状态',409,'REVIEW_DATA_INSUFFICIENT');
   const {previewToken:_token,canConfirm:_confirm,...frozen}=preview;quantitativeReview=frozen;
  }
  await transaction(async client=>{
   const row=await queryOne<Row>('SELECT * FROM decision_task WHERE id=$1::uuid AND "organizationId"=$2::uuid FOR UPDATE',[id,actor.organizationId],client);if(!row)throw new WorkflowError('任务不存在',404);
   if(actor.role!=='admin'&&row.ownerId!==actor.userId&&row.createdBy!==actor.userId)throw new WorkflowError('只能更新自己负责或建立的任务',403);
   const old=await queryOne<{requestHash:string}>(`SELECT "requestHash" FROM decision_feedback WHERE "organizationId"=$1 AND "taskId"=$2 AND "requestKey"=$3`,[actor.organizationId,id,input.requestKey],client);
   if(old){if(old.requestHash!==hash(input))throw new WorkflowError('反馈请求编号冲突',409);return;}
   if(row.version!==input.expectedVersion)throw new WorkflowError('任务已被更新，请刷新后重试',409);
   if(input.arrangement&&!['accepted','deferred'].includes(row.state))throw new WorkflowError('任务已开始执行，不能改写安排',409,'TASK_ALREADY_STARTED');
   if(input.arrangement){const owner=await queryOne<{id:string}>('SELECT id FROM local_user WHERE id=$1::uuid AND organization_id=$2::uuid AND enabled=TRUE AND role=ANY($3::text[]) FOR SHARE',[input.arrangement.ownerId,actor.organizationId,['admin','operator']],client);if(!owner)throw new WorkflowError('责任人状态已变化，请重新选择本公司的有效操作账号',400,'OWNER_INVALID');}
   if(quantitativeReview){
    const batches=await queryRows<{id:string;status:string;kind:string;fileHash:string;acceptedRows:number}>('SELECT id,status,kind,"fileHash","acceptedRows" FROM education_import_batch WHERE "organizationId"=$1 AND "datasetId"=$2 AND status=\'completed\'',[actor.organizationId,row.datasetId],client);
    if(completedBatchSignature(batches)!==quantitativeReview.batchSignature)throw new WorkflowError('数据批次已变化，请重新预览复核',409,'REVIEW_BATCH_CHANGED');
   }
   const state=nextDecisionState(row.state,input),version=row.version+1;
   await execute('UPDATE decision_task SET state=$3,version=$4,"updatedAt"=NOW() WHERE id=$1 AND "organizationId"=$2 AND version=$5',[id,actor.organizationId,state,version,row.version],client);
   if(input.arrangement)await execute('UPDATE decision_task SET action=$3,"ownerId"=$4,priority=$5,"dueDate"=$6,"reviewMethod"=$7 WHERE id=$1 AND "organizationId"=$2 AND version=$8',[id,actor.organizationId,input.arrangement.action,input.arrangement.ownerId,input.arrangement.priority,input.arrangement.dueDate,input.arrangement.reviewMethod,version],client);
   const note=input.arrangement?input.note+'；安排调整前：'+JSON.stringify({action:row.action,ownerId:row.ownerId,priority:row.priority,dueDate:row.dueDate,reviewMethod:row.reviewMethod})+'；调整后：'+JSON.stringify(input.arrangement):input.note;
   await execute(`INSERT INTO decision_feedback (id,"organizationId","taskId","requestKey","requestHash",kind,note,"reviewResult","adoptionIntention","fromState","toState",version,"createdBy","quantitativeReview") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,[randomUUID(),actor.organizationId,id,input.requestKey,hash(input),input.kind,note,input.reviewResult??null,input.adoptionIntention??null,row.state,state,version,actor.userId,quantitativeReview?JSON.stringify(quantitativeReview):null],client);
  });return this.get(actor,id);
 }
};
