import {z} from 'zod';
import {operationalTagRuleSchema,ruleDescription} from '@/modules/tag/contracts';
import type {RiskDraftDTO,RiskProposalVO} from '@/modules/tag/contracts';
import {metricCodes} from '@/modules/analytics/contracts';
import type {OperationalAnalysis} from '@/modules/analytics/contracts';
import type {RiskSegmentSnapshotVO} from '@/modules/segment/contracts';
import type {RiskCrowdProfileVO} from '@/modules/profile/contracts';
import type {AuthorizedScope,CapabilityResult,EvidenceReference} from '@/shared/contracts/analysis';
import type {AgentFactVO,AgentProposalVO,AgentToolPayload,ToolExecutionContext} from '../contracts';
import {AgentError} from '../domain/errors';
import {ToolRegistry} from './registry';
import {agentTools} from './tool-registry';

export interface AgentBusinessPorts {
  metrics:{query(id:string,scope:AuthorizedScope,codes?:string[]):Promise<OperationalAnalysis>;breakdown?(id:string,scope:AuthorizedScope,dimension:'campus'|'course'|'channel'):Promise<{id:string;name:string;analysis:OperationalAnalysis}[]>};
  tags:{list(org:string):Promise<RiskProposalVO[]>;get(org:string,id:string):Promise<RiskProposalVO>;create(org:string,user:string,input:RiskDraftDTO,operationKey?:string):Promise<RiskProposalVO>;preview(org:string,id:string,version:number):Promise<RiskProposalVO>};
  profiles:{list(org:string):Promise<RiskSegmentSnapshotVO[]>;query(org:string,id:string):Promise<RiskCrowdProfileVO>};
  knowledge:{search(query:string,scope:AuthorizedScope,options?:{limit?:number;signal?:AbortSignal}):Promise<CapabilityResult<{query:string;hits:{id:string;title:string;kind:string;text:string;similarity:number;evidence:EvidenceReference}[]}>>};
}
function agentEvidence(values:readonly EvidenceReference[]):EvidenceReference[] {
  return values.map(e=>({...e,id:e.id+'@'+e.version}));
}
export function proposalVO(p:RiskProposalVO):AgentProposalVO {
  return {id:p.id,kind:'tag',version:p.version,status:p.status,name:p.name,rule:p.rule,ruleSummary:ruleDescription(p.rule),observedCount:p.preview?.observedCount??null,unknownCount:p.preview?.unknownStudentCount??null,estimatedCount:p.preview?.memberCount??null,previewToken:p.preview?.token??null,previewFingerprint:p.preview?.fingerprint??null,publishedTagId:p.publishedTagId,evidence:agentEvidence(p.preview?.evidence??[])};
}
export function sameScope(a:AuthorizedScope,b:AuthorizedScope):boolean {
  const sorted=(v:readonly string[])=>JSON.stringify([...v].sort());
  return a.organizationId===b.organizationId&&a.startDate===b.startDate&&a.endDate===b.endDate&&a.dataCutoff===b.dataCutoff&&sorted(a.campusIds)===sorted(b.campusIds)&&sorted(a.courseIds)===sorted(b.courseIds)&&sorted(a.channelIds)===sorted(b.channelIds)&&sorted(a.authorizedCampusIds)===sorted(b.authorizedCampusIds);
}
const requireContext=(context?:ToolExecutionContext)=>{if(!context)throw new AgentError('INVALID_CONTEXT','工具执行缺少服务器身份',403);context.signal.throwIfAborted();return context;};
const success=(data:AgentToolPayload):CapabilityResult<AgentToolPayload>=>({status:'ready',message:'查询或草稿操作已完成',data});
const metricLabels:Record<string,string>={attendance_rate:'出勤率',class_fill_rate:'满班率',hours_progress:'课耗进度',admission_conversion:'招生转化率',renewal_rate:'续费率',retention_rate:'学员留存率',complaint_count:'客诉数量',refund_amount:'完成退款金额'};
const uniqueEvidence=(values:EvidenceReference[])=>[...new Map(values.map(e=>[e.id,e])).values()];
const safeProposal=(p:AgentProposalVO)=>({id:p.id,kind:p.kind,version:p.version,status:p.status,name:p.name,rule:p.rule,ruleSummary:p.ruleSummary,observedCount:p.observedCount,unknownCount:p.unknownCount,estimatedCount:p.estimatedCount,publishedTagId:p.publishedTagId,evidence:p.evidence});
export function createAgentToolRegistry(ports:AgentBusinessPorts):ToolRegistry {
  const registry=new ToolRegistry();
  const definition=(name:string)=>agentTools.find(t=>t.name===name)!;
  registry.register(definition('query_metrics'),async(raw,scope,ctx)=>{
    const context=requireContext(ctx),input=raw as {metricCodes?:string[]};
    const result=await ports.metrics.query(context.datasetId,scope,input.metricCodes);context.signal.throwIfAborted();
    const metrics=result.metrics.map(m=>({...m,evidence:agentEvidence(m.evidence)}));
    const evidence=uniqueEvidence(metrics.flatMap(m=>m.evidence));
    const facts:AgentFactVO[]=metrics.map(m=>({id:context.toolCallId+':'+m.code,label:m.displayName??metricLabels[m.code]??m.code,value:m.value,unit:m.unit==='currency'?'元':m.unit==='count'?'条':'%',status:m.status,numerator:m.numerator,denominator:m.denominator,evidenceIds:m.evidence.map(e=>e.id)}));
    for(const item of result.trend.slice(-12))facts.push({id:context.toolCallId+':period:'+item.period,label:item.period+'出勤率',value:item.value,unit:'%',status:item.value===null?'insufficient_data':'ready',numerator:item.present,denominator:item.due,evidenceIds:evidence.map(e=>e.id)});
    return success({result:{dataset:result.dataset,scope:result.scope,metrics,trend:result.trend.slice(-12),breakdown:result.breakdown.slice(0,20),batches:result.batches,facts},evidence,facts});
  },z.object({metricCodes:z.array(z.enum(metricCodes)).min(1).max(8).optional()}).strict());
  registry.register(definition('query_metric_breakdown'),async(raw,scope,ctx)=>{
    const context=requireContext(ctx),input=raw as {dimension:'campus'|'course'|'channel'};
    if(!ports.metrics.breakdown)throw new AgentError('TOOL_UNAVAILABLE','维度查询尚不可用',503);
    const rows=await ports.metrics.breakdown(context.datasetId,scope,input.dimension);context.signal.throwIfAborted();
    const facts:AgentFactVO[]=[],evidence:EvidenceReference[]=[];
    const result=rows.slice(0,30).map(row=>({id:row.id,name:row.name,metrics:row.analysis.metrics.map(m=>{
      const refs=agentEvidence(m.evidence);evidence.push(...refs);facts.push({id:context.toolCallId+':'+row.id+':'+m.code,label:row.name+' '+(m.displayName??metricLabels[m.code]??m.code),value:m.value,unit:m.unit==='currency'?'元':m.unit==='count'?'条':'%',status:m.status,numerator:m.numerator,denominator:m.denominator,evidenceIds:refs.map(e=>e.id)});return {code:m.code,displayName:m.displayName,value:m.value,status:m.status,numerator:m.numerator,denominator:m.denominator,unknown:m.unknownCount};
    })}));return success({result:{dimension:input.dimension,groups:result,truncated:rows.length>30},facts,evidence:uniqueEvidence(evidence)});
  },z.object({dimension:z.enum(['campus','course','channel'])}).strict());
  registry.register(definition('query_tags'),async(raw,scope,ctx)=>{
    const context=requireContext(ctx),input=raw as {proposalId?:string};
    const records=input.proposalId?[await ports.tags.get(scope.organizationId,input.proposalId)]:await ports.tags.list(scope.organizationId);context.signal.throwIfAborted();
    const selected=records.filter(p=>p.datasetId===context.datasetId&&sameScope(p.scope,scope));
    if(input.proposalId&&!selected.length)throw new AgentError('OUTSIDE_SCOPE','草稿不属于此会话的数据集或统计范围',404);
    const proposals=selected.slice(0,30).map(proposalVO),evidence=uniqueEvidence(proposals.flatMap(p=>p.evidence));
    return success({result:{proposals:proposals.map(safeProposal),truncated:selected.length>30},facts:[],evidence});
  },z.object({proposalId:z.uuid().optional()}).strict());
  registry.register(definition('query_profile'),async(raw,scope,ctx)=>{
    const context=requireContext(ctx),input=raw as {snapshotId?:string};
    if(!input.snapshotId){
      const snapshots=await ports.profiles.list(scope.organizationId);context.signal.throwIfAborted();
      return success({result:{snapshots:snapshots.filter(p=>p.datasetId===context.datasetId&&sameScope(p.preview.scope,scope)).slice(0,30).map(p=>({id:p.id,segmentId:p.segmentId,name:p.name,memberCount:p.memberCount,tagVersion:p.tagVersion,createdAt:p.createdAt,scope:p.preview.scope}))},facts:[],evidence:[]});
    }
    const result=await ports.profiles.query(scope.organizationId,input.snapshotId);context.signal.throwIfAborted();
    if(result.snapshot.datasetId!==context.datasetId||!sameScope(result.snapshot.preview.scope,scope))throw new AgentError('OUTSIDE_SCOPE','人群快照不属于此会话的数据集或统计范围',404);
    const evidence=agentEvidence(result.evidence);
    const facts:AgentFactVO[]=[{id:context.toolCallId+':members',label:'快照学员人数',value:result.snapshot.memberCount,unit:'人',status:'ready',evidenceIds:evidence.map(e=>e.id)},{id:context.toolCallId+':attendance',label:'快照出勤率',value:result.attendance.rate,unit:'%',status:result.attendance.rate===null?'insufficient_data':'ready',numerator:result.attendance.present,denominator:result.attendance.due,evidenceIds:evidence.map(e=>e.id)}];
    return success({result:{snapshot:{id:result.snapshot.id,name:result.snapshot.name,scope:result.snapshot.preview.scope,tagVersion:result.snapshot.tagVersion},attendance:result.attendance,business:result.business,distributions:result.distributions,facts,hypotheses:result.hypotheses,actions:result.actions},evidence,facts});
  },z.object({snapshotId:z.uuid().optional()}).strict());
  registry.register(definition('search_knowledge'),async(raw,scope,ctx)=>{
    const context=requireContext(ctx),input=raw as {query:string;limit?:number};
    const response=await ports.knowledge.search(input.query,scope,{limit:input.limit,signal:context.signal});context.signal.throwIfAborted();
    if(response.status!=='ready'||!response.data)return {status:response.status,message:response.message,data:null};
    const hits=response.data.hits.slice(0,5).map(h=>({id:h.id,title:h.title,kind:h.kind,text:h.text.slice(0,4000),similarity:h.similarity,evidence:agentEvidence([h.evidence])[0]}));
    return success({result:{query:response.data.query,hits},evidence:hits.map(h=>h.evidence),facts:[]});
  },z.object({query:z.string().trim().min(1).max(1000),limit:z.number().int().min(1).max(5).optional()}).strict());
  registry.register(definition('propose_tag'),async(raw,scope,ctx)=>{
    const context=requireContext(ctx),input=raw as {name:string;rule:RiskDraftDTO['rule']};
    const {organizationId:_,authorizedCampusIds:__,observationCutoff:___,...clientScope}=scope;
    const p=await ports.tags.create(scope.organizationId,context.actor.userId,{datasetId:context.datasetId,name:input.name,rule:input.rule,scope:clientScope},context.runId+':'+context.toolCallId);context.signal.throwIfAborted();
    const proposal=proposalVO(p);return success({result:{proposal:safeProposal(proposal)},proposal,facts:[],evidence:proposal.evidence});
  },z.object({name:z.string().trim().min(1).max(120),rule:operationalTagRuleSchema}).strict());
  registry.register(definition('preview_tag_rule'),async(raw,scope,ctx)=>{
    const context=requireContext(ctx),input=raw as {proposalId:string;version:number};
    if(!context.proposalIds?.includes(input.proposalId))throw new AgentError('UNLINKED_PROPOSAL','只能预览本次执行产生的草稿',403);
    const p=await ports.tags.get(scope.organizationId,input.proposalId);
    if(p.datasetId!==context.datasetId||!sameScope(p.scope,scope))throw new AgentError('OUTSIDE_SCOPE','草稿统计范围已变化，请重新发起分析',409);
    context.signal.throwIfAborted();const previewed=await ports.tags.preview(scope.organizationId,input.proposalId,input.version);context.signal.throwIfAborted();
    const proposal=proposalVO(previewed),facts:AgentFactVO[]=[{id:context.toolCallId+':coverage',label:'风险规则覆盖人数',value:proposal.estimatedCount,unit:'人',status:'ready',evidenceIds:proposal.evidence.map(e=>e.id)}];
    return success({result:{proposal:safeProposal(proposal),observedCount:previewed.preview?.observedCount,unknownStudentCount:previewed.preview?.unknownStudentCount,scope:previewed.preview?.scope,facts},proposal,evidence:proposal.evidence,facts});
  },z.object({proposalId:z.uuid(),version:z.number().int().positive()}).strict());
  return registry;
}
