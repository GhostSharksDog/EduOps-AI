import type {RiskSegmentSnapshotVO} from '@/modules/segment/contracts';
import {filterRiskSnapshots} from '@/modules/segment/contracts';
import type {RiskSnapshotFilter,SnapshotPageInput,RiskSnapshotPage,RiskSnapshotAggregate} from '@/modules/segment/contracts';
import {riskCrowdProfile,riskStudentProfile,riskCrowdFromAggregate} from '../domain/risk-profile';
export interface RiskProfileSnapshotPort {list(org:string):Promise<RiskSegmentSnapshotVO[]>;get(org:string,id:string):Promise<RiskSegmentSnapshotVO>;summaries?(org:string):Promise<RiskSegmentSnapshotVO[]>;page?(org:string,id:string,input:SnapshotPageInput):Promise<RiskSnapshotPage>;member?(org:string,id:string,studentId:string):Promise<RiskSegmentSnapshotVO>;aggregate?(org:string,id:string):Promise<RiskSnapshotAggregate|null>;}
export class RiskProfileService {
    constructor(private snapshots:RiskProfileSnapshotPort){}
    async list(org:string,filter:RiskSnapshotFilter={}){return filterRiskSnapshots(await this.snapshots.list(org),filter);}
    async summaries(org:string,filter:RiskSnapshotFilter={}){return filterRiskSnapshots(await (this.snapshots.summaries?.(org)??this.snapshots.list(org)),filter);}
    async query(org:string,snapshotId:string,entityId?:string,pagination?:SnapshotPageInput){
        if(entityId){const snapshot=await (this.snapshots.member?.(org,snapshotId,entityId)??this.snapshots.get(org,snapshotId));return riskStudentProfile(snapshot,entityId);}
        if(pagination&&this.snapshots.page&&this.snapshots.aggregate){const [page,aggregate]=await Promise.all([this.snapshots.page(org,snapshotId,pagination),this.snapshots.aggregate(org,snapshotId)]);if(aggregate)return {...riskCrowdFromAggregate(page.snapshot,aggregate),pagination:page.pagination};}
        const snapshot=await this.snapshots.get(org,snapshotId);return riskCrowdProfile(snapshot);
    }
}
