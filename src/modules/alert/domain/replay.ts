import {alertRuleIds,type AlertConfusion,type AlertReplayCase,type AlertRuleId} from '../contracts';

const empty=():AlertConfusion=>({truePositive:0,falsePositive:0,falseNegative:0,trueNegative:0,unlabelled:0,unavailable:0,precision:null,recall:null});
const finalize=(value:AlertConfusion)=>({...value,precision:value.truePositive+value.falsePositive?value.truePositive/(value.truePositive+value.falsePositive):null,recall:value.truePositive+value.falseNegative?value.truePositive/(value.truePositive+value.falseNegative):null});

/** 缺少人工标注、数据不足和停用规则单列；不能作为已核验的真阴性。 */
export function summarizeReplay(cases:Pick<AlertReplayCase,'outcomes'|'expected'>[]){
 const byRule=Object.fromEntries(alertRuleIds.map(id=>[id,empty()])) as Record<AlertRuleId,AlertConfusion>;
 for(const item of cases)for(const rule of alertRuleIds){
  const counts=byRule[rule],expected=item.expected[rule],outcome=item.outcomes.find(o=>o.rule===rule);
  if(expected===null||expected===undefined){counts.unlabelled++;continue;}
  if(!outcome||outcome.state==='skipped'||outcome.state==='disabled'){counts.unavailable++;continue;}
  const actual=outcome.state==='hit';
  if(expected&&actual)counts.truePositive++;else if(!expected&&actual)counts.falsePositive++;else if(expected&&!actual)counts.falseNegative++;else counts.trueNegative++;
 }
 const total=empty();
 for(const rule of alertRuleIds){for(const key of ['truePositive','falsePositive','falseNegative','trueNegative','unlabelled','unavailable'] as const)total[key]+=byRule[rule][key];byRule[rule]=finalize(byRule[rule]);}
 return {summary:finalize(total),byRule};
}
