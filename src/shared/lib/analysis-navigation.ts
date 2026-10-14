import {analysisScopeSchema} from '@/shared/contracts/analysis';
import type {AnalysisScope} from '@/shared/contracts/analysis';
export interface AnalysisSelection {datasetId:string;scope:AnalysisScope;}
export function selectionFromSearch(search:string):AnalysisSelection|null {
    const params=new URLSearchParams(search),id=params.get('datasetId'),raw=params.get('scope');
    if(!id||!raw||!/^[-a-f0-9]{36}$/i.test(id))return null;
    try{const parsed=analysisScopeSchema.safeParse(JSON.parse(raw));return parsed.success?{datasetId:id,scope:parsed.data}:null;}catch{return null;}
}
export function analysisHref(path:string,selection:AnalysisSelection,extra:Record<string,string>={}) {
    const s=selection.scope,publicScope={startDate:s.startDate,endDate:s.endDate,campusIds:s.campusIds,courseIds:s.courseIds,channelIds:s.channelIds,...(s.dataCutoff?{dataCutoff:s.dataCutoff}:{})};
    const params=new URLSearchParams({datasetId:selection.datasetId,scope:JSON.stringify(publicScope),...extra});
    if(typeof window!=='undefined'){
        const existing=new URLSearchParams(window.location.search),review=existing.get('review');if(review&&!params.has('review'))params.set('review',review);
        const current=selectionFromSearch(window.location.search);
        if(review&&current&&current.datasetId===selection.datasetId&&sameAnalysisRange(current.scope,selection.scope)){
            const nodes=['runId','proposalId','snapshotId','reportId','taskId'];
            const changed=(id:string)=>extra[id]&&existing.get(id)!==extra[id];
            const omit=changed('taskId')?nodes:changed('snapshotId')?['runId','proposalId','reportId','taskId']:changed('runId')?['proposalId','snapshotId','reportId','taskId']:changed('proposalId')?['snapshotId','reportId','taskId']:changed('reportId')?['taskId']:[];
            nodes.forEach(k=>{const id=existing.get(k);if(id&&!params.has(k)&&!omit.includes(k))params.set(k,id);});
        }
    }
    return path+'?'+params;
}
export function scopeKey(selection:AnalysisSelection){const s=selection.scope;return JSON.stringify({datasetId:selection.datasetId,startDate:s.startDate,endDate:s.endDate,cutoff:scopePointCutoff(s),campusIds:[...s.campusIds].sort(),courseIds:[...s.courseIds].sort(),channelIds:[...s.channelIds].sort()});}
export function scopePointCutoff(s:AnalysisScope){return Math.min(Date.parse(s.dataCutoff??s.endDate+'T23:59:59.999+08:00'),Date.parse(s.endDate+'T23:59:59.999+08:00'));}
export function sameAnalysisRange(a:AnalysisScope,b:AnalysisScope){return a.startDate===b.startDate&&a.endDate===b.endDate&&scopePointCutoff(a)===scopePointCutoff(b)&&['campusIds','courseIds','channelIds'].every(k=>JSON.stringify([...(a[k as 'campusIds']??[])].sort())===JSON.stringify([...(b[k as 'campusIds']??[])].sort()));}
