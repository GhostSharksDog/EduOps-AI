import {z} from 'zod';
export const evaluationCreateSchema=z.object({reportId:z.uuid(),caseId:z.string().max(80).optional()}).strict();
export const evaluationRatingSchema=z.object({scores:z.object({numericConsistency:z.number().int().min(1).max(5),evidenceSupport:z.number().int().min(1).max(5),insight:z.number().int().min(1).max(5),actionability:z.number().int().min(1).max(5),clarity:z.number().int().min(1).max(5)}).strict(),ratingNote:z.string().trim().min(1).max(4000)}).strict();
export type EvaluationScores=z.infer<typeof evaluationRatingSchema>['scores'];
export interface EvaluationRating {scores:EvaluationScores;ratingNote:string;ratedBy:string;ratedAt:string;}
export interface EvaluationContext {version:'evaluation-v2';strict:boolean;limitations:string[];caseId?:string;model:string;promptVersion:string;input:unknown;sharedInput:unknown;checks:{structuredFacts:number;verifiedFacts:number;invalidFactIds:string[];invalidEvidenceIds:string[];candidateNumbers:string[];requiresManualTextReview:boolean};}
export interface EvaluationVO {id:string;reportId:string;snapshotHash:string;method:'template'|'direct_model'|'tool_agent';answer:unknown;context?:EvaluationContext;status:'completed'|'failed';error:string|null;scores:EvaluationScores|null;ratingNote:string|null;recordType:'demonstration'|'actual';createdAt:string;ratedAt:string|null;ratedBy?:string|null;ratingHistory?:EvaluationRating[];}
export interface EvaluationSummary {samples:number;strictSamples:number;limitedSamples:number;raters:number;methods:{method:EvaluationVO['method'];completed:number;failed:number;ratedSamples:number;ratings:number;means:EvaluationScores|null}[];}
export const evaluationMethods={template:'固定模板',direct_model:'直接模型（未做数字纠正）',tool_agent:'工具辅助Agent（原冻结报告）'};
export const evaluationDimensions={numericConsistency:{label:'数字一致性',description:'事实值、单位、周期与冻结数据一致；无依据的数量或比例应扣分。'},evidenceSupport:{label:'证据支持',description:'关键判断有可追溯数据或知识依据，事实与推测分开。'},insight:{label:'洞察深度',description:'解释主要变化，提出可核查的原因，避免泛泛复述。'},actionability:{label:'建议可执行性',description:'说明动作、责任对象、期限或复核方法，符合已有数据边界。'},clarity:{label:'表述清晰度',description:'结构清晰、术语易懂、限制明确，便于阅读和行动。'}};
export const evaluationCases=[
 {id:'normal',title:'正常经营',anchorDate:'2026-07-01',kind:'monthly',description:'观察全机构本期与上期情况，核对正常数据的解释。'},
 {id:'attendance',title:'出勤变化',anchorDate:'2026-08-01',kind:'monthly',description:'选择少儿编程课程，分析出勤变化与未知签到。'},
 {id:'renewal',title:'续费不足',anchorDate:'2026-08-01',kind:'monthly',description:'检查到期对象、续费资格及观察窗口是否完整。'},
 {id:'admissions',title:'招生转化',anchorDate:'2026-07-01',kind:'monthly',description:'核对同一线索获取批次的转化与待观察数量。'},
 {id:'refund',title:'退款趋势',anchorDate:'2026-08-01',kind:'monthly',description:'区分完成退款金额、退款课时与撤销记录。'},
 {id:'insufficient',title:'数据不足',anchorDate:'2026-09-01',kind:'monthly',description:'检查截止时间之外的观察限制，不将未知补零。'},
 {id:'retention',title:'在读留存',anchorDate:'2026-08-01',kind:'monthly',description:'区分期初期末在读、正常结课与退班。'},
 {id:'fill',title:'班额利用',anchorDate:'2026-06-01',kind:'monthly',description:'核对班额、在班席位及分组比率，避免平均百分比。'},
 {id:'consumption',title:'课耗进度',anchorDate:'2026-07-01',kind:'monthly',description:'核对净课耗、有效购课及未知余额。'},
 {id:'weekly',title:'周度服务观察',anchorDate:'2026-08-17',kind:'weekly',description:'检查周一至周日的出勤、客诉与行动建议。'},
] as const;
