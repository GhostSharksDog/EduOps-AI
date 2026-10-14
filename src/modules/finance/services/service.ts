import 'server-only';
import {createHash} from 'node:crypto';
import {educationData} from '@/modules/education/server';
import {datasetAnalysisType} from '@/modules/education/contracts';
import {financeScopeSchema,type AuthorizedFinanceScope,type EvidenceReference} from '@/shared/contracts/analysis';
import {WorkflowError} from '@/shared/errors/workflow-error';
import {financeLabels,type FinanceAnalysis,type FinanceAnnual,type FinanceCode} from '../contracts';
import {annualValues} from '../domain/annual';
export class FinanceService {
 async query(datasetId:string,scope:AuthorizedFinanceScope):Promise<FinanceAnalysis>{
  const range=financeScopeSchema.parse({years:scope.years});
  const snapshot=await educationData.snapshot(scope.organizationId,datasetId,['finance_annual']);
  if(datasetAnalysisType(snapshot.dataset)!=='finance')throw new WorkflowError('此数据集不是年度财务案例',400);
  const available=snapshot.records.map(r=>r.payload as unknown as FinanceAnnual).sort((a,b)=>a.year-b.year);
  if(new Set(available.map(r=>r.year)).size!==available.length)throw new WorkflowError('同年度存在多条当前披露，请使用独立来源版本',409);
  if(range.years.some(y=>!available.some(r=>r.year===y)))throw new WorkflowError('所选年度尚未完成导入',400);
  const annual=available.filter(r=>!range.years.length||range.years.includes(r.year)).map(r=>({...r,historicalSources:typeof r.historicalSources==='string'?JSON.parse(r.historicalSources):r.historicalSources??[]}));
  const fingerprint=createHash('sha256').update(JSON.stringify(snapshot.records.map(r=>[r.sourceId,r.hash]).sort())).digest('hex');
  const evidence:EvidenceReference[]=annual.map(r=>({id:'finance:'+datasetId+':'+r.year,kind:'metric',sourceId:datasetId,version:fingerprint,summary:r.year+'年度，人民币元，集团合并口径；来源 '+r.sourceUrl+' 第'+r.sourcePage+'页；披露 '+r.disclosedAt+'；版本 '+r.sourceVersion,financeScope:{years:[r.year]},updatedAt:r.disclosedAt+'T00:00:00.000Z'}));
  const latest=annual.at(-1),previous=latest?available.find(r=>r.year===latest.year-1):undefined,current=latest?annualValues(latest):null,prior=previous?annualValues(previous):null;
  const metrics=(Object.keys(financeLabels) as FinanceCode[]).map(code=>{const ratio=code.endsWith('Ratio')||code==='grossMargin',value=current?.[code]??null,prev=prior?.[code]??null;return {code,label:financeLabels[code],value,unit:ratio?'%' as const:'元' as const,previous:prev,change:value===null||prev===null?null:ratio?value-prev:prev===0?null:(value-prev)/Math.abs(prev)*100,changeUnit:ratio?'百分点' as const:'%' as const,evidence:[...evidence,...(previous&&!annual.some(r=>r.year===previous.year)?[{id:'finance:'+datasetId+':'+previous.year,kind:'metric' as const,sourceId:datasetId,version:fingerprint,summary:previous.year+'年度对比依据 '+previous.sourceUrl+' 第'+previous.sourcePage+'页',financeScope:{years:[previous.year]},updatedAt:previous.disclosedAt+'T00:00:00.000Z'}]:[])]};});
  return {analysisType:'finance',dataset:snapshot.dataset,scope:{...range,organizationId:scope.organizationId},years:available.map(r=>r.year),annual,metrics,evidence:[...new Map(metrics.flatMap(m=>m.evidence).map(e=>[e.id,e])).values()],sourceFingerprint:fingerprint,completeness:{expected:snapshot.dataset.expectedRows?.finance_annual??0,imported:available.length},limitations:['集团年度公开披露，与模拟学员及OULAD独立；不提供校区利润、渠道获客成本或月度预测。','毛利不等于净利润，费用不等于现金支出；营业收入不等于收款。','仅收录必要数值事实及出处，未声明年报具有开放许可证。']};
 }
 async resolveScope(datasetId:string,scope:AuthorizedFinanceScope){const result=await this.query(datasetId,scope);return result.scope;}
}
export const financeAnalytics=new FinanceService();
