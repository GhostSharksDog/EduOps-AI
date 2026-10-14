import {z} from 'zod';
import type {OperationalAnalysis} from '@/modules/analytics/contracts';
import type {AgentAnswerVO,AgentFactVO} from '@/modules/agent/contracts';
import type {EvidenceReference} from '@/shared/contracts/analysis';
export const reportInputSchema=z.object({datasetId:z.uuid(),kind:z.enum(['weekly','monthly']),anchorDate:z.iso.date(),campusIds:z.array(z.string().min(1).max(100)).max(100).default([]),courseIds:z.array(z.string().min(1).max(100)).max(100).default([]),channelIds:z.array(z.string().min(1).max(100)).max(100).default([]),dataCutoff:z.iso.datetime({offset:true}).optional(),requestKey:z.uuid()}).strict();
export interface ReportEvaluationContext {
 version:'evaluation-input-v1';model:string;promptVersion:string;systemPrompt:string;
 facts:AgentFactVO[];knowledge:{title:string;text:string;evidence:EvidenceReference}[];
 inputs:{messages:unknown[];tools:unknown[];json:boolean}[];
}
export type ReportInput=z.infer<typeof reportInputSchema>;
export interface ReportStep {tool:string;status:'completed';evidenceIds:string[];}
export interface ReportVO {id:string;datasetId:string;kind:'weekly'|'monthly';status:'generating'|'completed'|'failed';snapshot:OperationalAnalysis & {evaluationContext?:ReportEvaluationContext};facts:AgentFactVO[];answer:AgentAnswerVO|null;evidence:EvidenceReference[];steps:ReportStep[];errorMessage:string|null;createdAt:string;completedAt:string|null;}
