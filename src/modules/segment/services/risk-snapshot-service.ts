import type {CreateRiskSegmentDTO,RiskSegmentRepository,RiskSegmentSourcePort} from '../contracts/risk-snapshot';
import {createRiskSegmentSchema,filterRiskSnapshots} from '../contracts/risk-snapshot';
import type {RiskSnapshotFilter,SnapshotPageInput} from '../contracts/risk-snapshot';
import {snapshotPageSchema} from '../contracts/risk-snapshot';
import {WorkflowError} from '@/shared/errors/workflow-error';
export class RiskSegmentService {
    constructor(private repository:RiskSegmentRepository,private tags:RiskSegmentSourcePort){}
    async list(org:string,filter:RiskSnapshotFilter={}){return filterRiskSnapshots(await this.repository.list(org),filter);}
    async summaries(org:string,filter:RiskSnapshotFilter={}){return filterRiskSnapshots(await (this.repository.summaries?.(org)??this.repository.list(org)),filter);}
    get(org:string,id:string){return this.repository.get(org,id);}
    async page(org:string,id:string,raw:SnapshotPageInput){const input=snapshotPageSchema.parse(raw);if(this.repository.page)return this.repository.page(org,id,input);const full=await this.repository.get(org,id),offset=(input.page-1)*input.pageSize;return {snapshot:{...full,preview:{...full.preview,members:full.preview.members.slice(offset,offset+input.pageSize)}},pagination:{...input,total:full.memberCount,hasNext:offset+input.pageSize<full.memberCount}};}
    member(org:string,id:string,studentId:string){return this.repository.member?.(org,id,studentId)??this.repository.get(org,id);}
    aggregate(org:string,id:string){return this.repository.aggregate?.(org,id)??Promise.resolve(null);}
    async create(org:string,user:string,raw:CreateRiskSegmentDTO){
        const input=createRiskSegmentSchema.parse(raw),source=await this.tags.published(org,input.tagId);
        if(source.version!==input.tagVersion||source.preview.fingerprint!==input.previewFingerprint)throw new WorkflowError('标签版本或计算依据已变化，请刷新后确认建立人群');
        return this.repository.create(org,user,input,source);
    }
}
