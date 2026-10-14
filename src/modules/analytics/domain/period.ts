import type {AnalysisScope} from '@/shared/contracts/analysis';
const shift=(day:string,n:number)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export function previousPeriod(scope:AnalysisScope):AnalysisScope {
 const start=new Date(scope.startDate+'T12:00:00Z'),end=new Date(scope.endDate+'T12:00:00Z');
 const calendarMonth=start.getUTCDate()===1&&start.getUTCFullYear()===end.getUTCFullYear()&&start.getUTCMonth()===end.getUTCMonth()&&shift(scope.endDate,1).endsWith('-01');
 if(calendarMonth){const last=shift(scope.startDate,-1);return {...scope,startDate:last.slice(0,7)+'-01',endDate:last};}
 const length=Math.round((end.getTime()-start.getTime())/86400000)+1;
 return {...scope,startDate:shift(scope.startDate,-length),endDate:shift(scope.startDate,-1)};
}
export function reportPeriod(type:'weekly'|'monthly',anchor:string):Pick<AnalysisScope,'startDate'|'endDate'> {
 const d=new Date(anchor+'T12:00:00Z');
 if(type==='monthly')return {startDate:anchor.slice(0,7)+'-01',endDate:new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).toISOString().slice(0,10)};
 const monday=shift(anchor,-((d.getUTCDay()+6)%7));return {startDate:monday,endDate:shift(monday,6)};
}
