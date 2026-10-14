import type {OperationalAnalysis,OperationalMetric} from '@/modules/analytics/contracts';
import {alertRuleLabels,defaultAlertConfiguration,type AlertHit,type AlertRuleConfiguration,type AlertRuleId,type AlertRuleOutcome} from '../contracts';

/** 纯计算器：正式评估和历史回放使用相同规则，不产生数据库写入。 */
export function evaluateRules(data:OperationalAnalysis,configuration:AlertRuleConfiguration=defaultAlertConfiguration()){
 const hits:AlertHit[]=[],skipped:{rule:AlertRuleId;reason:string}[]=[],outcomes:AlertRuleOutcome[]=[];
 const current=(code:string)=>data.metrics.find(m=>m.code===code),previous=(code:string)=>data.comparison?.metrics.find(m=>m.code===code);
 const complete=(scope:OperationalAnalysis['scope'])=>!!scope.dataCutoff&&Date.parse(scope.dataCutoff)>=Date.parse(scope.endDate+'T23:59:59.999+08:00');
 const ready=(m:OperationalMetric|undefined,minimum:number):m is OperationalMetric=>!!m&&m.status==='ready'&&m.value!==null&&m.numerator!==null&&Number.isFinite(m.numerator)&&m.denominator!==null&&m.denominator>=minimum&&Number.isFinite(m.denominator)&&m.unknownCount===0;
 const raw=(m:OperationalMetric)=>m.numerator!/m.denominator!*100;
 const skip=(rule:AlertRuleId,reason:string,state:'skipped'|'disabled'='skipped')=>{skipped.push({rule,reason});outcomes.push({rule,state,reason});};
 const result=(rule:AlertRuleId,hit:Omit<AlertHit,'rule'|'title'|'ruleConfiguration'>|null)=>{
  if(hit){hits.push({...hit,rule,title:alertRuleLabels[rule],ruleConfiguration:configuration});outcomes.push({rule,state:'hit',reason:hit.description});}
  else outcomes.push({rule,state:'clear',reason:'完整数据与样本条件满足，未达到当前规则阈值'});
 };
 const a=current('attendance_rate'),p=previous('attendance_rate'),f=current('class_fill_rate'),r=current('renewal_rate');
 const attendance=configuration.rules.attendance_drop,fill=configuration.rules.low_fill,renewal=configuration.rules.low_renewal;
 if(!attendance.enabled)skip('attendance_drop','该配置版本已停用出勤下降规则','disabled');
 else if(!complete(data.scope)||!data.comparison||!complete(data.comparison.scope)||!ready(a,attendance.minimumSample)||!ready(p,attendance.minimumSample))skip('attendance_drop',`需要两期完整、无未知签到的出勤数据，且应出勤均不少于${attendance.minimumSample}`);
 else result('attendance_drop',raw(p)-raw(a)>=attendance.threshold?{value:a.value!,baseline:p.value!,threshold:attendance.threshold,denominator:a.denominator!,description:`较对比期下降至少${attendance.threshold}个百分点；规则配置v${configuration.version}`} :null);
 if(!fill.enabled)skip('low_fill','该配置版本已停用满班不足规则','disabled');
 else if(data.scope.channelIds.length)skip('low_fill','渠道范围展示渠道席位贡献率，分母为全部班额，不适用满班不足阈值');
 else if(!complete(data.scope)||!ready(f,fill.minimumSample))skip('low_fill',`需要完整周期及有效班额不少于${fill.minimumSample}`);
 else result('low_fill',raw(f)<fill.threshold?{value:f.value!,baseline:null,threshold:fill.threshold,denominator:f.denominator!,description:`期末满班率低于${fill.threshold}%；规则配置v${configuration.version}`} :null);
 if(!renewal.enabled)skip('low_renewal','该配置版本已停用续费偏低规则','disabled');
 else if(!ready(r,renewal.minimumSample))skip('low_renewal',`续费观察窗口须结束，且具备资格的到期对象不少于${renewal.minimumSample}`);
 else result('low_renewal',raw(r)<renewal.threshold?{value:r.value!,baseline:null,threshold:renewal.threshold,denominator:r.denominator!,description:`续费率低于${renewal.threshold}%；规则配置v${configuration.version}`} :null);
 return {hits,skipped,outcomes};
}
