import {z} from 'zod';
import {analysisScopeSchema} from '@/shared/contracts/analysis';
import type {AuthorizedScope,EvidenceReference} from '@/shared/contracts/analysis';
import type {DatasetVO,StudentAttendanceVO,ImportResultVO} from '@/modules/education/contracts';
import type {StudentBusinessContext} from '@/modules/education/contracts';
export const RISK_PREVIEW_TTL_MS=30*60*1000;
export function previewExpiry(preview:Pick<RiskPreviewVO,'createdAt'|'expiresAt'>){const derived=Date.parse(preview.createdAt)+RISK_PREVIEW_TTL_MS,explicit=Date.parse(preview.expiresAt??'');const at=Number.isFinite(explicit)?Math.min(derived,explicit):derived;return Number.isFinite(at)?new Date(at).toISOString():'';}
export const attendanceRiskRuleSchema=z.discriminatedUnion('type',[
    z.object({type:z.literal('absence_count'),minimumAbsences:z.number().int().min(1).max(1000),minimumDue:z.number().int().min(1).max(1000)}).strict(),
    z.object({type:z.literal('attendance_below'),thresholdPercent:z.number().min(0).max(100),minimumDue:z.number().int().min(1).max(1000)}).strict(),
]);
export type AttendanceRiskRuleDTO=z.infer<typeof attendanceRiskRuleSchema>;
export const operationalLeafRuleSchema=z.discriminatedUnion('type',[
    ...attendanceRiskRuleSchema.options,
    z.object({type:z.literal('renewal_due'),withinDays:z.number().int().min(1).max(90)}).strict(),
    z.object({type:z.literal('hours_remaining'),maximumHours:z.number().positive().max(100)}).strict(),
    z.object({type:z.literal('recent_complaint'),lookbackDays:z.number().int().min(1).max(90),minimumCount:z.number().int().min(1).max(100)}).strict(),
]);
export const operationalTagRuleSchema=z.discriminatedUnion('type',[
    ...operationalLeafRuleSchema.options,
    z.object({type:z.literal('all'),conditions:z.array(operationalLeafRuleSchema).min(2).max(5)}).strict(),
    z.object({type:z.literal('any'),conditions:z.array(operationalLeafRuleSchema).min(2).max(5)}).strict(),
]);
export type OperationalLeafRuleDTO=z.infer<typeof operationalLeafRuleSchema>;
export type OperationalTagRuleDTO=z.infer<typeof operationalTagRuleSchema>;
export interface RuleMatch {condition:string;state:'true'|'false'|'unknown';reason:string;campusId:string;courseId:string;}
export interface OperationalTagMember extends Partial<StudentAttendanceVO> {studentId:string;displayName:string;gradeBand:string;campusIds:string[];courseIds:string[];reason:string;business?:StudentBusinessContext[];matches?:RuleMatch[];}
export const riskDraftSchema=z.object({datasetId:z.uuid(),name:z.string().trim().min(1).max(120),scope:analysisScopeSchema,rule:operationalTagRuleSchema}).strict();
export type RiskDraftDTO=z.infer<typeof riskDraftSchema>;
export const draftVersionSchema=z.object({version:z.number().int().positive()}).strict();
export const confirmRiskSchema=z.object({version:z.number().int().positive(),previewToken:z.uuid()}).strict();
export interface RiskPreviewVO {
    token:string;fingerprint:string;sourceFingerprint:string;scope:AuthorizedScope;dataset:DatasetVO;
    ruleVersion:number;calculatorVersion:'attendance-v1'|'business-rules-v1';channelAttributionVersion?:string;memberCount:number;observedCount:number;unknownStudentCount:number;
    members:OperationalTagMember[];evidence:EvidenceReference[];rule?:OperationalTagRuleDTO;
    evaluation?:{matched:number;unmatched:number;unknown:number;conditions:{condition:string;matched:number;unknown:number}[]};
    batches:Pick<ImportResultVO,'id'|'kind'|'acceptedRows'|'fileHash'>[];
    catalog:{id:string;kind:string;name:string}[];createdAt:string;expiresAt?:string;
}
export interface RiskProposalVO {
    id:string;datasetId:string;name:string;scope:AuthorizedScope;rule:OperationalTagRuleDTO;version:number;
    status:'draft'|'awaiting_confirmation'|'published';preview:RiskPreviewVO|null;
    publishedTagId:string|null;createdAt:string;updatedAt:string;
}
export interface PublishedRiskTagVO {tagId:string;name:string;proposalId:string;rule:OperationalTagRuleDTO;version:number;preview:RiskPreviewVO;}
