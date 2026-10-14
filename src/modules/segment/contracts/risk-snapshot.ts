import {z} from 'zod';
import {analysisScopeSchema} from '@/shared/contracts/analysis';
import {sameAnalysisRange} from '@/shared/lib/analysis-navigation';
import type {PublishedRiskTagVO,RiskPreviewVO} from '@/modules/tag/contracts';
export const createRiskSegmentSchema=z.object({tagId:z.uuid(),tagVersion:z.number().int().positive(),previewFingerprint:z.string().regex(/^[a-f0-9]{64}$/),name:z.string().trim().min(1).max(120)}).strict();
export type CreateRiskSegmentDTO=z.infer<typeof createRiskSegmentSchema>;
export const riskSnapshotFilterSchema=z.object({datasetId:z.uuid().optional(),scope:analysisScopeSchema.optional(),sourceTagId:z.uuid().optional(),tagVersion:z.coerce.number().int().positive().optional()}).strict();
export type RiskSnapshotFilter=z.infer<typeof riskSnapshotFilterSchema>;
export function parseSnapshotFilter(params:URLSearchParams):RiskSnapshotFilter {
 const raw=params.get('scope');let scope:unknown;try{scope=raw?JSON.parse(raw):undefined;}catch{scope=null;}
 return riskSnapshotFilterSchema.parse({...(params.get('datasetId')?{datasetId:params.get('datasetId')}:{}),...(raw?{scope}:{}),...(params.get('sourceTagId')?{sourceTagId:params.get('sourceTagId')}:{}),...(params.get('tagVersion')?{tagVersion:params.get('tagVersion')}:{})});
}
export function filterRiskSnapshots(rows:RiskSegmentSnapshotVO[],filter:RiskSnapshotFilter={}){return rows.filter(s=>(!filter.datasetId||s.datasetId===filter.datasetId)&&(!filter.sourceTagId||s.sourceTagId===filter.sourceTagId)&&(!filter.tagVersion||s.tagVersion===filter.tagVersion)&&(!filter.scope||sameAnalysisRange(s.preview.scope,filter.scope)));}
export interface RiskSegmentSnapshotVO {id:string;segmentId:string;sourceTagId:string;tagVersion:number;datasetId:string;name:string;memberCount:number;createdAt:string;preview:RiskPreviewVO;}
export const snapshotPageSchema=z.object({page:z.coerce.number().int().min(1).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(20)}).strict();
export type SnapshotPageInput=z.infer<typeof snapshotPageSchema>;
export interface SnapshotPageInfo extends SnapshotPageInput {total:number;hasNext:boolean;}
export interface RiskSnapshotPage {snapshot:RiskSegmentSnapshotVO;pagination:SnapshotPageInfo;}
/** Frozen aggregate facts are produced inside PostgreSQL; no complete member array crosses the database boundary. */
export interface RiskSnapshotAggregate {
 attendance:{present:number;due:number;absent:number;leave:number;unknown:number;observedStudents:number};
 hasBusiness:boolean;asOf:string;knownBalanceStudents:number;unknownBalanceStudents:number;remainingHours:number|null;
 renewalFollowupStudents:number|null;recentComplaintStudents:number|null;upcomingCount:number;complainedCount:number;
 distributions:{key:string;values:{label:string;count:number}[]}[];
}
export interface RiskSegmentSourcePort {published(org:string,id:string):Promise<PublishedRiskTagVO>;}
export interface RiskSegmentRepository {
    list(org:string):Promise<RiskSegmentSnapshotVO[]>;
    get(org:string,id:string):Promise<RiskSegmentSnapshotVO>;
    summaries?(org:string):Promise<RiskSegmentSnapshotVO[]>;
    page?(org:string,id:string,input:SnapshotPageInput):Promise<RiskSnapshotPage>;
    member?(org:string,id:string,studentId:string):Promise<RiskSegmentSnapshotVO>;
    aggregate?(org:string,id:string):Promise<RiskSnapshotAggregate>;
    create(org:string,user:string,input:CreateRiskSegmentDTO,source:PublishedRiskTagVO):Promise<RiskSegmentSnapshotVO>;
}
