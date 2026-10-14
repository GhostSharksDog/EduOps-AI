import {isFinanceScope,type AuthorizedFinanceScope,type AuthorizedScope} from '@/shared/contracts/analysis';
import {WorkflowError} from '@/shared/errors/workflow-error';
import type {DecisionGoal,DecisionGoalsInput,ReviewPeriod,ReviewMetricCode,ReviewMetricComparison} from '../contracts/review';
import type {RecommendationVO} from '../contracts';
import {sameAnalysisRange} from '@/shared/lib/analysis-navigation';

const dayShift=(day:string,amount:number)=>new Date(Date.parse(day+'T12:00:00Z')+amount*86400000).toISOString().slice(0,10);
const lastDay=(year:number,month:number)=>new Date(Date.UTC(year,month+1,0)).toISOString().slice(0,10);

/** 自然周、自然月延续到下期，自定义日期保持同天数；不推测财务月度记录。 */
export function defaultReviewPeriod(scope:AuthorizedScope|AuthorizedFinanceScope):ReviewPeriod {
 if(isFinanceScope(scope)){const latest=Math.max(...scope.years);if(!Number.isFinite(latest))throw new WorkflowError('财务分析缺少已冻结年度，不能确定复核周期',422);return {mode:'finance',year:latest+1};}
 const start=new Date(scope.startDate+'T12:00:00Z'),end=new Date(scope.endDate+'T12:00:00Z');
 const month=start.getUTCDate()===1&&start.getUTCFullYear()===end.getUTCFullYear()&&start.getUTCMonth()===end.getUTCMonth()&&scope.endDate===lastDay(end.getUTCFullYear(),end.getUTCMonth());
 if(month){const next=dayShift(scope.endDate,1),date=new Date(next+'T12:00:00Z');return {mode:'operations',startDate:next,endDate:lastDay(date.getUTCFullYear(),date.getUTCMonth())};}
 const days=Math.round((end.getTime()-start.getTime())/86400000)+1;
 return {mode:'operations',startDate:dayShift(scope.endDate,1),endDate:dayShift(scope.endDate,days)};
}

export function validateReviewPeriod(scope:AuthorizedScope|AuthorizedFinanceScope,period:ReviewPeriod){
 if(isFinanceScope(scope)){if(period.mode!=='finance'||period.year<=Math.max(...scope.years))throw new WorkflowError('财务复核须选择原分析之后的年度',400);return;}
 if(period.mode!=='operations'||period.startDate<=scope.endDate)throw new WorkflowError('经营复核须选择原分析结束后的周期',400);
 if((Date.parse(period.endDate)-Date.parse(period.startDate))/86400000>366)throw new WorkflowError('单次经营复核周期不能超过367天',400);
}

export function reviewBaselineScope(source:Pick<RecommendationVO,'scope'|'evidence'>):AuthorizedScope|AuthorizedFinanceScope {
 if(!isFinanceScope(source.scope))return source.scope;
 const years=source.scope.years.length?source.scope.years:source.evidence.flatMap(e=>e.financeScope?.years??[]);
 if(!years.length)throw new WorkflowError('历史财务来源未保存年度依据，请重新查询并建立有年度记录的任务',422);
 return {...source.scope,years:[Math.max(...years)]};
}

export function validateDecisionGoals(source:Pick<RecommendationVO,'scope'|'analysisType'|'evidence'>,goals:DecisionGoalsInput){
 const operations=new Set(['attendance_rate','class_fill_rate','hours_progress','admission_conversion','renewal_rate','retention_rate','complaint_count','refund_amount']);
 for(const target of goals.targets){
  if((source.analysisType==='operations')!==operations.has(target.code))throw new WorkflowError('目标指标与分析类型不一致',400);
  if(operations.has(target.code)&&target.target<0)throw new WorkflowError('经营目标不能为负数',400);
  if(['attendance_rate','class_fill_rate','hours_progress','admission_conversion','renewal_rate','retention_rate'].includes(target.code)&&target.target>100)throw new WorkflowError('百分比目标应在0至100之间',400);
  if(target.code==='complaint_count'&&!Number.isInteger(target.target))throw new WorkflowError('客诉数量目标须为整数',400);
 }
 const baseline=reviewBaselineScope(source);
 validateReviewPeriod(baseline,goals.reviewPeriod??defaultReviewPeriod(baseline));
}

export function goalAchieved(goal:DecisionGoal|null,value:number|null){return goal&&value!==null?(goal.operator==='at_least'?value>=goal.target:value<=goal.target):null;}
export function verifyFrozenBaseline(source:RecommendationVO,code:ReviewMetricCode,value:number|null,numerator?:number|null,denominator?:number|null):NonNullable<ReviewMetricComparison['baselineVerification']>{
 const scope=reviewBaselineScope(source),finance=isFinanceScope(scope);
 const facts=source.answer.facts.filter(f=>{
  if(finance)return f.id.endsWith(':'+Math.max(...scope.years)+':'+code);
  if(f.id==='current/'+code)return true;
  if(!f.id.endsWith(':'+code))return false;
  // Dimension facts must carry the exact task range; a narrower course cannot stand in for the total.
  return source.evidence.some(e=>e.scope&&sameAnalysisRange(e.scope,scope)&&f.evidenceIds.some(id=>id===e.id||id===e.id+'/'+e.version||id===e.id+'@'+e.version));
 });
 if(!facts.length)return {status:'not_recorded',originalValue:null,explanation:'原分析没有保存此项可核对的基线，执行前数值按当前口径重新计算，仅用于描述性观察。'};
 const changed=facts.some(f=>f.value!==value||(f.numerator!==undefined&&numerator!==undefined&&f.numerator!==numerator)||(f.denominator!==undefined&&denominator!==undefined&&f.denominator!==denominator));
 return changed?{status:'changed',originalValue:facts[0].value,explanation:'当前重算的执行前数据与原分析冻结事实不同；数据或口径需核查，不能据此判定变化或目标达成。'}:{status:'matched',originalValue:facts[0].value,explanation:'执行前数据按当前口径重算，并与原分析冻结事实一致。'};
}
export const reviewLimitations=[
 '前后对比是执行后的观察记录，不能单独证明任务导致指标变化。',
 '两期保持同一数据集、校区、课程、渠道及当前计算口径；原始分析与历史反馈不会改写。',
 '没有预先设置目标的历史任务只提供描述性变化，不事后补写目标或判定目标达成。',
];
