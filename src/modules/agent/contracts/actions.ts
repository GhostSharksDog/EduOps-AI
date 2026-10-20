import {z} from 'zod';
import type {AuthorizedAnalysisScope,EvidenceReference} from '@/shared/contracts/analysis';
import type {OperationalTagRuleDTO} from '@/modules/tag/contracts';

export const actionTaskInputSchema=z.object({
 action:z.string().trim().min(1).max(4000),ownerId:z.uuid().optional(),
 priority:z.enum(['high','normal','low']).default('normal'),dueDate:z.iso.date(),
 reviewMethod:z.string().trim().min(1).max(2000),recommendationIndex:z.number().int().min(0).max(100).default(0),
}).strict();
export type ActionTaskInput=z.infer<typeof actionTaskInputSchema>;
export const prepareFollowupSchema=z.object({proposalId:z.uuid(),version:z.number().int().positive(),segmentName:z.string().trim().min(1).max(120).optional(),task:actionTaskInputSchema.optional(),sourceRunId:z.uuid().optional()}).strict().refine(v=>!v.task||!!v.segmentName,{message:'关联跟进任务前请填写保存人群名称'});
export const prepareReportSchema=z.object({kind:z.enum(['weekly','monthly']),anchorDate:z.iso.date()}).strict();
export const prepareDecisionSchema=z.object({task:actionTaskInputSchema,sourceRunId:z.uuid().optional()}).strict();
export const confirmActionPlanSchema=z.object({runId:z.uuid(),planId:z.uuid(),version:z.number().int().positive(),requestKey:z.uuid()}).strict();
export const editActionPlanSchema=z.object({runId:z.uuid(),planId:z.uuid(),version:z.number().int().positive(),segmentName:z.string().trim().min(1).max(120).optional(),task:actionTaskInputSchema.optional(),report:prepareReportSchema.optional()}).strict().refine(v=>!!v.segmentName||!!v.task||!!v.report,{message:'请提供需要修改的计划内容'});
export type ConfirmActionPlanInput=z.infer<typeof confirmActionPlanSchema>;
export type EditActionPlanInput=z.infer<typeof editActionPlanSchema>;
export type ActionPlanStatus='prepared'|'executing'|'partially_failed'|'completed'|'invalid';
export type ActionStepStatus='pending'|'running'|'completed'|'failed';
export type ActionStepInput=
 | {kind:'publish_tag';proposalId:string;version:number;previewToken:string;previewFingerprint:string;sourceFingerprint:string}
 | {kind:'save_segment';publishStepId:string;name:string}
 | {kind:'create_decision_task';sourceRunId:string;task:ActionTaskInput;ownerName?:string;segmentStepId?:string}
 | {kind:'generate_report';kindOfReport:'weekly'|'monthly';anchorDate:string};
export interface ActionResultVO {id:string;url:string;label:string;reused?:boolean;}
export interface ActionPlanStepVO {
 id:string;kind:ActionStepInput['kind'];title:string;input:ActionStepInput;status:ActionStepStatus;
 result?:ActionResultVO;errorCode?:string;errorMessage?:string;
}
export interface ActionPlanVO {
 id:string;version:number;runId:string;datasetId:string;scope:AuthorizedAnalysisScope;status:ActionPlanStatus;
 steps:ActionPlanStepVO[];evidence:EvidenceReference[];sourceFingerprint:string;
 preview?:{proposalId:string;version:number;name:string;rule:OperationalTagRuleDTO;memberCount:number;unknownCount:number;expiresAt:string};
 createdAt:string;updatedAt:string;expiresAt?:string;errorCode?:string;errorMessage?:string;
 /** Internal claim metadata is persisted with the plan, and omitted from model payloads. */
 execution?:{attemptId:string;startedAt:string;leaseUntil:string;confirmedBy:string;requestKey:string};
}
export const actionKindLabels:Record<ActionStepInput['kind'],string>={publish_tag:'发布标签',save_segment:'保存人群',create_decision_task:'建立跟进任务',generate_report:'生成报告'};
