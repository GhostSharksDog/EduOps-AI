import {z} from 'zod';
import type {AuthorizedFinanceScope,AuthorizedScope,EvidenceReference} from '@/shared/contracts/analysis';

export const reviewMetricLabels={attendance_rate:'出勤率',class_fill_rate:'满班率 / 渠道席位贡献率',hours_progress:'课耗进度',admission_conversion:'招生转化率',renewal_rate:'续费率',retention_rate:'学员留存率',complaint_count:'客诉数量',refund_amount:'完成退款金额',revenue:'营业收入',cost:'营业成本',grossProfit:'毛利',grossMargin:'毛利率',selling:'销售费用',sellingRatio:'销售费用率',administrative:'管理费用',administrativeRatio:'管理费用率'} as const;
const reviewMetricCodes=Object.keys(reviewMetricLabels) as [keyof typeof reviewMetricLabels,...(keyof typeof reviewMetricLabels)[]];
export type ReviewMetricCode=keyof typeof reviewMetricLabels;
export const reviewPeriodSchema=z.discriminatedUnion('mode',[
 z.object({mode:z.literal('operations'),startDate:z.iso.date(),endDate:z.iso.date()}).strict().refine(v=>v.startDate<=v.endDate,{message:'复核开始日不能晚于结束日',path:['endDate']}),
 z.object({mode:z.literal('finance'),year:z.number().int().min(2000).max(2100)}).strict(),
]);
export type ReviewPeriod=z.infer<typeof reviewPeriodSchema>;
export const decisionGoalSchema=z.object({code:z.enum(reviewMetricCodes),operator:z.enum(['at_least','at_most']),target:z.number().finite()}).strict();
export type DecisionGoal=z.infer<typeof decisionGoalSchema>;
export const decisionGoalsInputSchema=z.object({targets:z.array(decisionGoalSchema).min(1).max(3),reviewPeriod:reviewPeriodSchema.optional()}).strict().refine(v=>new Set(v.targets.map(t=>t.code)).size===v.targets.length,{message:'目标指标不能重复',path:['targets']});
export type DecisionGoalsInput=z.infer<typeof decisionGoalsInputSchema>;
export interface DecisionGoals extends DecisionGoalsInput {setAt:string;setBy:string;version:'decision-goals-v1';}
export const reviewPreviewInputSchema=z.object({expectedVersion:z.number().int().positive(),period:reviewPeriodSchema.optional()}).strict();
export type ReviewPreviewInput=z.infer<typeof reviewPreviewInputSchema>;
export const quantitativeReviewInputSchema=z.object({period:reviewPeriodSchema,previewToken:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export type QuantitativeReviewInput=z.infer<typeof quantitativeReviewInputSchema>;
export interface ReviewMetricComparison {code:ReviewMetricCode;label:string;unit:string;before:number|null;after:number|null;change:number|null;changeUnit:string;beforeNumerator:number|null;beforeDenominator:number|null;afterNumerator:number|null;afterDenominator:number|null;status:'ready'|'insufficient_data'|'not_applicable';reason:string;goal:DecisionGoal|null;achieved:boolean|null;evidence:EvidenceReference[];baselineVerification?:{status:'matched'|'changed'|'not_recorded';originalValue:number|null;explanation:string};}
export interface QuantitativeReview {
 taskId:string;taskVersion:number;datasetId:string;mode:'operations'|'finance';period:ReviewPeriod;beforeScope:AuthorizedScope|AuthorizedFinanceScope;afterScope:AuthorizedScope|AuthorizedFinanceScope;
 metrics:ReviewMetricComparison[];goals:DecisionGoals|null;recordType:'demonstration'|'actual';
 sourceFingerprints:{before:string;after:string};batchSignature:string;definitionVersion:'decision-review-v1';
 status:'ready'|'insufficient_data';reasons:string[];limitations:string[];evidence:EvidenceReference[];calculatedAt:string;
}
export interface ReviewPreview extends QuantitativeReview {previewToken:string;canConfirm:boolean;}
