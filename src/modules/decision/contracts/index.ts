import {z} from 'zod';
import type {AuthorizedScope,AuthorizedFinanceScope,EvidenceReference} from '@/shared/contracts/analysis';
import type {AgentAnswerVO} from '@/modules/agent/contracts';
import {decisionGoalsInputSchema,quantitativeReviewInputSchema,type DecisionGoals,type QuantitativeReview} from './review';
export * from './review';
export const sourceSchema=z.object({kind:z.enum(['agent','report']),id:z.uuid(),index:z.number().int().min(0).max(100)}).strict();
export type RecommendationSource=z.infer<typeof sourceSchema>;
export const decisionCreateSchema=z.object({source:sourceSchema,requestKey:z.uuid(),disposition:z.enum(['accepted','deferred','rejected']),action:z.string().trim().min(1).max(4000),ownerId:z.uuid().optional(),priority:z.enum(['high','normal','low']),dueDate:z.iso.date(),reviewMethod:z.string().trim().min(1).max(2000),segmentSnapshotId:z.uuid().optional(),recordType:z.enum(['demonstration','actual']).default('demonstration'),goals:decisionGoalsInputSchema.optional()}).strict();
export type DecisionCreate=z.infer<typeof decisionCreateSchema>;
export const decisionStates=['accepted','deferred','rejected','executing','review_pending','completed'] as const;
export type DecisionState=typeof decisionStates[number];
export const decisionUpdateSchema=z.object({requestKey:z.uuid(),expectedVersion:z.number().int().positive(),state:z.enum(decisionStates).optional(),kind:z.enum(['adoption','execution','review']),note:z.string().trim().min(1).max(4000),reviewResult:z.string().trim().min(1).max(4000).optional(),adoptionIntention:z.enum(['yes','maybe','no']).optional(),quantitativeReview:quantitativeReviewInputSchema.optional()}).strict().superRefine((v,ctx)=>{if(v.state==='completed'&&(v.kind!=='review'||!v.reviewResult))ctx.addIssue({code:'custom',message:'完成任务必须提交复核结论'});if(v.quantitativeReview&&(v.kind!=='review'||v.state!=='completed'))ctx.addIssue({code:'custom',message:'量化复核只能在页面完成复核时确认'});});
export type DecisionUpdate=z.infer<typeof decisionUpdateSchema>;
export interface RecommendationVO {key:string;source:RecommendationSource;datasetId:string;scope:AuthorizedScope|AuthorizedFinanceScope;recommendation:string;answer:AgentAnswerVO;evidence:EvidenceReference[];createdAt:string;dataOrigin:'simulated'|'public';analysisType:'operations'|'finance';taskId?:string;}
export interface DecisionFeedback {id:string;kind:DecisionUpdate['kind'];note:string;reviewResult?:string;adoptionIntention?:'yes'|'maybe'|'no';quantitativeReview?:QuantitativeReview|null;from:DecisionState;to:DecisionState;version:number;createdBy:string;createdAt:string;}
export interface DecisionTask {id:string;datasetId:string;source:RecommendationSource;sourceSnapshot:RecommendationVO;action:string;ownerId:string;ownerName:string;createdBy:string;priority:DecisionCreate['priority'];dueDate:string;reviewMethod:string;segmentSnapshotId:string|null;recordType:'demonstration'|'actual';goals?:DecisionGoals|null;state:DecisionState;version:number;createdAt:string;updatedAt:string;feedback:DecisionFeedback[];}
export const stateLabels:Record<DecisionState,string>={accepted:'已采纳 · 待执行',deferred:'暂缓',rejected:'不采纳',executing:'执行中',review_pending:'待复核',completed:'已复核'};
