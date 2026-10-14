import {z} from 'zod';
import {analysisScopeSchema} from '@/shared/contracts/analysis';
import type {OperationalAnalysis} from '@/modules/analytics/contracts';
export const alertEvaluationSchema=z.object({datasetId:z.uuid(),scope:analysisScopeSchema}).strict();
export const alertUpdateSchema=z.object({version:z.number().int().positive(),state:z.enum(['acknowledged','resolved']),note:z.string().trim().max(1000).default('')}).strict();
export type AlertEvaluationDTO=z.infer<typeof alertEvaluationSchema>;
export type AlertUpdateDTO=z.infer<typeof alertUpdateSchema>;
export const alertRuleIds=['attendance_drop','low_fill','low_renewal'] as const;
export type AlertRuleId=typeof alertRuleIds[number];
export const alertRuleLabels:Record<AlertRuleId,string>={attendance_drop:'出勤率下降',low_fill:'满班率不足',low_renewal:'续费率偏低'};
export const alertRuleOptionsSchema=z.object({enabled:z.boolean(),threshold:z.number().finite().min(0).max(100),minimumSample:z.number().int().min(1).max(10000000)}).strict();
export const alertRulesSchema=z.object({attendance_drop:alertRuleOptionsSchema,low_fill:alertRuleOptionsSchema,low_renewal:alertRuleOptionsSchema}).strict();
export type AlertRules=z.infer<typeof alertRulesSchema>;
export const alertRulesUpdateSchema=z.object({expectedVersion:z.number().int().positive(),rules:alertRulesSchema,note:z.string().trim().min(1).max(1000)}).strict();
export type AlertRulesUpdateDTO=z.infer<typeof alertRulesUpdateSchema>;
export interface AlertRuleConfiguration {version:number;rules:AlertRules;updatedAt:string|null;updatedBy:string|null;note:string;source:'default'|'published';}
export interface AlertRuleSettings {current:AlertRuleConfiguration;history:AlertRuleConfiguration[];}
export const defaultAlertRules:AlertRules={attendance_drop:{enabled:true,threshold:5,minimumSample:20},low_fill:{enabled:true,threshold:60,minimumSample:20},low_renewal:{enabled:true,threshold:60,minimumSample:10}};
export const defaultAlertConfiguration=():AlertRuleConfiguration=>({version:1,rules:structuredClone(defaultAlertRules),updatedAt:null,updatedBy:null,note:'模拟演示初始阈值；可由管理员发布新版本',source:'default'});
export interface AlertHit {rule:AlertRuleId;title:string;value:number;baseline:number|null;threshold:number;denominator:number;description:string;ruleConfiguration?:AlertRuleConfiguration;}
export interface AlertVO extends AlertHit {id:string;datasetId:string;scopeKey:string;fingerprint:string;state:'open'|'acknowledged'|'resolved';active:boolean;version:number;note:string;createdAt:string;updatedAt:string;snapshot:OperationalAnalysis;}
export interface AlertRuleOutcome {rule:AlertRuleId;state:'hit'|'clear'|'skipped'|'disabled';reason:string;}
export interface AlertEvaluation {alerts:AlertVO[];skipped:{rule:AlertHit['rule'];reason:string}[];snapshot:OperationalAnalysis;configuration?:AlertRuleConfiguration;outcomes?:AlertRuleOutcome[];computeDurationMs?:number;}
const expectedLabelSchema=z.object({attendance_drop:z.boolean().nullable(),low_fill:z.boolean().nullable(),low_renewal:z.boolean().nullable()}).strict();
export const alertReplaySchema=z.object({datasetId:z.uuid(),scope:analysisScopeSchema,cases:z.array(z.object({id:z.string().trim().min(1).max(80),name:z.string().trim().min(1).max(120),startDate:z.iso.date(),endDate:z.iso.date(),expected:expectedLabelSchema.optional(),labelNote:z.string().trim().max(1000).default('')}).strict().refine(c=>c.startDate<=c.endDate,{message:'回放开始日期不能晚于结束日期'}).refine(c=>!c.expected||!Object.values(c.expected).some(v=>typeof v==='boolean')||c.labelNote.length>0,{message:'人工标注须填写独立判断依据，不能仅以规则输出作为标准答案'})).min(1).max(12)}).strict().refine(i=>new Set(i.cases.map(c=>c.id)).size===i.cases.length,{message:'回放场景编号不能重复'});
export type AlertReplayDTO=z.infer<typeof alertReplaySchema>;
export interface AlertConfusion {truePositive:number;falsePositive:number;falseNegative:number;trueNegative:number;unlabelled:number;unavailable:number;precision:number|null;recall:number|null;}
export interface AlertReplayCase {id:string;name:string;labelNote:string;expected:Partial<Record<AlertRuleId,boolean|null>>;scope:OperationalAnalysis['scope'];hits:AlertHit[];outcomes:AlertRuleOutcome[];computeDurationMs:number;metrics:OperationalAnalysis['metrics'];batches:OperationalAnalysis['batches'];evidence:OperationalAnalysis['metrics'][number]['evidence'];sourceFingerprint:string;}
export interface AlertReplayResult {datasetId:string;datasetName:string;origin:'public'|'simulated';generatedAt:string;configuration:AlertRuleConfiguration;cases:AlertReplayCase[];summary:AlertConfusion;byRule:Record<AlertRuleId,AlertConfusion>;computeDurationMs:number;dataLoadDurationMs:number;manualTriggerWaitingMs:null;timingNote:string;recordType:'demonstration'|'actual';}
