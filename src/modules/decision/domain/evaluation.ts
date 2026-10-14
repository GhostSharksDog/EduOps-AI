import type {AgentFactVO} from '@/modules/agent/contracts';
import type {EvaluationVO,EvaluationSummary,EvaluationScores,EvaluationRating,EvaluationContext} from '../contracts/evaluation';
import {evaluationDimensions} from '../contracts/evaluation';
export function checkEvaluationAnswer(answer:unknown,facts:AgentFactVO[],allowedEvidenceIds:string[]):EvaluationContext['checks']{
 const data=answer&&typeof answer==='object'?answer as Record<string,unknown>:{},actual=Array.isArray(data.facts)?data.facts as AgentFactVO[]:[],invalidFactIds:string[]=[],invalidEvidenceIds:string[]=[];
 for(const value of actual){const known=facts.find(f=>f.id===value.id);if(!known||['value','unit','status','numerator','denominator'].some(k=>JSON.stringify(known[k as keyof AgentFactVO])!==JSON.stringify(value[k as keyof AgentFactVO])))invalidFactIds.push(value.id??'缺少编号');for(const id of value.evidenceIds??[])if(!allowedEvidenceIds.includes(id))invalidEvidenceIds.push(id);}
 const content=typeof data.content==='string'?data.content:'';
 return {structuredFacts:actual.length,verifiedFacts:actual.length-invalidFactIds.length,invalidFactIds,invalidEvidenceIds:[...new Set(invalidEvidenceIds)],candidateNumbers:[...new Set(content.match(/[-+]?\d+(?:[,.]\d+)*(?:\s*%|\s*万元|\s*亿元|\s*元|\s*人|\s*条)?/g)??[])].slice(0,100),requiresManualTextReview:!!content};
}
export function latestRatings(record:EvaluationVO):EvaluationRating[]{
 const latest=new Map<string,EvaluationRating>();
 for(const r of record.ratingHistory??[])if(r.ratedBy&&r.scores&&(!latest.has(r.ratedBy)||r.ratedAt>=latest.get(r.ratedBy)!.ratedAt))latest.set(r.ratedBy,r);
 if(!latest.size&&record.ratedBy&&record.scores&&record.ratedAt)latest.set(record.ratedBy,{scores:record.scores,ratingNote:record.ratingNote??'',ratedBy:record.ratedBy,ratedAt:record.ratedAt});
 return [...latest.values()];
}
export function summarizeEvaluations(records:EvaluationVO[]):EvaluationSummary{
 const strict=records.filter(r=>r.context?.strict),samples=new Set(records.map(r=>r.reportId)),raters=new Set(strict.flatMap(r=>latestRatings(r).map(v=>v.ratedBy)));
 return {samples:samples.size,strictSamples:new Set(strict.map(r=>r.reportId)).size,limitedSamples:new Set(records.filter(r=>!r.context?.strict).map(r=>r.reportId)).size,raters:raters.size,methods:(['template','direct_model','tool_agent'] as const).map(method=>{
 const all=records.filter(r=>r.method===method),eligible=strict.filter(r=>r.method===method&&r.status==='completed'),ratings=eligible.flatMap(latestRatings);
 const means=ratings.length?Object.fromEntries(Object.keys(evaluationDimensions).map(key=>[key,Math.round(ratings.reduce((sum,r)=>sum+r.scores[key as keyof EvaluationScores],0)/ratings.length*100)/100])) as EvaluationScores:null;
 return {method,completed:all.filter(r=>r.status==='completed').length,failed:all.filter(r=>r.status==='failed').length,ratedSamples:eligible.filter(r=>latestRatings(r).length).length,ratings:ratings.length,means};})};
}
