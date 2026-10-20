import {createHash,randomUUID} from 'node:crypto';
import type {AgentActor,ToolExecutionContext} from '../contracts';
import type {ActionPlanVO,ActionPlanStepVO,ActionStepInput,ActionTaskInput,ConfirmActionPlanInput,EditActionPlanInput} from '../contracts/actions';
import {confirmActionPlanSchema,editActionPlanSchema,prepareFollowupSchema,prepareReportSchema,prepareDecisionSchema} from '../contracts/actions';
import type {RiskProposalVO} from '@/modules/tag/contracts';
import {previewExpiry} from '@/modules/tag/contracts';
import {sourceFingerprint} from '@/modules/tag/server';
import type {ImportResultVO,DatasetVO} from '@/modules/education/contracts';
import type {AuthorizedAnalysisScope,AuthorizedScope,EvidenceReference} from '@/shared/contracts/analysis';
import {isFinanceScope,isLearningScope} from '@/shared/contracts/analysis';
import {sameAnalysisRange} from '@/shared/lib/analysis-navigation';
import {analysisHref} from '@/shared/lib/analysis-navigation';
import {WorkflowError} from '@/shared/errors/workflow-error';
import {reportPeriod} from '@/modules/analytics/server';
import {AgentError} from '../domain/errors';
import {decisionArrangementMatches,type DecisionTask} from '@/modules/decision/contracts';
import type {ActionPlanStore,ActionRunSource} from './action-store';

export interface ActionBusinessPorts {
 authorize?(actor:AgentActor):Promise<void>;
 inspect(org:string,datasetId:string):Promise<{dataset:DatasetVO;batches:ImportResultVO[]}>;
 tags:{get(org:string,id:string):Promise<RiskProposalVO>;confirm(org:string,user:string,id:string,version:number,token:string):Promise<RiskProposalVO>};
 segments:{create(org:string,user:string,input:{tagId:string;tagVersion:number;previewFingerprint:string;name:string}):Promise<{id:string;name:string}>;find?(org:string,tagId:string,version:number):Promise<{id:string;name:string}|null>};
 decisions:{owners(actor:AgentActor):Promise<{id:string;name:string}[]>;source(actor:AgentActor,source:{kind:'agent';id:string;index:number}):Promise<{datasetId:string;scope:AuthorizedAnalysisScope}>;existing?(actor:AgentActor,source:{kind:'agent';id:string;index:number}):Promise<DecisionTask|null>;create(actor:AgentActor,input:{source:{kind:'agent';id:string;index:number};requestKey:string;disposition:'accepted';action:string;ownerId?:string;priority:'high'|'normal'|'low';dueDate:string;reviewMethod:string;segmentSnapshotId?:string;recordType:'demonstration'|'actual'}):Promise<{id:string}>};
 reports:{generate(actor:AgentActor,input:{datasetId:string;kind:'weekly'|'monthly';anchorDate:string;campusIds:string[];courseIds:string[];channelIds:string[];dataCutoff?:string;requestKey:string}):Promise<{id:string;status:string;errorMessage:string|null}>};
}
export function stableActionKey(planId:string,stepId:string):string {
 const bytes=createHash('sha256').update('agent-action-v1:'+planId+':'+stepId).digest().subarray(0,16);
 bytes[6]=(bytes[6]!&15)|80;bytes[8]=(bytes[8]!&63)|128;const hex=bytes.toString('hex');
 return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
const writer=(actor:AgentActor)=>{if(!['admin','operator'].includes(actor.role))throw new AgentError('FORBIDDEN_TOOL','只读账号不能确认业务操作',403);};
export function equalActionScope(a:AuthorizedAnalysisScope,b:AuthorizedAnalysisScope):boolean {
 if(a.organizationId!==b.organizationId)return false;
 if(isFinanceScope(a)||isFinanceScope(b))return isFinanceScope(a)&&isFinanceScope(b)&&JSON.stringify([...a.years].sort())===JSON.stringify([...b.years].sort());
 if(isLearningScope(a)||isLearningScope(b))return isLearningScope(a)&&isLearningScope(b)&&JSON.stringify([...a.courseKeys].sort())===JSON.stringify([...b.courseKeys].sort())&&a.relativeDayStart===b.relativeDayStart&&a.relativeDayEnd===b.relativeDayEnd;
 return sameAnalysisRange(a,b);
}
const step=(input:ActionStepInput,title:string):ActionPlanStepVO=>({id:randomUUID(),kind:input.kind,title,input,status:'pending'});
function failure(error:unknown):{code:string;message:string} {
 const item=error as {code?:unknown;message?:unknown};
 if(error instanceof AgentError)return {code:error.code,message:error.message};
 if(error instanceof WorkflowError)return {code:error.code??'BUSINESS_FAILED',message:error.message};
 return {code:'ACTION_FAILED',message:'操作未完成，已完成步骤保留；请检查数据服务后重试未完成步骤'};
}
function validateTaskOwner(actor:AgentActor,task:ActionTaskInput,owners:{id:string;name:string}[]){
 const ownerId=task.ownerId??actor.userId;
 if(actor.role!=='admin'&&ownerId!==actor.userId)throw new AgentError('OWNER_FORBIDDEN','运营账号只能将任务分配给自己',403);
 const owner=owners.find(owner=>owner.id===ownerId);if(!owner)throw new AgentError('OWNER_INVALID','责任人须为本公司的有效操作账号',400);return owner;
}
export class ActionPlanService {
 constructor(private readonly store:ActionPlanStore,private readonly ports:ActionBusinessPorts){}
 private async rememberConfirmed(actor:AgentActor,runId:string,planId:string){
  try{await this.store.rememberResults?.(actor,runId,planId);}catch{/* Keep committed formal outcomes even if optional memory is unavailable. */}
 }
 private async base(context:ToolExecutionContext,scope:AuthorizedAnalysisScope):Promise<ActionPlanVO>{
  writer(context.actor);await this.ports.authorize?.(context.actor);context.signal.throwIfAborted();
  if(scope.organizationId!==context.actor.organizationId)throw new AgentError('INVALID_CONTEXT','公司身份与分析范围不一致',403);
  const {dataset,batches}=await this.ports.inspect(context.actor.organizationId,context.datasetId);
  if(batches.some(b=>['running','validating'].includes(b.status)))throw new AgentError('BATCH_CHANGED','数据正在导入，请完成后重新准备操作',409);
  if(!batches.some(b=>b.status==='completed'))throw new AgentError('DATA_INSUFFICIENT','尚无完成的导入批次，无法准备业务操作',422);
  if(isLearningScope(scope))throw new AgentError('MODE_UNSUPPORTED','公开学习分析仅提供查询与操作指导',400);
  const now=new Date().toISOString();return {id:randomUUID(),version:1,runId:context.runId,datasetId:dataset.id,scope:structuredClone(scope),status:'prepared',steps:[],evidence:[],sourceFingerprint:sourceFingerprint(dataset.id,batches),createdAt:now,updatedAt:now,expiresAt:new Date(Date.now()+30*60*1000).toISOString()};
 }
 async prepareFollowup(raw:unknown,scope:AuthorizedAnalysisScope,context:ToolExecutionContext):Promise<ActionPlanVO>{
  const input=prepareFollowupSchema.parse(raw);
  if(isFinanceScope(scope)||isLearningScope(scope))throw new AgentError('MODE_UNSUPPORTED','该数据模式不能发布经营标签或建立人群',400);
  const allowed=[...context.proposalIds??[],...((context as ToolExecutionContext&{sourceProposalIds?:readonly string[]}).sourceProposalIds??[])];
  if(!allowed.includes(input.proposalId))throw new AgentError('UNLINKED_PROPOSAL','请先选择当前会话中的标签草稿',403);
  const plan=await this.base(context,scope),proposal=await this.ports.tags.get(scope.organizationId,input.proposalId);
  this.validateProposal(plan,proposal,input.version);
  const preview=proposal.preview!;
  plan.preview={proposalId:proposal.id,version:proposal.version,name:proposal.name,rule:proposal.rule,memberCount:preview.memberCount,unknownCount:preview.unknownStudentCount,expiresAt:previewExpiry(preview)};
  plan.evidence=structuredClone(preview.evidence);
  const publish=step({kind:'publish_tag',proposalId:proposal.id,version:proposal.version,previewToken:preview.token,previewFingerprint:preview.fingerprint,sourceFingerprint:preview.sourceFingerprint},'发布“'+proposal.name+'”');
  if(proposal.status==='published'){
   if(!proposal.publishedTagId)throw new AgentError('RESULT_CHANGED','已发布标签缺少有效对象，请刷新标签记录',409);
   publish.status='completed';publish.title='使用已发布标签“'+proposal.name+'”';publish.result={id:proposal.publishedTagId,url:this.resultHref(plan,'/dashboard/tags/risk',{proposalId:proposal.id}),label:'查看标签',reused:true};
  }
  plan.steps.push(publish);
  if(input.segmentName){
   const segment=step({kind:'save_segment',publishStepId:publish.id,name:input.segmentName},'保存人群“'+input.segmentName+'”');plan.steps.push(segment);
   if(proposal.publishedTagId){const existing=await this.ports.segments.find?.(scope.organizationId,proposal.publishedTagId,proposal.version);if(existing){segment.input={kind:'save_segment',publishStepId:publish.id,name:existing.name};segment.title='使用已保存人群“'+existing.name+'”';segment.status='completed';segment.result={id:existing.id,url:this.resultHref(plan,'/dashboard/data/portrait',{snapshotId:existing.id}),label:'查看人群“'+existing.name+'”',reused:true};}}
   if(input.task){const owner=validateTaskOwner(context.actor,input.task,await this.ports.decisions.owners(context.actor));const sourceRunId=input.sourceRunId??context.runId;if(sourceRunId!==context.runId){const previous=await this.store.get(context.actor,sourceRunId),current=await this.store.get(context.actor,context.runId);if(previous.sessionId!==current.sessionId)throw new AgentError('UNLINKED_SOURCE','建议须来自当前会话',403);await this.validateDecisionSource(context.actor,plan,sourceRunId,input.task.recommendationIndex);}plan.steps.push(step({kind:'create_decision_task',sourceRunId,task:{...input.task,ownerId:owner.id},ownerName:owner.name,segmentStepId:segment.id},'建立跟进任务'));}
  }
  await this.prepareExistingTasks(context.actor,plan);
  return plan;
 }
 async prepareReport(raw:unknown,scope:AuthorizedAnalysisScope,context:ToolExecutionContext):Promise<ActionPlanVO>{
  const input=prepareReportSchema.parse(raw);
  if(isFinanceScope(scope)||isLearningScope(scope))throw new AgentError('MODE_UNSUPPORTED','经营周报月报不适用于学习或年度财务数据',400);
  const plan=await this.base(context,scope);
  const period=reportPeriod(input.kind,input.anchorDate);
  if(period.startDate!==scope.startDate||period.endDate!==scope.endDate)throw new AgentError('REPORT_PERIOD_MISMATCH','报告周期须与当前分析范围一致，请先切换到对应自然周或自然月',409);
  plan.steps.push(step({kind:'generate_report',kindOfReport:input.kind,anchorDate:input.anchorDate},'生成'+(input.kind==='weekly'?'周报':'月报')));return plan;
 }
 async prepareDecision(raw:unknown,scope:AuthorizedAnalysisScope,context:ToolExecutionContext):Promise<ActionPlanVO>{
  const input=prepareDecisionSchema.parse(raw),plan=await this.base(context,scope),sourceRunId=input.sourceRunId??context.runId;
  const owner=validateTaskOwner(context.actor,input.task,await this.ports.decisions.owners(context.actor));
  if(sourceRunId!==context.runId){const source=await this.store.get(context.actor,sourceRunId),current=await this.store.get(context.actor,context.runId);if(source.sessionId!==current.sessionId)throw new AgentError('UNLINKED_SOURCE','请使用当前会话中的分析建议',403);await this.validateDecisionSource(context.actor,plan,sourceRunId,input.task.recommendationIndex);}
  plan.steps.push(step({kind:'create_decision_task',sourceRunId,task:{...input.task,ownerId:owner.id},ownerName:owner.name},'建立决策任务'));await this.prepareExistingTasks(context.actor,plan);return plan;
 }
 private async existingTask(actor:AgentActor,plan:ActionPlanVO,action:ActionPlanStepVO){
  const input=action.input;if(input.kind!=='create_decision_task'||!this.ports.decisions.existing)return null;
  const existing=await this.ports.decisions.existing(actor,{kind:'agent',id:input.sourceRunId,index:input.task.recommendationIndex});if(!existing)return null;
  let snapshotId:string|null|undefined=null;
  if(input.segmentStepId){const segment=plan.steps.find(s=>s.id===input.segmentStepId);snapshotId=segment?.result?.id;
   if(!snapshotId&&segment?.input.kind==='save_segment'){const segmentInput=segment.input,publish=plan.steps.find(s=>s.id===segmentInput.publishStepId),publishedInput=publish?.input;if(publishedInput?.kind==='publish_tag'){const tag=await this.ports.tags.get(actor.organizationId,publishedInput.proposalId);if(tag.publishedTagId){const saved=await this.ports.segments.find?.(actor.organizationId,tag.publishedTagId,publishedInput.version);if(saved)snapshotId=saved.id;}}}
  }
  const {dataset}=await this.ports.inspect(actor.organizationId,plan.datasetId),matching=snapshotId!==undefined&&existing.datasetId===plan.datasetId&&equalActionScope(existing.sourceSnapshot.scope,plan.scope)&&decisionArrangementMatches(existing,{...input.task,segmentSnapshotId:snapshotId??undefined,recordType:dataset.origin==='simulated'?'demonstration':'actual'},input.task.ownerId??actor.userId);
  if(!matching)throw Object.assign(new AgentError('DECISION_SOURCE_CONFLICT','该建议已有不同安排的任务，请查看已有任务并修改待执行安排；不会重复创建或覆盖',409),{stepId:action.id,result:{id:existing.id,url:this.resultHref(plan,'/dashboard/decisions',{taskId:existing.id}),label:'查看已有任务与安排',reused:true}});
  return existing;
 }
 private async prepareExistingTasks(actor:AgentActor,plan:ActionPlanVO){for(const action of plan.steps){if(action.input.kind!=='create_decision_task')continue;const existing=await this.existingTask(actor,plan,action);if(existing){action.status='completed';action.title='使用已有任务（保留当前状态）';action.result={id:existing.id,url:this.resultHref(plan,'/dashboard/decisions',{taskId:existing.id}),label:'查看已有任务',reused:true};}}}
 private validateProposal(plan:ActionPlanVO,proposal:RiskProposalVO,version:number){
  if(proposal.datasetId!==plan.datasetId||!equalActionScope(proposal.scope,plan.scope))throw new AgentError('OUTSIDE_SCOPE','标签草稿不属于本轮数据集或分析范围',409);
  if(proposal.version!==version)throw new AgentError('VERSION_CHANGED','草稿规则已修改，请重新预览',409);
  if(!proposal.preview||proposal.preview.ruleVersion!==version||proposal.status==='draft')throw new AgentError('PREVIEW_REQUIRED','请先完成当前规则版本的覆盖预览',409);
  if(proposal.status!=='published'&&(!Number.isFinite(Date.parse(previewExpiry(proposal.preview)))||Date.now()>=Date.parse(previewExpiry(proposal.preview))))throw new AgentError('PREVIEW_EXPIRED','覆盖预览已过期，请重新预览',409);
  if(proposal.preview.sourceFingerprint!==plan.sourceFingerprint)throw new AgentError('BATCH_CHANGED','数据批次已变化，请重新预览',409);
 }
 private async validateDecisionSource(actor:AgentActor,plan:ActionPlanVO,sourceRunId:string,index:number){
  const source=await this.ports.decisions.source(actor,{kind:'agent',id:sourceRunId,index});
  if(source.datasetId!==plan.datasetId||!equalActionScope(source.scope,plan.scope))throw new AgentError('SOURCE_CHANGED','任务建议不属于此计划的冻结范围',409);
 }
 private validateRecord(actor:AgentActor,plan:ActionPlanVO,run:ActionRunSource){
  if(plan.runId!==run.id||plan.datasetId!==run.context.datasetId||!equalActionScope(plan.scope,run.context.scope)||plan.scope.organizationId!==actor.organizationId)throw new AgentError('PLAN_CONTEXT_CHANGED','操作计划与分析来源不一致，请重新准备',409);
  if(actor.role!=='admin'&&run.createdBy!==actor.userId)throw new AgentError('PLAN_READ_ONLY','只能确认自己创建的会话计划',403);
  if(!['completed','awaiting_confirmation','failed'].includes(run.status))throw new AgentError('RUN_BUSY','请等待本轮分析结束',409);
 }
 /** Every pending action is checked before the first formal write. */
 private async preflight(actor:AgentActor,plan:ActionPlanVO,run:ActionRunSource){
  writer(actor);await this.ports.authorize?.(actor);this.validateRecord(actor,plan,run);
  const expiresAt=Date.parse(plan.expiresAt??new Date(Date.parse(plan.createdAt)+30*60*1000).toISOString());
  if(!Number.isFinite(expiresAt)||Date.now()>=expiresAt)throw new AgentError('PLAN_EXPIRED','操作计划已过期，请重新准备并核对',409);
  if(isLearningScope(plan.scope))throw new AgentError('MODE_UNSUPPORTED','学习数据不支持经营代办',400);
  const {dataset,batches}=await this.ports.inspect(actor.organizationId,plan.datasetId);
  if(batches.some(b=>['running','validating'].includes(b.status))||sourceFingerprint(dataset.id,batches)!==plan.sourceFingerprint)throw new AgentError('BATCH_CHANGED','分析后数据批次已变化，请重新准备计划',409);
  let owners:{id:string;name:string}[]|undefined;
  const seen=new Set<string>();
  for(const action of plan.steps){
   if(seen.has(action.id)||action.kind!==action.input.kind)throw new AgentError('INVALID_PLAN','操作计划结构无效',400);seen.add(action.id);
   const input=action.input;
   if(isFinanceScope(plan.scope)&&input.kind!=='create_decision_task')throw new AgentError('MODE_UNSUPPORTED','年度财务仅支持决策任务',400);
   if(input.kind==='publish_tag'){
    const proposal=await this.ports.tags.get(actor.organizationId,input.proposalId);this.validateProposal(plan,proposal,input.version);
    if(proposal.preview!.token!==input.previewToken||proposal.preview!.fingerprint!==input.previewFingerprint||proposal.preview!.sourceFingerprint!==input.sourceFingerprint)throw new AgentError('PREVIEW_CHANGED','预览凭证或范围已变化，请重新准备计划',409);
    if(action.status==='completed'&&proposal.publishedTagId!==action.result?.id)throw new AgentError('RESULT_CHANGED','已发布对象与操作记录不一致',409);
   }else if(input.kind==='save_segment'){
    const publish=plan.steps.find(s=>s.id===input.publishStepId);
    if(!publish||publish.kind!=='publish_tag'||!seen.has(publish.id))throw new AgentError('INVALID_PLAN','保存人群缺少前置发布步骤',400);
    if(action.status==='completed'&&this.ports.segments.find&&publish.input.kind==='publish_tag'){const tag=await this.ports.tags.get(actor.organizationId,publish.input.proposalId),saved=tag.publishedTagId?await this.ports.segments.find(actor.organizationId,tag.publishedTagId,publish.input.version):null;if(!saved||saved.id!==action.result?.id)throw new AgentError('RESULT_CHANGED','已保存人群已不可用，请查看原记录并重新准备',409);}
   }else if(input.kind==='create_decision_task'){
    owners??=await this.ports.decisions.owners(actor);validateTaskOwner(actor,input.task,owners);
    const source=await this.store.get(actor,input.sourceRunId);
    if(source.sessionId!==run.sessionId)throw new AgentError('UNLINKED_SOURCE','决策建议须来自当前会话',403);
    await this.validateDecisionSource(actor,plan,input.sourceRunId,input.task.recommendationIndex);
    const existing=await this.existingTask(actor,plan,action);if(action.status==='completed'&&this.ports.decisions.existing&&(!existing||existing.id!==action.result?.id))throw new AgentError('RESULT_CHANGED','已有任务记录已变化，请重新核对',409);
    if(input.segmentStepId&&!plan.steps.some(s=>s.id===input.segmentStepId&&s.kind==='save_segment'&&seen.has(s.id)))throw new AgentError('INVALID_PLAN','任务缺少前置人群步骤',400);
   }else if(input.kind==='generate_report'){
    if(isFinanceScope(plan.scope)||isLearningScope(plan.scope))throw new AgentError('MODE_UNSUPPORTED','该范围不支持经营报告',400);
    const period=reportPeriod(input.kindOfReport,input.anchorDate);
    if(period.startDate!==plan.scope.startDate||period.endDate!==plan.scope.endDate)throw new AgentError('REPORT_PERIOD_MISMATCH','报告周期与分析范围不一致，请重新准备',409);
   }
  }
 }
 async edit(raw:unknown,actor:AgentActor):Promise<ActionPlanVO>{
  writer(actor);const input:EditActionPlanInput=editActionPlanSchema.parse(raw),run=await this.store.get(actor,input.runId),plan=run.steps.flatMap(s=>{const p=(s as {actionPlan?:ActionPlanVO}).actionPlan;return p?[p]:[];}).find(p=>p.id===input.planId);
  if(!plan)throw new AgentError('PLAN_NOT_FOUND','操作计划不存在',404);this.validateRecord(actor,plan,run);
  const owner=input.task?validateTaskOwner(actor,input.task,await this.ports.decisions.owners(actor)):undefined;
  if(input.report){if(isFinanceScope(plan.scope)||isLearningScope(plan.scope))throw new AgentError('MODE_UNSUPPORTED','该范围不支持经营报告',400);const period=reportPeriod(input.report.kind,input.report.anchorDate);if(period.startDate!==plan.scope.startDate||period.endDate!==plan.scope.endDate)throw new AgentError('REPORT_PERIOD_MISMATCH','修改后的报告周期须与冻结范围一致',409);}
  await this.preflight(actor,plan,run);
  return this.store.mutate(actor,input.runId,input.planId,current=>{
   if(current.version!==input.version)throw new AgentError('PLAN_VERSION_CHANGED','计划已更新，请刷新确认卡',409);
   if(current.status!=='prepared'||current.steps.some(s=>s.status!=='pending'&&!(s.status==='completed'&&s.result?.reused)))throw new AgentError('PLAN_STARTED','已执行的计划不能改写，请保留结果并准备新计划',409);
   if(input.segmentName){const target=current.steps.find(s=>s.input.kind==='save_segment');if(!target||target.input.kind!=='save_segment')throw new AgentError('INVALID_PLAN','此计划没有保存人群步骤',400);if(target.status==='completed')throw new AgentError('SEGMENT_ALREADY_SAVED','此标签版本已保存名单，不能通过计划改名，请查看已有的人群',409);target.input.name=input.segmentName;target.title='保存人群“'+input.segmentName+'”';}
   if(input.task){const target=current.steps.find(s=>s.input.kind==='create_decision_task');if(!target||target.input.kind!=='create_decision_task')throw new AgentError('INVALID_PLAN','此计划没有任务步骤',400);if(target.status==='completed'&&target.result?.reused)throw new AgentError('DECISION_SOURCE_CONFLICT','此建议已保存任务，请在任务页面修改待执行安排，不能通过新计划覆盖',409);target.input.task={...input.task,ownerId:owner!.id};target.input.ownerName=owner!.name;}
   if(input.report){const target=current.steps.find(s=>s.input.kind==='generate_report');if(!target||target.input.kind!=='generate_report')throw new AgentError('INVALID_PLAN','此计划没有报告步骤',400);target.input.kindOfReport=input.report.kind;target.input.anchorDate=input.report.anchorDate;target.title='生成'+(input.report.kind==='weekly'?'周报':'月报');}
   current.version++;delete current.execution;delete current.errorCode;delete current.errorMessage;
  });
 }
 async confirm(raw:unknown,actor:AgentActor):Promise<ActionPlanVO>{
  writer(actor);const input:ConfirmActionPlanInput=confirmActionPlanSchema.parse(raw),attemptId=randomUUID();
  let plan=await this.store.mutate(actor,input.runId,input.planId,(current,run)=>{
   this.validateRecord(actor,current,run);
   if(current.version!==input.version)throw new AgentError('PLAN_VERSION_CHANGED','计划已变化，请刷新并再次核对',409);
   if(current.status==='completed')return;
   if(current.errorCode==='REPORT_FAILED')throw new AgentError('REPORT_REPREPARE_REQUIRED','原报告生成失败，已保留原记录；请重新准备并确认新的报告计划，不会自动重试原写入',409);
   if(current.status==='invalid')throw new AgentError(current.errorCode??'PLAN_INVALID',current.errorMessage??'计划已失效，请重新准备',409);
   // Old saved plans without an explicit owner retain their original creator as owner.
   for(const action of current.steps)if(action.input.kind==='create_decision_task'&&!action.input.task.ownerId)action.input.task.ownerId=run.createdBy;
   if(current.status==='executing'&&Date.now()<Date.parse(current.execution?.leaseUntil??''))throw new AgentError('PLAN_BUSY','此计划正在执行，请稍后查看结果',409);
   if(current.status==='executing')for(const action of current.steps)if(action.status==='running'){action.status='failed';action.errorCode='ACTION_INTERRUPTED';action.errorMessage='前次执行中断，将核对已有对象后恢复';}
   current.status='executing';current.execution={attemptId,startedAt:new Date().toISOString(),leaseUntil:new Date(Date.now()+180000).toISOString(),confirmedBy:actor.userId,requestKey:input.requestKey};delete current.errorCode;delete current.errorMessage;
  });
  if(plan.status==='completed'){await this.rememberConfirmed(actor,input.runId,input.planId);return plan;}
  const persist=(change:(plan:ActionPlanVO)=>void)=>this.store.mutate(actor,input.runId,input.planId,current=>{if(current.execution?.attemptId!==attemptId||current.version!==input.version)throw new AgentError('PLAN_CLAIM_LOST','执行状态已变化，请刷新记录',409);change(current);});
  try{
   await this.preflight(actor,plan,await this.store.get(actor,input.runId));
   for(const action of plan.steps){
    if(action.status==='completed')continue;
    await this.preflight(actor,plan,await this.store.get(actor,input.runId));
    plan=await persist(current=>{const target=current.steps.find(s=>s.id===action.id)!;target.status='running';delete target.errorCode;delete target.errorMessage;current.execution!.leaseUntil=new Date(Date.now()+180000).toISOString();});
    const result=await this.execute(actor,plan,action);
    plan=await persist(current=>{const target=current.steps.find(s=>s.id===action.id)!;target.status='completed';target.result=result;delete target.errorCode;delete target.errorMessage;});
   }
   plan=await persist(current=>{current.status='completed';delete current.errorCode;delete current.errorMessage;});
  }catch(error){
   const safe=failure(error),invalid=['BATCH_CHANGED','PLAN_EXPIRED','PREVIEW_EXPIRED','PREVIEW_CHANGED','VERSION_CHANGED','OUTSIDE_SCOPE','SOURCE_CHANGED','MODE_UNSUPPORTED','INVALID_PLAN','OWNER_INVALID','OWNER_FORBIDDEN','IDENTITY_CHANGED','DECISION_SOURCE_CONFLICT','RESULT_CHANGED'].includes(safe.code);
   plan=await persist(current=>{const detail=error as {result?:ActionPlanStepVO['result'];stepId?:string},target=current.steps.find(s=>s.status==='running')??current.steps.find(s=>s.id===detail.stepId);if(target){target.status='failed';target.errorCode=safe.code;target.errorMessage=safe.message;if(detail.result)target.result=detail.result;}current.status=invalid?'invalid':'partially_failed';current.errorCode=safe.code;current.errorMessage=safe.message;});
  }
  await this.rememberConfirmed(actor,input.runId,input.planId);
  return plan;
 }
 private async execute(actor:AgentActor,plan:ActionPlanVO,action:ActionPlanStepVO){
  const input=action.input;
  if(input.kind==='publish_tag'){
   const proposal=await this.ports.tags.confirm(actor.organizationId,actor.userId,input.proposalId,input.version,input.previewToken);
   if(!proposal.publishedTagId)throw new AgentError('PUBLISH_FAILED','标签尚未发布成功',409);
   return {id:proposal.publishedTagId,url:this.resultHref(plan,'/dashboard/tags/risk',{proposalId:proposal.id}),label:'查看标签'};
  }
  if(input.kind==='save_segment'){
   const published=plan.steps.find(s=>s.id===input.publishStepId),publication=published?.input;
   if(!published?.result||publication?.kind!=='publish_tag')throw new AgentError('DEPENDENCY_FAILED','前置标签尚未发布',409);
   const existing=await this.ports.segments.find?.(actor.organizationId,published.result.id,publication.version);
   if(existing)return {id:existing.id,url:this.resultHref(plan,'/dashboard/data/portrait',{snapshotId:existing.id}),label:'查看人群“'+existing.name+'”',reused:true};
   const snapshot=await this.ports.segments.create(actor.organizationId,actor.userId,{tagId:published.result.id,tagVersion:publication.version,previewFingerprint:publication.previewFingerprint,name:input.name});
   return {id:snapshot.id,url:this.resultHref(plan,'/dashboard/data/portrait',{snapshotId:snapshot.id}),label:'查看人群“'+snapshot.name+'”',...(snapshot.name!==input.name?{reused:true}:{})};
  }
  if(input.kind==='create_decision_task'){
   const existing=await this.existingTask(actor,plan,action);if(existing)return {id:existing.id,url:this.resultHref(plan,'/dashboard/decisions',{taskId:existing.id}),label:'查看已有任务',reused:true};
   const inspection=await this.ports.inspect(actor.organizationId,plan.datasetId),segment=input.segmentStepId?plan.steps.find(s=>s.id===input.segmentStepId)?.result:undefined;
   if(input.segmentStepId&&!segment)throw new AgentError('DEPENDENCY_FAILED','前置人群尚未保存',409);
   let task:{id:string};
   try{task=await this.ports.decisions.create(actor,{source:{kind:'agent',id:input.sourceRunId,index:input.task.recommendationIndex},requestKey:stableActionKey(plan.id,action.id),disposition:'accepted',action:input.task.action,ownerId:input.task.ownerId,priority:input.task.priority,dueDate:input.task.dueDate,reviewMethod:input.task.reviewMethod,...(segment?{segmentSnapshotId:segment.id}:{}),recordType:inspection.dataset.origin==='simulated'?'demonstration':'actual'});}catch(error){if(error instanceof WorkflowError&&error.code==='DECISION_SOURCE_CONFLICT')await this.existingTask(actor,plan,action);throw error;}
   return {id:task.id,url:this.resultHref(plan,'/dashboard/decisions',{taskId:task.id}),label:'查看跟进任务'};
  }
  if(isFinanceScope(plan.scope)||isLearningScope(plan.scope))throw new AgentError('MODE_UNSUPPORTED','经营报告需要经营分析范围',400);
  const report=await this.ports.reports.generate(actor,{datasetId:plan.datasetId,kind:input.kindOfReport,anchorDate:input.anchorDate,campusIds:plan.scope.campusIds,courseIds:plan.scope.courseIds,channelIds:plan.scope.channelIds,dataCutoff:plan.scope.dataCutoff,requestKey:stableActionKey(plan.id,action.id)});
  if(report.status!=='completed')throw Object.assign(new AgentError('REPORT_FAILED',report.errorMessage??'报告生成未完成，计算依据已保留，请查看报告记录',409),{result:{id:report.id,url:this.resultHref(plan,'/dashboard/reports/'+report.id),label:'查看报告记录'}});
  return {id:report.id,url:this.resultHref(plan,'/dashboard/reports/'+report.id),label:'查看报告'};
 }
 private resultHref(plan:ActionPlanVO,path:string,extra:Record<string,string>={}){
  if(isFinanceScope(plan.scope))return path+'?'+new URLSearchParams({datasetId:plan.datasetId,financeScope:JSON.stringify({years:plan.scope.years}),...extra});
  if(isLearningScope(plan.scope))throw new AgentError('MODE_UNSUPPORTED','学习模式不提供正式操作入口',400);
  return analysisHref(path,{datasetId:plan.datasetId,scope:plan.scope},extra);
 }
}

/** Lazy public module calls avoid an Agent–decision composition cycle. */
export const defaultActionPorts:ActionBusinessPorts={
 authorize:async actor=>{const identity=await (await import('@/modules/identity/server')).reloadLocalIdentity(actor.userId);if(!identity||identity.ownedBy!==actor.organizationId||identity.role!==actor.role||!['admin','operator'].includes(identity.role))throw new AgentError('IDENTITY_CHANGED','账号状态或权限已变化，请重新登录后核对计划',403);},
 inspect:async(...args)=>(await import('@/modules/education/server')).educationData.inspect(...args),
 tags:{get:async(...args)=>(await import('@/modules/tag/server')).riskTags.get(...args),confirm:async(...args)=>(await import('@/modules/tag/server')).riskTags.confirm(...args)},
 segments:{create:async(...args)=>(await import('@/modules/segment/server')).riskSegments.create(...args),find:async(org,tagId,version)=>(await (await import('@/modules/segment/server')).riskSegments.summaries(org,{sourceTagId:tagId,tagVersion:version}))[0]??null},
 decisions:{owners:async(...args)=>(await import('@/modules/decision/server')).decisionService.owners(...args),source:async(...args)=>(await import('@/modules/decision/server')).decisionService.source(...args),existing:async(...args)=>(await import('@/modules/decision/server')).decisionService.existing(...args),create:async(...args)=>(await import('@/modules/decision/server')).decisionService.create(...args)},
 reports:{generate:async(...args)=>(await import('@/modules/report/server')).reportService.generate(...args)},
};
