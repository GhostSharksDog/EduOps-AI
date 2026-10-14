import {createHash,randomUUID} from 'node:crypto';
import {RISK_PREVIEW_TTL_MS} from '../contracts';
import {WorkflowError} from '@/shared/errors/workflow-error';
import {riskDraftSchema} from '../contracts/risk';
import type {RiskDraftDTO,RiskProposalVO,RiskPreviewVO,PublishedRiskTagVO} from '../contracts/risk';
import {selectRiskMembers,assertPreviewable} from '../domain/risk';
import {evaluateBusinessRule,isAttendanceRule,ruleDescription} from '../domain/business-risk';
import {buildAttendanceFacts,completeKinds,businessFactKinds,buildStudentBusinessFacts,channelAttributionVersion,channelCatalog} from '@/modules/education/contracts';
import type {EducationSnapshot,ImportResultVO,RecordKind} from '@/modules/education/contracts';
import type {AuthorizedScope} from '@/shared/contracts/analysis';
export interface RiskEducationPort {
    snapshot(org:string,id:string,kinds:readonly RecordKind[]):Promise<EducationSnapshot>;
    studentSnapshots?(org:string,id:string,kinds:readonly RecordKind[]):AsyncIterable<EducationSnapshot>;
    inspect(org:string,id:string):Promise<{batches:ImportResultVO[]}>;
}
export interface RiskProposalRepository {
    list(org:string):Promise<RiskProposalVO[]>;
    get(org:string,id:string):Promise<RiskProposalVO>;
    create(org:string,user:string,input:RiskDraftDTO,scope:AuthorizedScope,operationKey?:string):Promise<RiskProposalVO>;
    edit(org:string,id:string,version:number,input:RiskDraftDTO,scope:AuthorizedScope):Promise<RiskProposalVO>;
    savePreview(org:string,id:string,version:number,preview:RiskPreviewVO):Promise<RiskProposalVO>;
    publish(org:string,user:string,id:string,version:number,token:string,validate:(p:RiskProposalVO)=>Promise<void>):Promise<RiskProposalVO>;
    published(org:string,tagId:string):Promise<PublishedRiskTagVO>;
}
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function sourceFingerprint(datasetId:string,batches:readonly ImportResultVO[]):string{
    return digest({datasetId,batches:batches.filter(b=>b.status==='completed').map(b=>({id:b.id,kind:b.kind,rows:b.acceptedRows,hash:b.fileHash})).sort((a,b)=>a.id.localeCompare(b.id))});
}
export class RiskTagService {
    constructor(private repository:RiskProposalRepository,private education:RiskEducationPort){}
    list(org:string){return this.repository.list(org);}
    get(org:string,id:string){return this.repository.get(org,id);}
    published(org:string,tagId:string){return this.repository.published(org,tagId);}
    async create(org:string,user:string,raw:RiskDraftDTO,operationKey?:string){
        const input=riskDraftSchema.parse(raw);await this.education.inspect(org,input.datasetId);
        return this.repository.create(org,user,input,{...input.scope,organizationId:org,authorizedCampusIds:[]},operationKey);
    }
    async edit(org:string,id:string,version:number,raw:RiskDraftDTO){
        const input=riskDraftSchema.parse(raw);await this.education.inspect(org,input.datasetId);
        return this.repository.edit(org,id,version,input,{...input.scope,organizationId:org,authorizedCampusIds:[]});
    }
    async preview(org:string,id:string,version:number){
        const proposal=await this.repository.get(org,id);
        if(proposal.version!==version||proposal.status==='published')throw new WorkflowError('草稿已变化或已发布，请刷新后操作');
        const legacy=isAttendanceRule(proposal.rule);
        const chunks=this.education.studentSnapshots?.(org,proposal.datasetId,businessFactKinds)??(async function*(education:RiskEducationPort){yield await education.snapshot(org,proposal.datasetId,businessFactKinds);})(this.education);
        let snapshot:EducationSnapshot|undefined,scope:AuthorizedScope|undefined,observedCount=0,unknownStudentCount=0;
        const members:RiskPreviewVO['members']=[],catalog=new Map<string,{id:string;kind:string;name:string}>();
        let evaluation:RiskPreviewVO['evaluation'];
        for await(const chunk of chunks){
        snapshot=chunk;
        if(proposal.scope.channelIds.length&&!completeKinds(snapshot,['lead','contract','renewal']))throw new WorkflowError('渠道归属所需线索、合约或续费记录尚未完整导入，请完成数据接入后重新预览',400,'CHANNEL_DATA_INCOMPLETE');
        if(legacy)assertPreviewable(snapshot,completeKinds(snapshot,['student','class','enrollment','lesson','attendance']));
        else {
            if(snapshot.dataset.origin!=='simulated')throw new WorkflowError('当前运营规则需要教培业务数据，公开学习点击数据不适用',400);
            if(snapshot.batches.some(b=>['running','validating'].includes(b.status)))throw new WorkflowError('数据正在导入，请完成后重新预览');
            if(!completeKinds(snapshot,['student','campus','course']))throw new WorkflowError('学员、校区及课程数据尚未完整导入',400);
        }
        const business=legacy?null:evaluateBusinessRule(snapshot,proposal.scope,proposal.rule),facts=business?.attendance??buildAttendanceFacts(snapshot,proposal.scope);
        const legacyBusiness=legacy?buildStudentBusinessFacts(snapshot,proposal.scope):null;
        members.push(...(business?.members??selectRiskMembers(facts.students,proposal.rule as Extract<RiskDraftDTO['rule'],{type:'absence_count'|'attendance_below'}>).map(m=>({...m,business:legacyBusiness!.contexts.filter(c=>c.studentId===m.studentId)}))));
        scope=facts.scope;observedCount+=business?business.evaluation.matched+business.evaluation.unmatched+business.evaluation.unknown:facts.students.length;
        unknownStudentCount+=business?.evaluation.unknown??facts.students.filter(s=>s.unknown>0).length;
        if(business){if(!evaluation)evaluation={matched:0,unmatched:0,unknown:0,conditions:business.evaluation.conditions.map(c=>({...c,matched:0,unknown:0}))};
            evaluation.matched+=business.evaluation.matched;evaluation.unmatched+=business.evaluation.unmatched;evaluation.unknown+=business.evaluation.unknown;
            business.evaluation.conditions.forEach((c,i)=>{evaluation!.conditions[i].matched+=c.matched;evaluation!.conditions[i].unknown+=c.unknown;});}
        for(const c of [...snapshot.records.filter(r=>['campus','course'].includes(r.kind)).map(r=>({id:r.sourceId,kind:r.kind,name:String(r.payload.name)})),...channelCatalog(snapshot,facts.scope).map(c=>({...c,kind:'channel'}))])catalog.set(c.kind+':'+c.id,c);
        }
        if(!snapshot||!scope)throw new WorkflowError('未获取到业务数据，请检查导入状态',400);
        if(legacy&&!observedCount)throw new WorkflowError('所选范围没有应出勤记录，无法判断出勤风险；请调整日期、校区或课程',400);
        const source=sourceFingerprint(snapshot.dataset.id,snapshot.batches),latest=await this.education.inspect(org,proposal.datasetId);
        if(latest.batches.some(b=>['running','validating'].includes(b.status))||sourceFingerprint(proposal.datasetId,latest.batches)!==source)throw new WorkflowError('计算期间数据批次已变化，请重新预览',409,'BATCH_CHANGED');
        members.sort((a,b)=>a.studentId.localeCompare(b.studentId));
        const preview:RiskPreviewVO={token:randomUUID(),fingerprint:digest({rule:proposal.rule,version,scope,source,channelAttributionVersion,members}),sourceFingerprint:source,
            scope,dataset:snapshot.dataset,ruleVersion:version,calculatorVersion:legacy?'attendance-v1':'business-rules-v1',channelAttributionVersion,memberCount:members.length,observedCount,unknownStudentCount,members,rule:proposal.rule,evaluation,
            evidence:[{id:snapshot.dataset.id,kind:'metric',sourceId:snapshot.dataset.id,version:source+'/'+channelAttributionVersion,summary:ruleDescription(proposal.rule)+'；取消课次及退班后课次排除，未知不充当缺勤；业务事实仅使用截止日前数据；渠道绑定同校区同课程首次有效首购。',scope,updatedAt:scope.dataCutoff!}],
            batches:snapshot.batches.filter(b=>b.status==='completed').map(({id,kind,acceptedRows,fileHash})=>({id,kind,acceptedRows,fileHash})),
            catalog:[...catalog.values()],createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+RISK_PREVIEW_TTL_MS).toISOString()};
        return this.repository.savePreview(org,id,version,preview);
    }
    confirm(org:string,user:string,id:string,version:number,token:string){
        return this.repository.publish(org,user,id,version,token,async p=>{
            if(p.scope.channelIds.length&&p.preview!.channelAttributionVersion!==channelAttributionVersion)throw new WorkflowError('渠道归属计算版本已变化，请重新预览后确认',409,'PREVIEW_EXPIRED');
            const {batches}=await this.education.inspect(org,p.datasetId);
            if(batches.some(b=>['running','validating'].includes(b.status))||sourceFingerprint(p.datasetId,batches)!==p.preview!.sourceFingerprint)
                throw new WorkflowError('数据批次已变化或正在导入，请重新预览后确认',409,'BATCH_CHANGED');
        });
    }
}
