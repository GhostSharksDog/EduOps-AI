import 'server-only';
import {createHash} from 'node:crypto';
import {operations} from '@/modules/analytics/server';
import {educationData} from '@/modules/education/server';
import {financeAnalytics} from '@/modules/finance/server';
import {isFinanceScope,type AuthorizedScope,type EvidenceReference} from '@/shared/contracts/analysis';
import {WorkflowError} from '@/shared/errors/workflow-error';
import type {AgentActor} from '@/modules/agent/contracts';
import type {DecisionTask,ReviewMetricComparison,ReviewMetricCode,ReviewPreview,ReviewPreviewInput} from '../contracts';
import {reviewMetricLabels,reviewPeriodSchema} from '../contracts';
import {defaultReviewPeriod,goalAchieved,reviewBaselineScope,reviewLimitations,validateReviewPeriod,verifyFrozenBaseline} from '../domain/review';

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const localDay=(iso:string)=>new Date(Date.parse(iso)+8*3600000).toISOString().slice(0,10);
const finiteChange=(a:number|null,b:number|null)=>a!==null&&b!==null?Math.round((b-a)*100)/100:null;
const dedup=(evidence:EvidenceReference[])=>[...new Map(evidence.map(e=>[e.id+'/'+e.version,e])).values()];
export const completedBatchSignature=(batches:readonly {id:string;status:string;kind:string;fileHash:string;acceptedRows:number}[])=>hash(batches.filter(b=>b.status==='completed').map(b=>[b.id,b.kind,b.fileHash,b.acceptedRows]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));

/** 只读：预览不写任务、不超时记录，也不以模型解释代替经营计算。 */
export async function calculateDecisionReview(actor:AgentActor,task:DecisionTask,input:ReviewPreviewInput,now=new Date()):Promise<ReviewPreview>{
 if(task.version!==input.expectedVersion)throw new WorkflowError('任务已被更新，请刷新后重新预览',409,'TASK_VERSION_CHANGED');
 if(task.sourceSnapshot.scope.organizationId!==actor.organizationId)throw new WorkflowError('任务不存在或无权访问',404);
 const baseline=reviewBaselineScope(task.sourceSnapshot),period=reviewPeriodSchema.parse(input.period??task.goals?.reviewPeriod??defaultReviewPeriod(baseline));
 validateReviewPeriod(baseline,period);
 if(task.goals?.reviewPeriod&&JSON.stringify(period)!==JSON.stringify(reviewPeriodSchema.parse(task.goals.reviewPeriod)))throw new WorkflowError('目标和复核周期已在执行前确定，不能事后改变；请使用任务保存的复核周期',409,'REVIEW_PERIOD_LOCKED');
 const {dataset,batches}=await educationData.inspect(actor.organizationId,task.datasetId),signature=completedBatchSignature(batches);
 const codes:ReviewMetricCode[]=task.goals?.targets.map(t=>t.code)??(isFinanceScope(baseline)?['revenue','grossMargin','sellingRatio']:['attendance_rate','renewal_rate','retention_rate']);
 const reasons:string[]=[],limitations=[...reviewLimitations],metrics:ReviewMetricComparison[]=[];
 let beforeScope:ReviewPreview['beforeScope']=baseline,afterScope:ReviewPreview['afterScope']=baseline,beforeFingerprint='',afterFingerprint='';
 if(isFinanceScope(baseline)&&period.mode==='finance'){
  const all=await financeAnalytics.query(task.datasetId,{organizationId:actor.organizationId,years:[]});
  const beforeYear=Math.max(...baseline.years);afterScope={organizationId:actor.organizationId,years:[period.year]};
  const originalAvailable=all.years.includes(beforeYear),reviewAvailable=all.years.includes(period.year);
  if(!originalAvailable)reasons.push('原分析年度尚未完整导入，无法核对前期数据。');
  if(!reviewAvailable)reasons.push(period.year>=Number(localDay(now.toISOString()).slice(0,4))?'后续年度尚未结束或年报尚未披露，不能判断经营变化。':'所选后续年度尚未导入；不能由其他年度补造。');
  const before=originalAvailable?await financeAnalytics.query(task.datasetId,baseline):null;
  const after=reviewAvailable?await financeAnalytics.query(task.datasetId,afterScope):null;
  if(all.completeness.expected&&all.completeness.imported!==all.completeness.expected)reasons.push('年度财务文件尚未全部完成导入。');
  beforeFingerprint=before?.sourceFingerprint??all.sourceFingerprint;afterFingerprint=after?.sourceFingerprint??all.sourceFingerprint;
  limitations.push('集团年度财务与模拟经营学员分别分析；金额单位为人民币元，比例单位为百分比。');
  for(const code of codes){
   const b=before?.metrics.find(m=>m.code===code),a=after?.metrics.find(m=>m.code===code),goal=task.goals?.targets.find(t=>t.code===code)??null;
   const ready=!!b&&!!a&&b.value!==null&&a.value!==null&&!reasons.length;
   metrics.push({code,label:reviewMetricLabels[code],unit:a?.unit??b?.unit??'',before:b?.value??null,after:a?.value??null,change:ready?finiteChange(b!.value,a!.value):null,changeUnit:a?.unit==='%'?'个百分点':'元',beforeNumerator:null,beforeDenominator:null,afterNumerator:null,afterDenominator:null,status:ready?'ready':'insufficient_data',reason:ready?'':reasons.join('；')||'财务数据不足，无法比较',goal,achieved:ready?goalAchieved(goal,a!.value):null,evidence:dedup([...(b?.evidence??[]),...(a?.evidence??[])])});
  }
 }else if(!isFinanceScope(baseline)&&period.mode==='operations'){
  const dataCutoff=new Date(Math.min(Date.parse(dataset.dataCutoff),now.getTime())).toISOString();
  afterScope={...baseline,startDate:period.startDate,endDate:period.endDate,dataCutoff,observationCutoff:dataCutoff};
  if(period.endDate>localDay(now.toISOString()))reasons.push('复核周期尚未结束；等待周期结束后再计算达成情况。');
  if(period.endDate>localDay(dataCutoff))reasons.push('数据截止早于复核结束日，缺少后续完整数据，不能补零。');
  if(baseline.endDate>localDay(dataset.dataCutoff))reasons.push('数据截止早于原分析结束日，前期数据不足。');
  const [before,after]=await Promise.all([operations.query(task.datasetId,baseline,codes,false),operations.query(task.datasetId,afterScope,codes,false)]);
  beforeScope=before.scope;afterScope=after.scope;
  beforeFingerprint=hash({scope:before.scope,batches:before.batches});afterFingerprint=hash({scope:after.scope,batches:after.batches});
  for(const code of codes){
   const b=before.metrics.find(m=>m.code===code),a=after.metrics.find(m=>m.code===code),goal=task.goals?.targets.find(t=>t.code===code)??null;
   const sameUnit=b?.unit===a?.unit,ready=b?.status==='ready'&&a?.status==='ready'&&sameUnit&&!reasons.length;
   const reason=reasons.join('；')||(!sameUnit?'两期指标单位不一致':b?.status!=='ready'?'前期：'+(b?.reason??'没有计算结果'):a?.status!=='ready'?'后期：'+(a?.reason??'没有计算结果'):'');
   const unit=a?.unit==='percent'?'%':a?.unit==='currency'?'元':a?.unit==='hours'?'课时':'条';
   metrics.push({code,label:a?.displayName??reviewMetricLabels[code],unit,before:b?.value??null,after:a?.value??null,change:ready?finiteChange(b!.value,a!.value):null,changeUnit:unit==='%'?'个百分点':unit,beforeNumerator:b?.numerator??null,beforeDenominator:b?.denominator??null,afterNumerator:a?.numerator??null,afterDenominator:a?.denominator??null,status:ready?'ready':'insufficient_data',reason,goal,achieved:ready?goalAchieved(goal,a!.value):null,evidence:dedup([...(b?.evidence??[]),...(a?.evidence??[])])});
  }
  limitations.push('前期按来源保存的统计范围和截止重新核验，后期按当前数据截止计算；观察窗口未完整的转化、续费不作结论。','客诉与退款为各期数量或金额，需同时查看样本规模；数值减少不自动解释为服务改善。');
 }
 for(const metric of metrics){
  metric.baselineVerification=verifyFrozenBaseline(task.sourceSnapshot,metric.code,metric.before,metric.beforeNumerator,metric.beforeDenominator);
  if(metric.baselineVerification.status==='changed'){metric.status='insufficient_data';metric.reason=[metric.reason,metric.baselineVerification.explanation].filter(Boolean).join('；');metric.change=null;metric.achieved=null;}
  if(metric.baselineVerification.status==='not_recorded'){metric.achieved=null;limitations.push(metric.label+'：'+metric.baselineVerification.explanation);}
 }
 const rowReasons=metrics.filter(m=>m.status!=='ready').map(m=>m.label+'：'+m.reason),allReasons=[...new Set([...reasons,...rowReasons])];
 const result:Omit<ReviewPreview,'previewToken'|'canConfirm'>={taskId:task.id,taskVersion:task.version,datasetId:task.datasetId,mode:isFinanceScope(baseline)?'finance':'operations',period,beforeScope,afterScope,metrics,goals:task.goals??null,recordType:task.recordType,sourceFingerprints:{before:beforeFingerprint,after:afterFingerprint},batchSignature:signature,definitionVersion:'decision-review-v1',status:metrics.length&&metrics.every(m=>m.status==='ready')?'ready':'insufficient_data',reasons:allReasons,limitations,evidence:dedup(metrics.flatMap(m=>m.evidence)),calculatedAt:now.toISOString()};
 // 时间不参与签名；确认会重新执行相同计算，版本、周期、批次、目标或数字改变都会拒绝旧预览。
 const {calculatedAt:_time,...stable}=result;
 return {...result,previewToken:hash(stable),canConfirm:result.status==='ready'&&task.state==='review_pending'};
}
