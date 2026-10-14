import {buildChannelAttribution,buildStudentBusinessFacts,channelCatalog,channelName,datasetAnalysisType,effectiveChannelId,validOperationalContract,type EducationSnapshot} from '@/modules/education/contracts';
import type {AuthorizedScope} from '@/shared/contracts/analysis';
import type {ChannelAnalysis,ChannelFunnel} from '../contracts/channels';
import {OperationsService,type EducationAnalysisPort} from './operations-service';
import {operationalKinds} from '../domain/operations';
import {WorkflowError} from '@/shared/errors/workflow-error';
import type {PreparedOperations} from '../repositories/operations-repository';
const localDay=(v:string)=>new Date(Date.parse(v)+8*3600000).toISOString().slice(0,10);

/** 同一线索获取批次的试听和30日签约；直接签约不能伪装为漏斗中的试听。 */
export function channelFunnel(snapshot:EducationSnapshot,scope:AuthorizedScope):ChannelFunnel {
    const cutoff=Date.parse(scope.dataCutoff!),observed=Math.min(Date.parse(snapshot.dataset.dataCutoff),Date.parse(scope.observationCutoff??scope.dataCutoff!));
    const leads=snapshot.records.filter(r=>r.kind==='lead'&&r.occurredAt&&Date.parse(r.occurredAt)<=cutoff&&localDay(r.occurredAt)>=scope.startDate&&localDay(r.occurredAt)<=scope.endDate&&(!scope.campusIds.length||scope.campusIds.includes(r.campusId))&&(!scope.courseIds.length||scope.courseIds.includes(r.courseId))&&(!scope.authorizedCampusIds.length||scope.authorizedCampusIds.includes(r.campusId))&&(!scope.channelIds.length||scope.channelIds.includes(effectiveChannelId(r.payload.channelId))));
    const contracts=new Map<string,typeof snapshot.records>(),trials=new Map<string,typeof snapshot.records>();
    for(const r of snapshot.records){const id=String(r.payload.leadId??'');if(!id)continue;const map=r.kind==='contract'&&validOperationalContract(r)?contracts:r.kind==='trial'&&r.payload.status==='attended'?trials:null;if(map)map.set(id,[...(map.get(id)??[]),r]);}
    let trialAttended=0,converted=0,afterTrial=0,direct=0,pending=0,missingLinks=0;
    for(const lead of leads){const from=Date.parse(String(lead.payload.acquiredAt)),deadline=from+30*86400000,to=Math.min(deadline,observed);if(deadline>observed)pending++;
        const same=(r:typeof lead)=>r.campusId===lead.campusId&&r.courseId===lead.courseId;
        const attended=(trials.get(lead.sourceId)??[]).filter(r=>same(r)&&r.occurredAt&&Date.parse(r.occurredAt)>=from&&Date.parse(r.occurredAt)<=to);
        if(attended.length)trialAttended++;
        const signed=(contracts.get(lead.sourceId)??[]).filter(r=>same(r)&&Date.parse(String(r.payload.signedAt))>=from&&Date.parse(String(r.payload.signedAt))<=to);
        if(signed.length){converted++;if(signed.some(c=>attended.some(t=>Date.parse(t.occurredAt!)<=Date.parse(String(c.payload.signedAt)))))afterTrial++;else direct++;}
        else if(lead.payload.status==='converted'&&!contracts.has(lead.sourceId))missingLinks++;
    }
    return {leads:leads.length,trialAttended,converted,afterTrial,direct,pending,missingLinks,windowDays:30,complete:pending===0&&missingLinks===0};
}

export class ChannelsService {
    constructor(private education:EducationAnalysisPort,private operations:OperationsService){}
    async query(id:string,scope:AuthorizedScope):Promise<ChannelAnalysis>{const prepared=await this.operations.prepare(id,scope);return this.operations.usesDatabaseAggregation?this.queryPrepared(prepared,scope):this.fromSnapshot(prepared.snapshot,scope);}
    async catalogQuery(id:string,scope:AuthorizedScope){const prepared=await this.operations.prepare(id,scope);if(datasetAnalysisType(prepared.snapshot.dataset)!=='operations')throw new WorkflowError('渠道分析仅适用于独立经营数据集',400);return this.operations.usesDatabaseAggregation?this.operations.catalogPrepared(prepared,scope):this.catalog(prepared.snapshot,scope);}
    async queryPrepared(prepared:PreparedOperations,scope:AuthorizedScope):Promise<ChannelAnalysis>{
        if(datasetAnalysisType(prepared.snapshot.dataset)!=='operations')throw new WorkflowError('渠道分析仅适用于独立经营数据集',400);
        const overall=await this.operations.queryPrepared(prepared,scope),effective=overall.scope,details=await this.operations.queryPreparedDetails(prepared,{...scope,channelIds:[]});
        const attribution=buildChannelAttribution(prepared.snapshot,effective.dataCutoff!),allContexts=buildStudentBusinessFacts(details.snapshot,{...effective,channelIds:[]},details.aggregate.attendance).contexts;
        const options=await this.operations.catalogPrepared(prepared,effective),selected=options.filter(c=>!effective.channelIds.length||effective.channelIds.includes(c.id)),groups:ChannelAnalysis['groups']=[];
        // 控制一次总览的数据库并发；每个范围的汇总只在本次准备快照内复用。
        for(const c of selected){const groupScope={...scope,channelIds:[c.id]},contexts=allContexts.filter(x=>attribution.get(x.studentId,x.campusId,x.courseId).channelId===c.id),analysis=await this.operations.queryPrepared(prepared,groupScope),result=await this.operations.queryPreparedDetails(prepared,groupScope);groups.push({id:c.id,name:c.name,studentCount:new Set(contexts.map(x=>x.studentId)).size,contextCount:contexts.length,analysis,funnel:result.funnel});}
        const unknownContexts=allContexts.filter(x=>attribution.get(x.studentId,x.campusId,x.courseId).status==='unknown'),reasons=new Map<string,number>();for(const c of unknownContexts){const reason=attribution.get(c.studentId,c.campusId,c.courseId).reason;reasons.set(reason,(reasons.get(reason)??0)+1);}
        const refs=[...overall.metrics,...groups.flatMap(g=>g.analysis.metrics)].flatMap(m=>m.evidence);
        return{dataset:overall.dataset,scope:effective,attributionVersion:attribution.version,options,overall,groups,unknown:{studentCount:new Set(unknownContexts.map(c=>c.studentId)).size,contextCount:unknownContexts.length,reasons:[...reasons].map(([reason,contexts])=>({reason,contexts}))},evidence:[...new Map(refs.map(e=>[e.id+'@'+e.version,e])).values()],notes:['招生按线索自身渠道；其他指标按同校区同课程首次有效首购来源，续费沿用。','渠道席位贡献率的分母为所选班级总班额，不应用满班不足预警。','分组人数可能重复，整体人数和比率重新计算。','缺失或冲突来源列为未知；未提供渠道支出，不计算获客成本或ROI。']};
    }
    catalog(snapshot:EducationSnapshot,scope:AuthorizedScope){return channelCatalog(snapshot,scope);}
    fromSnapshot(snapshot:EducationSnapshot,scope:AuthorizedScope):ChannelAnalysis {
        if(datasetAnalysisType(snapshot.dataset)!=='operations')throw new WorkflowError('渠道分析仅适用于独立经营数据集',400);
        const overall=this.operations.fromSnapshot(snapshot,scope);
        const effective=overall.scope,attribution=buildChannelAttribution(snapshot,effective.dataCutoff!),allContexts=buildStudentBusinessFacts(snapshot,{...effective,channelIds:[]}).contexts;
        const options=this.catalog(snapshot,effective),selected=options.filter(c=>!effective.channelIds.length||effective.channelIds.includes(c.id));
        const groups=selected.map(c=>{const groupScope={...effective,channelIds:[c.id],observationCutoff:scope.observationCutoff??scope.dataCutoff??snapshot.dataset.dataCutoff},contexts=allContexts.filter(x=>attribution.get(x.studentId,x.campusId,x.courseId).channelId===c.id);
            return {id:c.id,name:c.name,studentCount:new Set(contexts.map(x=>x.studentId)).size,contextCount:contexts.length,analysis:this.operations.fromSnapshot(snapshot,groupScope),funnel:channelFunnel(snapshot,groupScope)};
        });
        const unknownContexts=allContexts.filter(x=>attribution.get(x.studentId,x.campusId,x.courseId).status==='unknown'),reasons=new Map<string,number>();
        for(const c of unknownContexts){const reason=attribution.get(c.studentId,c.campusId,c.courseId).reason;reasons.set(reason,(reasons.get(reason)??0)+1);}
        const refs=[...overall.metrics,...groups.flatMap(g=>g.analysis.metrics)].flatMap(m=>m.evidence);
        return {dataset:overall.dataset,scope:effective,attributionVersion:attribution.version,options,overall,groups,unknown:{studentCount:new Set(unknownContexts.map(c=>c.studentId)).size,contextCount:unknownContexts.length,reasons:[...reasons].map(([reason,contexts])=>({reason,contexts}))},evidence:[...new Map(refs.map(e=>[e.id+'@'+e.version,e])).values()],notes:['招生按线索自身渠道；其他指标按学员在同校区同课程的首次有效首购来源，续费沿用。','渠道席位贡献率的分母为所选班级总班额，不应用满班不足预警。','同一学员在不同校区课程可归属不同渠道；分组人数可能重复，整体人数和比率重新计算，不累加或平均。','缺失或冲突来源列为未知；未提供渠道支出数据，不计算获客成本或ROI。']};
    }
    async breakdown(id:string,scope:AuthorizedScope){const result=await this.query(id,scope);return result.groups.map(g=>({id:g.id,name:channelName(g.id),analysis:g.analysis}));}
}
