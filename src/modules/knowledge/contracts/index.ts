import {z} from 'zod';
import {analysisScopeSchema} from '@/shared/contracts/analysis';
import type {AuthorizedAnalysisScope,CapabilityResult,EvidenceReference} from '@/shared/contracts/analysis';

export const knowledgeKinds=['definition','procedure','analysis_snapshot','reviewed_case'] as const;
export type KnowledgeKind=typeof knowledgeKinds[number];
export type KnowledgeReviewStatus='draft'|'approved'|'superseded';
export type KnowledgeIndexStatus='pending'|'indexing'|'ready'|'failed';
const periodSchema=z.object({startDate:z.iso.date(),endDate:z.iso.date()}).strict().refine(v=>v.startDate<=v.endDate,{message:'开始日期不能晚于结束日期'});
const evidenceSchema=z.object({id:z.string().min(1),kind:z.enum(['metric','knowledge','tag','segment']),sourceId:z.string().min(1),version:z.string().min(1),summary:z.string().trim().min(1).max(4000),scope:analysisScopeSchema.optional(),updatedAt:z.iso.datetime()}).strict();
export const createKnowledgeSourceSchema=z.object({
 title:z.string().trim().min(1).max(160),kind:z.enum(knowledgeKinds),content:z.string().trim().min(1).max(20000),
 reportId:z.uuid().optional(),logicalSourceId:z.uuid().optional(),expectedVersion:z.number().int().positive().optional(),
 period:periodSchema.optional(),dataCutoff:z.iso.datetime().optional(),evidence:z.array(evidenceSchema).max(20).default([]),
}).strict().superRefine((v,ctx)=>{
 if(v.reportId&&v.kind!=='analysis_snapshot')ctx.addIssue({code:'custom',message:'报告仅用于历史分析摘要',path:['reportId']});
 if(Boolean(v.logicalSourceId)!==Boolean(v.expectedVersion))ctx.addIssue({code:'custom',message:'新版本必须绑定来源及预期版本',path:['expectedVersion']});
 if(v.kind==='analysis_snapshot'&&!v.reportId&&(!v.period||!v.dataCutoff||!v.evidence.length))ctx.addIssue({code:'custom',message:'分析摘要必须提供统计周期、数据截止时间及数据依据',path:['period']});
});
export const reviseKnowledgeSourceSchema=z.object({title:z.string().trim().min(1).max(160),content:z.string().trim().min(1).max(20000),expectedContentHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export const approveKnowledgeSourceSchema=z.object({expectedVersion:z.number().int().positive(),expectedContentHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export const searchKnowledgeSchema=z.object({query:z.string().trim().min(1).max(1000),scope:analysisScopeSchema.optional(),limit:z.number().int().min(1).max(5).optional(),includeSnapshots:z.boolean().optional()}).strict();
export type CreateKnowledgeSourceDTO=z.infer<typeof createKnowledgeSourceSchema>;
export type ReviseKnowledgeSourceDTO=z.infer<typeof reviseKnowledgeSourceSchema>;
export type ApproveKnowledgeSourceDTO=z.infer<typeof approveKnowledgeSourceSchema>;
export type SearchKnowledgeDTO=z.infer<typeof searchKnowledgeSchema>;
export interface KnowledgeSource {
 id:string;logicalSourceId:string;title:string;kind:KnowledgeKind;organizationId:string;version:string;content:string;contentHash:string;
 status:KnowledgeReviewStatus;isCurrent:boolean;indexStatus:KnowledgeIndexStatus;embeddingModel:string|null;embeddingDimensions:number|null;
 updatedAt:string;createdAt:string;approvedAt:string|null;indexedAt:string|null;needsReindex?:boolean;period?:{startDate:string;endDate:string};dataCutoff?:string;evidence:EvidenceReference[];error:string|null;
}
export interface KnowledgeChunk {id:string;sourceId:string;version:string;text:string;embeddingModel:string;embeddingDimensions:number;}
export interface KnowledgeSearchHitVO {id:string;sourceId:string;logicalSourceId:string;version:string;title:string;kind:KnowledgeKind;text:string;similarity:number;evidence:EvidenceReference;}
export interface KnowledgeSearchResultVO {query:string;hits:KnowledgeSearchHitVO[];}
export interface KnowledgeSearchOptions {limit?:number;minSimilarity?:number;includeSnapshots?:boolean;signal?:AbortSignal;}
export interface KnowledgeService {search(query:string,scope:AuthorizedAnalysisScope,options?:KnowledgeSearchOptions):Promise<CapabilityResult<KnowledgeSearchResultVO>>;}
export interface KnowledgeCapabilityVO {sourceManagement:'ready'|'error';embeddingConfigured:boolean;currentSources:number;needsReindex:number;}
