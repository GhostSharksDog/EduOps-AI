import {z} from 'zod';
import {createHash} from 'node:crypto';
import type {AuthorizedAnalysisScope,AuthorizedScope,CapabilityResult,EvidenceReference} from '@/shared/contracts/analysis';
import {analysisScopeSchema,isFinanceScope,isLearningScope} from '@/shared/contracts/analysis';
import {datasetAnalysisType} from '@/modules/education/contracts';
import type {DatasetVO} from '@/modules/education/contracts';
import {operationalTagRuleSchema} from '@/modules/tag/contracts';
import type {RiskDraftDTO,RiskProposalVO} from '@/modules/tag/contracts';
import type {AlertVO} from '@/modules/alert/contracts';
import type {ReportVO} from '@/modules/report/contracts';
import type {DecisionTask} from '@/modules/decision/contracts';
import {createKnowledgeSourceSchema,knowledgeKinds} from '@/modules/knowledge/contracts';
import type {CreateKnowledgeSourceDTO,KnowledgeSource} from '@/modules/knowledge/contracts';
import type {AgentActor,AgentToolPayload,ToolExecutionContext,ToolDefinition,AgentFactVO} from '../contracts';
import {prepareFollowupSchema,prepareReportSchema,prepareDecisionSchema} from '../contracts/actions';
import type {ActionPlanVO} from '../contracts/actions';
import {AgentError} from '../domain/errors';
import {ToolRegistry} from './registry';
import {proposalVO} from './tools';
import {ActionPlanService,defaultActionPorts,equalActionScope,stableActionKey} from './actions';
import {DatabaseActionPlanStore} from './action-store';

export interface WorkflowToolPorts {
 datasets:{list(org:string):Promise<DatasetVO[]>};
 tags:{get(org:string,id:string):Promise<RiskProposalVO>;edit(org:string,id:string,version:number,input:RiskDraftDTO):Promise<RiskProposalVO>};
 alerts:{list(actor:AgentActor,activeOnly?:boolean):Promise<AlertVO[]>;get?(actor:AgentActor,id:string):Promise<AlertVO>};
 reports:{list(org:string):Promise<ReportVO[]>;get(org:string,id:string):Promise<ReportVO>};
 decisions:{list(actor:AgentActor):Promise<DecisionTask[]>;owners(actor:AgentActor):Promise<{id:string;name:string}[]>;get?(actor:AgentActor,id:string):Promise<DecisionTask>};
 knowledge:{list(org:string):Promise<KnowledgeSource[]>;create(input:CreateKnowledgeSourceDTO,org:string,user:string,operationKey?:string):Promise<KnowledgeSource>};
}
export const defaultWorkflowPorts:WorkflowToolPorts={
 datasets:{list:async org=>(await import('@/modules/education/server')).educationData.listDatasets(org)},
 tags:{get:async(...args)=>(await import('@/modules/tag/server')).riskTags.get(...args),edit:async(...args)=>(await import('@/modules/tag/server')).riskTags.edit(...args)},
 alerts:{list:async(...args)=>(await import('@/modules/alert/server')).alertService.list(...args),get:async(...args)=>(await import('@/modules/alert/server')).alertService.get(...args)},
 reports:{list:async org=>(await import('@/modules/report/server')).reportService.listFrozen(org),get:async(...args)=>(await import('@/modules/report/server')).reportService.getFrozen(...args)},
 decisions:{list:async actor=>(await import('@/modules/decision/server')).decisionService.list(actor),owners:async actor=>(await import('@/modules/decision/server')).decisionService.owners(actor),get:async(...args)=>(await import('@/modules/decision/server')).decisionService.get(...args)},
 knowledge:{list:async org=>(await import('@/modules/knowledge/server')).knowledgeService.list(org),create:async(...args)=>(await import('@/modules/knowledge/server')).knowledgeService.create(...args)},
};
function context(ctx:ToolExecutionContext|undefined,scope:AuthorizedAnalysisScope){
 if(!ctx||ctx.actor.organizationId!==scope.organizationId)throw new AgentError('INVALID_CONTEXT','工具缺少有效公司身份',403);
 ctx.signal.throwIfAborted();return ctx;
}
const success=(data:AgentToolPayload):CapabilityResult<AgentToolPayload>=>({status:'ready',message:'业务查询或操作准备已完成',data});
const refs=(evidence:EvidenceReference[])=>[...new Map(evidence.map(e=>[e.id+'@'+e.version,{...e,id:e.id+'@'+e.version,summary:e.summary.slice(0,600)}])).values()].slice(0,40);
function recordEvidence(c:ToolExecutionContext,scope:AuthorizedAnalysisScope,kind:'task'|'report'|'alert'|'plan',id:string,version:string,summary:string,updatedAt:string):EvidenceReference {
 return {id:'workflow:'+kind+':'+id+'@'+version,kind:'metric',sourceId:id,version,summary,updatedAt,...(isFinanceScope(scope)?{financeScope:{years:scope.years}}:isLearningScope(scope)?{learningScope:{courseKeys:scope.courseKeys,relativeDayStart:scope.relativeDayStart,relativeDayEnd:scope.relativeDayEnd}}:{scope})};
}
function collectionEvidence(c:ToolExecutionContext,scope:AuthorizedAnalysisScope,kind:'task'|'report'|'alert',rows:unknown[],summary:string){
 return recordEvidence(c,scope,kind,c.datasetId,createHash('sha256').update(JSON.stringify({scope,rows})).digest('hex'),summary,new Date().toISOString());
}
const numberFact=(id:string,label:string,value:number|null,unit:string,evidence:EvidenceReference[]):AgentFactVO=>({id,label,value,unit,status:value===null?'insufficient_data':'ready',evidenceIds:evidence.map(e=>e.id)});
const textFact=(id:string,label:string,value:string|undefined,evidence:EvidenceReference[]):AgentFactVO=>({id,label,value:null,unit:'',status:value?'ready':'insufficient_data',...(value?{displayValue:value}:{}),evidenceIds:evidence.map(e=>e.id)});
function timestampText(value:string|null|undefined){const time=value?Date.parse(value):NaN;return Number.isFinite(time)?new Date(time+8*60*60*1000).toISOString().slice(0,19).replace('T',' ')+'（北京时间）':undefined;}
const taskStateLabels:Record<DecisionTask['state'],string>={accepted:'待执行',deferred:'暂缓',rejected:'不采纳',executing:'执行中',review_pending:'待复核',completed:'已复核'};
const reportStateLabels:Record<ReportVO['status'],string>={generating:'生成中',completed:'已生成',failed:'生成失败'};
const alertStateLabels:Record<AlertVO['state'],string>={open:'待处理',acknowledged:'已关注',resolved:'已处理'};
const taskQuerySchema=z.object({taskId:z.uuid().optional()}).strict(),reportQuerySchema=z.object({reportId:z.uuid().optional()}).strict(),alertQuerySchema=z.object({alertId:z.uuid().optional()}).strict();
function modelPlan(plan:ActionPlanVO){
 const {execution:_claim,...safe}=plan;
 return {...safe,steps:safe.steps.map(s=>s.input.kind==='publish_tag'?{...s,input:{kind:s.input.kind,proposalId:s.input.proposalId,version:s.input.version}}:s)};
}
async function planPayload(plan:ActionPlanVO,c:ToolExecutionContext,ports:WorkflowToolPorts,extraFacts:AgentFactVO[]=[],proposal?:AgentToolPayload['proposal']):Promise<AgentToolPayload>{
 const reference=recordEvidence(c,plan.scope,'plan',plan.id,'plan-v'+plan.version,'已准备操作计划的冻结元数据；正式动作仍等待页面确认，步骤、期限和责任人不代表已经执行，经营人数仅来自规则预览。',plan.updatedAt),evidence=[...refs(plan.evidence),reference],prefix=c.toolCallId+':plan',facts:AgentFactVO[]=[numberFact(prefix+':steps','计划步骤数',plan.steps.length,'步',[reference]),numberFact(prefix+':pending_steps','等待确认的步骤数',plan.steps.filter(s=>s.status!=='completed').length,'步',[reference]),numberFact(prefix+':version','操作计划版本',plan.version,'版',[reference]),...extraFacts];
 const expiry=[plan.expiresAt,plan.steps.some(s=>s.kind==='publish_tag'&&s.status!=='completed')?plan.preview?.expiresAt:undefined].filter((value):value is string=>!!value&&Number.isFinite(Date.parse(value))).map(value=>Date.parse(value));if(expiry.length)facts.push(textFact(prefix+':expires_at','确认卡有效期至',timestampText(new Date(Math.min(...expiry)).toISOString()),[reference]));
 if(plan.preview){facts.push(numberFact(prefix+':tag_version','标签规则版本',plan.preview.version,'版',[reference]),numberFact(prefix+':coverage','规则实际覆盖人数',plan.preview.memberCount,'人',refs(plan.evidence)),numberFact(prefix+':unknown','无法判断人数',plan.preview.unknownCount,'人',refs(plan.evidence)));}
 const taskStep=plan.steps.find(s=>s.input.kind==='create_decision_task');
 if(taskStep?.input.kind==='create_decision_task'){
  const task=taskStep.input.task,owners=await ports.decisions.owners(c.actor),owner=owners.find(v=>v.id===(task.ownerId??c.actor.userId));c.signal.throwIfAborted();
  facts.push(textFact(prefix+':task_due_date','拟定任务完成期限',task.dueDate,[reference]),textFact(prefix+':task_priority','拟定任务优先级',{high:'高',normal:'普通',low:'低'}[task.priority],[reference]),textFact(prefix+':task_owner_name','拟定任务责任人',owner?.name,[reference]));
 }
 const reportStep=plan.steps.find(s=>s.input.kind==='generate_report');
 if(reportStep?.input.kind==='generate_report'){
  facts.push(textFact(prefix+':report_anchor_date','报告周期锚点',reportStep.input.anchorDate,[reference]),textFact(prefix+':report_type','拟生成报告类型',reportStep.input.kindOfReport==='monthly'?'月报':'周报',[reference]));
  if(!isFinanceScope(plan.scope)&&!isLearningScope(plan.scope))facts.push(textFact(prefix+':report_period','拟生成报告周期',plan.scope.startDate+' 至 '+plan.scope.endDate,[reference]));
 }
 return {result:{actionPlan:modelPlan(plan),facts,next:'请用户核对计划卡上的全部动作、范围、版本和期限后，通过页面确认按钮执行'},actionPlan:plan,...(proposal?{proposal}:{}),facts,evidence};
}
const editSchema=z.object({proposalId:z.uuid(),version:z.number().int().positive(),name:z.string().trim().min(1).max(120).optional(),rule:operationalTagRuleSchema.optional()}).strict().refine(v=>!!v.name||!!v.rule,{message:'请提供标签名称或修改后的规则'});
const knowledgeSchema=z.object({title:z.string().trim().min(1).max(160),kind:z.enum(knowledgeKinds),content:z.string().trim().min(1).max(20000),reportId:z.uuid().optional()}).strict().refine(v=>v.kind!=='analysis_snapshot'||!!v.reportId,{message:'分析摘要须绑定已完成报告编号'}).refine(v=>!v.reportId||v.kind==='analysis_snapshot',{message:'报告只能作为分析摘要来源'});
function definition(name:string,description:string,mode:ToolDefinition['mode'],schema:z.ZodType):ToolDefinition{return {name,description,mode,status:'ready',parameters:z.toJSONSchema(schema) as Record<string,unknown>};}
export interface WorkflowToolOptions {mode:'operations'|'learning'|'finance';actions?:ActionPlanService;ports?:WorkflowToolPorts;}
export function registerWorkflowTools<S extends AuthorizedAnalysisScope>(registry:ToolRegistry<S>,options:WorkflowToolOptions):void {
 const ports=options.ports??defaultWorkflowPorts,actions=options.actions??new ActionPlanService(new DatabaseActionPlanStore(),defaultActionPorts);
 const empty=z.object({}).strict();
 registry.register(definition('list_datasets','查看本公司可用数据集及经营、公开学习、年度财务模式。仅返回来源与范围提示；切换数据集必须向用户明确说明。','read',empty),async(_raw,scope,ctx)=>{
  const c=context(ctx,scope),rows=await ports.datasets.list(c.actor.organizationId);c.signal.throwIfAborted();
  return success({result:{datasets:rows.slice(0,40).map(d=>({id:d.id,name:d.name,analysisType:datasetAnalysisType(d),origin:d.origin,dataCutoff:d.dataCutoff})),truncated:rows.length>40},facts:[],evidence:[]});
 },empty);
 if(options.mode==='learning')return;
 registry.register(definition('query_task_owners','查询允许分配跟进任务的本公司有效账号。管理员可选择运营或管理员，运营账号只能自己。姓名仅用于责任人选择，不包含联系方式。存在歧义时让用户选择，不猜测账号编号。','read',empty),async(_raw,scope,ctx)=>{
  const c=context(ctx,scope),owners=await ports.decisions.owners(c.actor);c.signal.throwIfAborted();return success({result:{owners:owners.slice(0,50),canAssignOthers:c.actor.role==='admin',truncated:owners.length>50},facts:[],evidence:[]});
 },empty);
 registry.register(definition('query_reports','查询当前范围的报告数量、生成状态、周期及保存时间。指定reportId读取精确报告与冻结数字。日期、状态及数字通过返回fact引用，不生成新报告。','read',reportQuerySchema),async(raw,scope,ctx)=>{
  const c=context(ctx,scope),input=reportQuerySchema.parse(raw),all=input.reportId?[await ports.reports.get(c.actor.organizationId,input.reportId)]:await ports.reports.list(c.actor.organizationId),rows=all.filter(r=>r.datasetId===c.datasetId&&equalActionScope(r.snapshot.scope,scope));c.signal.throwIfAborted();
  if(input.reportId&&!rows.length)throw new AgentError('OUTSIDE_SCOPE','报告不属于当前数据集或冻结范围',404);
  const complete=!!input.reportId||all.length<50,selected=rows.slice(0,input.reportId?1:6),collection=collectionEvidence(c,scope,'report',rows.map(r=>({id:r.id,status:r.status,createdAt:r.createdAt,completedAt:r.completedAt})),complete?'当前冻结范围内的已保存报告目录，数量来自数据库返回记录。':'报告服务最多返回最近五十条；本次数量仅代表已返回记录，不作为全部报告数量。'),evidence:EvidenceReference[]=[collection],facts:AgentFactVO[]=[numberFact(c.toolCallId+':reports:count',input.reportId?'本次查询报告数':complete?'当前范围报告数':'本次返回的报告数',rows.length,'份',[collection]),numberFact(c.toolCallId+':reports:completed','查询结果 · 已成功生成报告数',rows.filter(r=>r.status==='completed').length,'份',[collection]),numberFact(c.toolCallId+':reports:failed','查询结果 · 生成失败报告数',rows.filter(r=>r.status==='failed').length,'份',[collection])];
  for(const r of selected){const reference=recordEvidence(c,scope,'report',r.id,(r.completedAt??r.createdAt)+'/'+r.status,'已保存'+(r.kind==='monthly'?'月报':'周报')+'记录；生成状态和时间来自报告表，经营数字保持原冻结批次。',r.completedAt??r.createdAt),prefix=c.toolCallId+':report:'+r.id;evidence.push(reference);facts.push(textFact(prefix+':state','报告生成状态',reportStateLabels[r.status],[reference]),textFact(prefix+':period','报告统计周期',r.snapshot.scope.startDate+' 至 '+r.snapshot.scope.endDate,[reference]),textFact(prefix+':created_at','报告保存时间',timestampText(r.createdAt),[reference]));
   if(input.reportId)facts.push(textFact(prefix+':summary','已保存报告摘要',r.status==='completed'?r.answer?.summary:undefined,[reference]),textFact(prefix+':error','报告失败说明',r.status==='failed'?r.errorMessage??undefined:undefined,[reference]));
   if(input.reportId){const frozen=refs(r.evidence);evidence.push(...frozen);for(const [index,fact] of (r.facts??[]).entries()){const matching=frozen.filter(ref=>fact.evidenceIds.some(id=>id===ref.id||id===ref.sourceId||id===ref.id.slice(0,-(ref.version.length+1))+'/'+ref.version));facts.push({...fact,id:prefix+':frozen:'+index,label:'报告冻结 · '+fact.label,evidenceIds:[reference.id,...matching.map(e=>e.id)]});}}
  }
  return success({result:{reports:selected.map(r=>({id:r.id,kind:r.kind,status:r.status,summary:r.answer?.summary.slice(0,500)??null,summaryTruncated:(r.answer?.summary.length??0)>500,recommendations:r.answer?.recommendations.slice(0,3).map(s=>s.slice(0,500))??[],errorMessage:r.errorMessage,createdAt:r.createdAt})),complete,truncated:rows.length>selected.length,facts},facts,evidence});
 },reportQuerySchema);
 registry.register(definition('query_decision_tasks','查询当前范围的任务数量、状态、责任人与期限。指定taskId定位准确任务。日期和数量通过返回fact引用；不会采纳建议、改变状态或展示成员个人资料。','read',taskQuerySchema),async(raw,scope,ctx)=>{
  const c=context(ctx,scope),input=taskQuerySchema.parse(raw),all=input.taskId&&ports.decisions.get?[await ports.decisions.get(c.actor,input.taskId)]:await ports.decisions.list(c.actor),rows=all.filter(t=>(!input.taskId||t.id===input.taskId)&&t.datasetId===c.datasetId&&equalActionScope(t.sourceSnapshot.scope,scope));c.signal.throwIfAborted();
  if(input.taskId&&!rows.length)throw new AgentError('OUTSIDE_SCOPE','任务不存在或不属于当前冻结范围',404);
  const complete=!!input.taskId||all.length<200,selected=rows.slice(0,input.taskId?1:6),collection=collectionEvidence(c,scope,'task',rows.map(t=>({id:t.id,version:t.version,state:t.state,dueDate:t.dueDate})),complete?'当前冻结范围内的已保存任务；数量、状态与期限来自任务表，不推断实际执行效果。':'任务服务最多返回最近二百条；本次数量仅代表已返回记录，不作为全部任务总数。'),evidence:EvidenceReference[]=[collection],facts:AgentFactVO[]=[numberFact(c.toolCallId+':tasks:count',input.taskId?'本次查询任务数':complete?'当前范围任务数':'本次返回的任务数',rows.length,'项',[collection]),numberFact(c.toolCallId+':tasks:pending','查询结果 · 待执行任务数',rows.filter(t=>t.state==='accepted').length,'项',[collection]),numberFact(c.toolCallId+':tasks:executing','查询结果 · 执行中任务数',rows.filter(t=>t.state==='executing').length,'项',[collection]),numberFact(c.toolCallId+':tasks:review_pending','查询结果 · 待复核任务数',rows.filter(t=>t.state==='review_pending').length,'项',[collection])];
  for(const t of selected){const reference=recordEvidence(c,scope,'task',t.id,String(t.version),'已保存决策任务记录；行动、责任人和期限来自任务表，模拟记录不充当真实机构执行反馈。',t.updatedAt??new Date().toISOString()),prefix=c.toolCallId+':task:'+t.id;evidence.push(reference);facts.push(textFact(prefix+':due_date','任务完成期限',t.dueDate,[reference]),textFact(prefix+':state','任务处理状态',taskStateLabels[t.state],[reference]),textFact(prefix+':owner','任务责任人',t.ownerName||undefined,[reference]));if(input.taskId)facts.push(textFact(prefix+':action','任务执行动作',t.action,[reference]));}
  return success({result:{tasks:rows.slice(0,20).map(t=>({id:t.id,action:t.action.slice(0,500),actionTruncated:t.action.length>500,ownerId:t.ownerId,priority:t.priority,dueDate:t.dueDate,state:t.state,recordType:t.recordType,segmentSnapshotId:t.segmentSnapshotId,version:t.version})),complete,truncated:rows.length>20,facts},facts,evidence});
 },taskQuerySchema);
 registry.register(definition('prepare_decision_task','准备本次或同会话历史分析建议的任务确认卡；需要执行动作、期限和复核方法。管理员可指定有效本公司责任人，运营人员仅自己。准备不建立正式任务。','propose',prepareDecisionSchema),async(raw,scope,ctx)=>{
  const c=context(ctx,scope),plan=await actions.prepareDecision(raw,scope,c);c.signal.throwIfAborted();
  return success(await planPayload(plan,c,ports));
 },prepareDecisionSchema);
 if(options.mode==='finance')return;
 registry.register(definition('query_alerts','查询当前范围已保存预警数量、历史命中数字、阈值、时间与处理状态。指定alertId定位准确预警；数字和日期通过返回fact引用。只读，不重新评估。','read',alertQuerySchema),async(raw,scope,ctx)=>{
  const c=context(ctx,scope),input=alertQuerySchema.parse(raw),all=input.alertId&&ports.alerts.get?[await ports.alerts.get(c.actor,input.alertId)]:await ports.alerts.list(c.actor),rows=all.filter(a=>(!input.alertId||a.id===input.alertId)&&a.datasetId===c.datasetId&&equalActionScope(a.snapshot.scope,scope));c.signal.throwIfAborted();
  if(input.alertId&&!rows.length)throw new AgentError('OUTSIDE_SCOPE','预警不存在或不属于当前冻结范围',404);
  const complete=!!input.alertId||all.length<100,selected=rows.slice(0,input.alertId?1:6),collection=collectionEvidence(c,scope,'alert',rows.map(a=>({id:a.id,version:a.version,state:a.state,active:a.active})),complete?'当前冻结范围内的已保存预警目录；命中数字保留评估时的批次，并非自动重新计算。':'预警服务最多返回最近一百条；本次数量仅代表已返回记录，不作为全部预警数量。'),evidence:EvidenceReference[]=[collection],facts:AgentFactVO[]=[numberFact(c.toolCallId+':alerts:count',input.alertId?'本次查询预警数':complete?'当前范围预警数':'本次返回的预警数',rows.length,'条',[collection]),numberFact(c.toolCallId+':alerts:active','查询结果 · 有效未处理预警数',rows.filter(a=>a.active&&a.state!=='resolved').length,'条',[collection])];
  for(const a of selected){const reference=recordEvidence(c,scope,'alert',a.id,String(a.version),'已保存预警命中记录；阈值与命中数字为历史评估依据，处理状态来自预警表。',a.updatedAt??a.createdAt),prefix=c.toolCallId+':alert:'+a.id;evidence.push(reference);facts.push(numberFact(prefix+':value',a.title+' · 命中数字',a.value,'%',[reference]),numberFact(prefix+':baseline','预警对比值',a.baseline,'%',[reference]),numberFact(prefix+':threshold','预警阈值',a.threshold,a.rule==='attendance_drop'?'个百分点':'%',[reference]),textFact(prefix+':state','预警处理状态',alertStateLabels[a.state],[reference]),textFact(prefix+':created_at','预警保存时间',timestampText(a.createdAt),[reference]));}
  return success({result:{alerts:rows.slice(0,20).map(a=>({id:a.id,rule:a.rule,title:a.title,value:a.value,baseline:a.baseline,threshold:a.threshold,denominator:a.denominator,state:a.state,active:a.active})),complete,truncated:rows.length>20,facts},facts,evidence});
 },alertQuerySchema);
 registry.register(definition('edit_tag_draft','修改当前会话中未发布标签草稿的名称或规则，递增版本并清除旧预览。随后重新调用preview_tag_rule，不能改写已发布对象。','propose',editSchema),async(raw,scope,ctx)=>{
  const c=context(ctx,scope),input=editSchema.parse(raw),allowed=[...c.proposalIds??[],...c.sourceProposalIds??[]];
  if(!allowed.includes(input.proposalId))throw new AgentError('UNLINKED_PROPOSAL','只能编辑当前会话中的草稿',403);
  if(isFinanceScope(scope)||isLearningScope(scope))throw new AgentError('MODE_UNSUPPORTED','此模式不支持经营标签',400);
  const original=await ports.tags.get(c.actor.organizationId,input.proposalId);
  if(original.datasetId!==c.datasetId||!equalActionScope(original.scope,scope))throw new AgentError('OUTSIDE_SCOPE','草稿不属于本轮分析范围',409);
  if(original.status==='published')throw new AgentError('PUBLISHED_DRAFT','已发布标签不可改写，请新建草稿',409);
  const operatingScope=scope as AuthorizedScope;
  const publicScope=analysisScopeSchema.parse({startDate:operatingScope.startDate,endDate:operatingScope.endDate,campusIds:operatingScope.campusIds,courseIds:operatingScope.courseIds,channelIds:operatingScope.channelIds,...(operatingScope.dataCutoff?{dataCutoff:operatingScope.dataCutoff}:{})});
  const updated=await ports.tags.edit(c.actor.organizationId,input.proposalId,input.version,{datasetId:c.datasetId,name:input.name??original.name,rule:input.rule??original.rule,scope:publicScope}),proposal=proposalVO(updated);c.signal.throwIfAborted();
  return success({result:{proposal:{id:proposal.id,name:proposal.name,version:proposal.version,status:proposal.status,rule:proposal.rule},next:'请重新预览覆盖范围'},proposal,facts:[],evidence:proposal.evidence});
 },editSchema);
 registry.register(definition('prepare_action_plan','为已预览的本会话标签准备一次确认操作计划：发布标签，可选保存人群及建立跟进任务。具体覆盖人数、未知人数和规则由服务端校验。此工具不发布、不保存正式人群、不建立正式任务。','propose',prepareFollowupSchema),async(raw,scope,ctx)=>{
  const c=context(ctx,scope),plan=await actions.prepareFollowup(raw,scope,c);c.signal.throwIfAborted();
  const proposal=proposalVO(await ports.tags.get(c.actor.organizationId,plan.preview!.proposalId)),evidence=refs(plan.evidence),facts=[{id:c.toolCallId+':plan-coverage',label:'规则覆盖人数',value:plan.preview!.memberCount,unit:'人',status:'ready',evidenceIds:evidence.map(e=>e.id)},{id:c.toolCallId+':plan-unknown',label:'无法判断人数',value:plan.preview!.unknownCount,unit:'人',status:'ready',evidenceIds:evidence.map(e=>e.id)}];
  return success(await planPayload(plan,c,ports,facts,proposal));
 },prepareFollowupSchema);
 registry.register(definition('prepare_report','准备经营周报或月报的生成确认卡，周期须与当前自然周或自然月范围一致。确认前不调用报告模型，不生成正式报告。','propose',prepareReportSchema),async(raw,scope,ctx)=>{
  const c=context(ctx,scope),plan=await actions.prepareReport(raw,scope,c);c.signal.throwIfAborted();
  return success(await planPayload(plan,c,ports));
 },prepareReportSchema);
 registry.register(definition('save_knowledge_draft','保存待人工审核的知识材料草稿，不会审核或索引。分析摘要须绑定当前范围已成功的报告。不得将模型生成内容声称为已审核知识。','propose',knowledgeSchema),async(raw,scope,ctx)=>{
  const c=context(ctx,scope),input=knowledgeSchema.parse(raw);
  if(input.reportId){const report=await ports.reports.get(c.actor.organizationId,input.reportId);if(report.datasetId!==c.datasetId||report.status!=='completed'||!equalActionScope(report.snapshot.scope,scope))throw new AgentError('OUTSIDE_SCOPE','摘要报告须来自当前数据集、范围且生成成功',409);}
  const provenance:EvidenceReference={id:'agent-draft:'+c.runId+':'+c.toolCallId,kind:'knowledge',sourceId:c.runId,version:c.toolCallId,summary:'由智能分析准备的知识草稿，尚未人工审核，不参与正式检索',updatedAt:new Date().toISOString()};
  const source=await ports.knowledge.create(createKnowledgeSourceSchema.parse({...input,evidence:[provenance]}),c.actor.organizationId,c.actor.userId,stableActionKey(c.runId,c.toolCallId));c.signal.throwIfAborted();
  return success({result:{source:{id:source.id,title:source.title,version:source.version,status:source.status,indexStatus:source.indexStatus},url:'/dashboard/knowledge?sourceId='+source.id,next:'请前往业务知识页面核对并审核，审核前不会进入正式检索'},facts:[],evidence:[{id:source.id+'@'+source.version,kind:'knowledge',sourceId:source.id,version:source.version,summary:source.status==='draft'?'已保存Agent准备的知识草稿，未审核，不参与正式检索。':'已返回该准备请求的现有知识记录，审核与检索状态以材料详情为准。',updatedAt:source.updatedAt}]});
 },knowledgeSchema);
}
