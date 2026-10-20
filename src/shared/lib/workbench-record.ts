import type {WorkbenchItem,WorkbenchKind} from '@/shared/contracts/workbench';

const paths:Record<WorkbenchKind,string>={task:'/dashboard/decisions',plan:'/dashboard/agent',analysis:'/dashboard/agent',material:'/dashboard/knowledge',report:'/dashboard/reports',tag:'/dashboard/tags/risk',segment:'/dashboard/segments/risk'};
const objectKeys:Partial<Record<WorkbenchKind,string>>={task:'taskId',plan:'runId',analysis:'sessionId',material:'sourceId',tag:'proposalId',segment:'snapshotId'};
/** Only the selected record's own scope is copied. No ambient review or object IDs. */
export function workbenchRecordLink(kind:WorkbenchKind,id:string,context:{datasetId?:string|null;scope?:unknown;sessionId?:string|null}={}){
 const params=new URLSearchParams(),raw=context.scope;
 if(context.datasetId)params.set('datasetId',context.datasetId);
 if(raw&&typeof raw==='object'){
  const s=raw as Record<string,unknown>;
  if(Array.isArray(s.years))params.set('financeScope',JSON.stringify({years:s.years}));
  else if(Array.isArray(s.courseKeys))params.set('learningScope',JSON.stringify({courseKeys:s.courseKeys,...(typeof s.relativeDayStart==='number'?{relativeDayStart:s.relativeDayStart}:{}),...(typeof s.relativeDayEnd==='number'?{relativeDayEnd:s.relativeDayEnd}:{})}));
  else if(typeof s.startDate==='string'&&typeof s.endDate==='string')params.set('scope',JSON.stringify({startDate:s.startDate,endDate:s.endDate,campusIds:Array.isArray(s.campusIds)?s.campusIds:[],courseIds:Array.isArray(s.courseIds)?s.courseIds:[],channelIds:Array.isArray(s.channelIds)?s.channelIds:[],...(typeof s.dataCutoff==='string'?{dataCutoff:s.dataCutoff}:{})}));
 }
 const key=objectKeys[kind];if(key)params.set(key,id);
 if(kind==='plan'&&context.sessionId)params.set('sessionId',context.sessionId);
 const path=kind==='report'?paths.report+'/'+encodeURIComponent(id):paths[kind];
 return path+(params.size?'?'+params:'');
}
export function workbenchPeriod(scope:unknown):string|undefined{
 if(!scope||typeof scope!=='object')return undefined;const s=scope as Record<string,unknown>;
 if(Array.isArray(s.years))return s.years.length?s.years.join('、')+' 年度':'全部年度';
 if(Array.isArray(s.courseKeys))return `相对日 ${s.relativeDayStart??'起始'} 至 ${s.relativeDayEnd??'结束'}`;
 if(typeof s.startDate==='string'&&typeof s.endDate==='string')return s.startDate+' 至 '+s.endDate;
 return undefined;
}
export function workbenchDataset(row:{datasetId:string;datasetName:string|null;datasetOrigin:string|null;analysisType:string|null}):WorkbenchItem['dataset']{
 if(!row.datasetId||!row.datasetName||!['public','simulated'].includes(row.datasetOrigin??''))return undefined;
 return {id:row.datasetId,name:row.datasetName,origin:row.datasetOrigin as 'public'|'simulated',analysisType:row.analysisType==='operations'||row.analysisType==='learning'||row.analysisType==='finance'?row.analysisType:null};
}
