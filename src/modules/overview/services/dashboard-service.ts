import 'server-only';
import {createHash} from 'node:crypto';
import {buildStudentBusinessFacts,completeKinds,kindLabels} from '@/modules/education/contracts';
import type {EducationSnapshot} from '@/modules/education/contracts';
import {operations,channels,operationalKinds,metricDefinitions} from '@/modules/analytics/server';
import {riskTags} from '@/modules/tag/server';
import {ruleDescription} from '@/modules/tag/contracts';
import {riskSegments} from '@/modules/segment/server';
import {queryRows} from '@/platform/database';
import type {AuthorizedScope,EvidenceReference} from '@/shared/contracts/analysis';
import type {AlertVO,AlertHit} from '@/modules/alert/contracts';
import type {ReportVO} from '@/modules/report/contracts';
import type {DashboardResult} from '../contracts';
import {sameAnalysisRange} from '@/shared/lib/analysis-navigation';

const monthStart=(year:number,month:number)=>new Date(Date.UTC(year,month,1)).toISOString().slice(0,10);
const sameSelection=sameAnalysisRange;
function admission(snapshot:EducationSnapshot,analysis:DashboardResult['analysis']):DashboardResult['admission'] {
    const m=analysis.metrics.find(m=>m.code==='admission_conversion')!,empty={status:snapshot.dataset.origin==='public'?'not_applicable':'insufficient_data',leads:null,trials:null,afterTrial:null,direct:null,pending:m?.details.pending??0,reason:m?.reason??'',evidence:m?.evidence??[]} as DashboardResult['admission'];
    if(m?.status!=='ready')return empty;
    if(!completeKinds(snapshot,['trial']))return {...empty,reason:'试听数据未完整导入，不能区分试听后签约和直接签约'};
    const s=analysis.scope,selected=(r:EducationSnapshot['records'][number])=>(!s.campusIds.length||s.campusIds.includes(r.campusId))&&(!s.courseIds.length||s.courseIds.includes(r.courseId))&&(!s.authorizedCampusIds.length||s.authorizedCampusIds.includes(r.campusId));
    const localDay=(v:string)=>new Date(Date.parse(v)+8*3600000).toISOString().slice(0,10);
    const leads=snapshot.records.filter(r=>r.kind==='lead'&&selected(r)&&r.occurredAt&&localDay(r.occurredAt)>=s.startDate&&localDay(r.occurredAt)<=s.endDate&&Date.parse(r.occurredAt)<=Date.parse(s.dataCutoff!));
    const trials=snapshot.records.filter(r=>r.kind==='trial'&&r.payload.status==='attended'),contracts=snapshot.records.filter(r=>r.kind==='contract');let trialCount=0,afterTrial=0,direct=0;
    for(const lead of leads){const start=Date.parse(String(lead.payload.acquiredAt)),end=Math.min(start+30*86400000,Date.parse(m.observationCutoff!));const cs=contracts.filter(c=>c.payload.leadId===lead.sourceId&&Date.parse(String(c.payload.signedAt))>=start&&Date.parse(String(c.payload.signedAt))<=end),ts=trials.filter(t=>t.payload.leadId===lead.sourceId&&t.occurredAt&&Date.parse(t.occurredAt)>=start&&Date.parse(t.occurredAt)<=end);if(ts.length)trialCount++;if(cs.length){if(cs.some(c=>ts.some(t=>Date.parse(t.occurredAt!)<=Date.parse(String(c.payload.signedAt)))))afterTrial++;else direct++;}}
    return {status:'ready',leads:leads.length,trials:trialCount,afterTrial,direct,pending:0,reason:'同一获取批次，试听及签约均观察30天；签约按明确线索关联去重',evidence:m.evidence};
}
export async function queryDashboard(id:string,requested:AuthorizedScope):Promise<DashboardResult> {
    const prepared=await operations.prepare(id,requested),snapshot=prepared.snapshot,analysis=await operations.queryPrepared(prepared,requested),details=await operations.queryPreparedDetails(prepared,requested);
    const y=Number(requested.endDate.slice(0,4)),m=Number(requested.endDate.slice(5,7))-1;
    const history:DashboardResult['history']=[];
    for(let i=0;i<6;i++){const start=monthStart(y,m-5+i),end=new Date(Date.UTC(Number(start.slice(0,4)),Number(start.slice(5,7)),0)).toISOString().slice(0,10),a=await operations.queryPrepared(prepared,{...requested,startDate:start,endDate:end,dataCutoff:analysis.scope.dataCutoff,observationCutoff:requested.observationCutoff??requested.dataCutoff??snapshot.dataset.dataCutoff},undefined,false);history.push({period:start.slice(0,7),scope:a.scope,metrics:a.metrics});}
    const dimensions:DashboardResult['dimensions']=[];
    for(const r of snapshot.records.filter(r=>(r.kind==='campus'||r.kind==='course')&&(!requested.authorizedCampusIds.length||r.kind!=='campus'||requested.authorizedCampusIds.includes(r.sourceId))&&(!(r.kind==='campus'?requested.campusIds:requested.courseIds).length||(r.kind==='campus'?requested.campusIds:requested.courseIds).includes(r.sourceId)))){const a=await operations.queryPrepared(prepared,{...requested,...(r.kind==='campus'?{campusIds:[r.sourceId]}:{courseIds:[r.sourceId]})},undefined,false);dimensions.push({kind:r.kind as 'campus'|'course',id:r.sourceId,name:String(r.payload.name),metrics:a.metrics});}
    const channelAnalysis=await channels.queryPrepared(prepared,requested);
    const allDimensions:DashboardResult['dimensions']=[...dimensions,...channelAnalysis.groups.map(g=>({kind:'channel' as const,id:g.id,name:g.name,metrics:g.analysis.metrics}))];
    const sourceFingerprint=createHash('sha256').update(JSON.stringify({datasetId:id,batches:snapshot.batches.filter(b=>b.status==='completed').map(b=>({id:b.id,kind:b.kind,rows:b.acceptedRows,hash:b.fileHash})).sort((a,b)=>a.id.localeCompare(b.id))})).digest('hex');
    const completeness=operationalKinds.map(kind=>{const batches=snapshot.batches.filter(b=>b.kind===kind&&b.status==='completed'),rows=batches.reduce((n,b)=>n+b.acceptedRows,0),expected=snapshot.dataset.expectedRows?.[kind]??null;return {kind,name:kindLabels[kind],status:!batches.length?'missing':expected===null||rows===expected?'complete':'partial',rows,expected};}) as DashboardResult['completeness'];
    const evidence=analysis.metrics.find(m=>m.code==='hours_progress')?.evidence??[];
    let balances:DashboardResult['balances']={status:snapshot.dataset.origin==='public'?'not_applicable':'insufficient_data',asOf:analysis.scope.endDate,values:[],unknown:0,evidence};
    if(snapshot.dataset.origin==='simulated'){
        const facts=buildStudentBusinessFacts(details.snapshot,analysis.scope,details.aggregate.attendance),people=new Map<string,typeof facts.contexts>();for(const c of facts.contexts.filter(c=>c.active)){let cs=people.get(c.studentId);if(!cs){cs=[];people.set(c.studentId,cs);}cs.push(c);}
        const counts=new Map<string,number>();let unknown=0;for(const cs of people.values()){const known=cs.filter(c=>c.hours.status==='ready');let label:string;if(cs.some(c=>c.hours.status==='unknown')){label='待核查';unknown++;}else if(!known.length)label='无有效合约';else {const n=known.reduce((sum,c)=>sum+(c.hours.remaining??0),0);label=n===0?'零余额':n<=8?'0至8课时':n<=24?'8至24课时':n<=60?'24至60课时':'60课时以上';}counts.set(label,(counts.get(label)??0)+1);}
        const order=['零余额','0至8课时','8至24课时','24至60课时','60课时以上','无有效合约','待核查'];balances={status:completeness.filter(v=>['class','enrollment','contract','hours','refund'].includes(v.kind)).every(v=>v.status==='complete')?'ready':'insufficient_data',asOf:facts.contexts[0]?.asOf??analysis.scope.endDate,values:order.map(label=>({label,count:counts.get(label)??0})),unknown,evidence};
    }
    const resources:DashboardResult['resources']={status:'ready',alerts:[],reports:[],proposals:[],snapshots:[],errors:[]};
    try{
        const rows=await queryRows<{id:string;action:string;state:string;recordType:string;version:number;sourceSnapshot:{scope:AuthorizedScope;evidence:EvidenceReference[];answer:{facts:{evidenceIds:string[]}[]};source:{id:string}}}>(`SELECT id,action,state,"recordType",version,"sourceSnapshot" FROM decision_task WHERE "organizationId"=$1 AND "datasetId"=$2 ORDER BY "updatedAt" DESC LIMIT 100`,[requested.organizationId,id]);
        resources.decisions=rows.filter(r=>sameSelection(r.sourceSnapshot.scope,analysis.scope)).map(r=>({id:r.id,action:r.action,state:r.state,recordType:r.recordType,version:r.version,dataCutoff:r.sourceSnapshot.scope.dataCutoff??'',historical:r.sourceSnapshot.scope.dataCutoff!==analysis.scope.dataCutoff||r.sourceSnapshot.evidence.some(e=>e.kind==='metric'&&e.sourceId===id&&e.version.startsWith('operations-')&&!!e.scope&&sameSelection(e.scope,analysis.scope)&&!analysis.metrics.some(m=>m.evidence.some(current=>current.sourceId===e.sourceId&&current.version===e.version)))}));
        const runs=await queryRows<{scope:AuthorizedScope;answer:{recommendations:string[]};id:string}>(`SELECT e.id,e.answer,s.scope FROM agent_execution e JOIN agent_session s ON s.id=e."sessionId" WHERE e."organizationId"=$1 AND s."datasetId"=$2 AND e.status=ANY($3::text[]) AND e.answer IS NOT NULL ORDER BY e."startedAt" DESC LIMIT 50`,[requested.organizationId,id,['completed','awaiting_confirmation']]);
        const reportSuggestions=await queryRows<{id:string;snapshot:{scope:AuthorizedScope};answer:{recommendations:string[]}}>(`SELECT id,snapshot,answer FROM operational_report WHERE "organizationId"=$1 AND "datasetId"=$2 AND status='completed' ORDER BY "createdAt" DESC LIMIT 50`,[requested.organizationId,id]);
        const sources=runs.filter(r=>sameSelection(r.scope,analysis.scope)).flatMap(r=>r.answer.recommendations.map((_,i)=>'agent:'+r.id+':'+i)).concat(reportSuggestions.filter(r=>sameSelection(r.snapshot.scope,analysis.scope)).flatMap(r=>r.answer.recommendations.map((_,i)=>'report:'+r.id+':'+i)));
        const adopted=await queryRows<{sourceKey:string}>(`SELECT "sourceKey" FROM decision_task WHERE "organizationId"=$1 AND "datasetId"=$2`,[requested.organizationId,id]);
        resources.pendingDecisions=sources.filter(s=>!adopted.some(r=>r.sourceKey===s)).length;
    }catch{resources.errors.push('决策记录暂不可读取，请检查追加建表区块');}
    const historical=(saved:DashboardResult['analysis'])=>JSON.stringify(saved.batches.map(b=>[b.id,b.hash,b.rows]).sort())!==JSON.stringify(analysis.batches.map(b=>[b.id,b.hash,b.rows]).sort());
    const results=await Promise.allSettled([
        queryRows<Omit<AlertVO,'createdAt'|'updatedAt'>&{hit:AlertHit;createdAt:Date;updatedAt:Date}>(`SELECT id,"datasetId","scopeKey",fingerprint,state,active,version,note,hit,snapshot,"createdAt","updatedAt" FROM operational_alert WHERE "organizationId"=$1 AND "datasetId"=$2 AND active AND state<>'resolved' ORDER BY "createdAt" DESC`,[requested.organizationId,id]),
        queryRows<Omit<ReportVO,'createdAt'|'completedAt'>&{createdAt:Date;completedAt:Date|null}>(`SELECT id,"datasetId",kind,status,snapshot,facts,answer,evidence,steps,"errorMessage","createdAt","completedAt" FROM operational_report WHERE "organizationId"=$1 AND "datasetId"=$2 AND status='completed' ORDER BY "createdAt" DESC`,[requested.organizationId,id]),
        riskTags.list(requested.organizationId),riskSegments.summaries(requested.organizationId),
    ]);
    for(const [i,result] of results.entries()){
        if(result.status==='rejected'){resources.status='error';resources.errors.push(['预警','报告','标签','人群'][i]+'暂不可用');continue;}
        if(i===0)resources.alerts=(result.value as unknown as (AlertVO&{hit:AlertHit})[]).filter(a=>sameSelection(a.snapshot.scope,analysis.scope)).slice(0,5).map(({hit,...a})=>({...a,...hit,createdAt:new Date(a.createdAt).toISOString(),updatedAt:new Date(a.updatedAt).toISOString(),historicalBatch:historical(a.snapshot)}));
        if(i===1)resources.reports=(result.value as unknown as ReportVO[]).filter(r=>sameSelection(r.snapshot.scope,analysis.scope)).slice(0,3).map(r=>({...r,createdAt:new Date(r.createdAt).toISOString(),completedAt:r.completedAt?new Date(r.completedAt).toISOString():null,historicalBatch:historical(r.snapshot)}));
        if(i===2)resources.proposals=(result.value as Awaited<ReturnType<typeof riskTags.list>>).filter(p=>p.datasetId===id&&sameSelection(p.scope,analysis.scope)&&p.status!=='published').slice(0,5).map(p=>({id:p.id,name:p.name,version:p.version,memberCount:p.preview?.memberCount??null,status:p.status,ruleSummary:ruleDescription(p.rule),dataCutoff:p.preview?.scope.dataCutoff??p.scope.dataCutoff??'',sourceFingerprint:p.preview?.sourceFingerprint??'',historical:!!p.preview&&p.preview.sourceFingerprint!==sourceFingerprint}));
        if(i===3)resources.snapshots=(result.value as Awaited<ReturnType<typeof riskSegments.summaries>>).filter(p=>p.datasetId===id&&sameSelection(p.preview.scope,analysis.scope)).slice(0,5).map(p=>({id:p.id,name:p.name,version:p.tagVersion,memberCount:p.memberCount,status:'completed',dataCutoff:p.preview.scope.dataCutoff!,sourceFingerprint:p.preview.sourceFingerprint,historical:p.preview.sourceFingerprint!==sourceFingerprint}));
    }
    const funnel=channelAnalysis.groups.length?channelAnalysis.groups.map(g=>g.funnel).reduce((a,b)=>({...a,leads:a.leads+b.leads,trialAttended:a.trialAttended+b.trialAttended,converted:a.converted+b.converted,afterTrial:a.afterTrial+b.afterTrial,direct:a.direct+b.direct,pending:a.pending+b.pending,missingLinks:a.missingLinks+b.missingLinks,complete:a.complete&&b.complete})):null;
    const admissionResult=funnel?{status:funnel.complete?'ready':'insufficient_data',leads:funnel.leads,trials:funnel.trialAttended,afterTrial:funnel.afterTrial,direct:funnel.direct,pending:funnel.pending,reason:'同一线索获取批次、来源渠道和30天观察窗口，试听后签约与直接签约分别去重',evidence:analysis.metrics.find(m=>m.code==='admission_conversion')?.evidence??[]} as DashboardResult['admission']:admission(snapshot,analysis);
    return {analysis,definitions:metricDefinitions,history,dimensions:allDimensions,channelAnalysis:{unknown:channelAnalysis.unknown,attributionVersion:channelAnalysis.attributionVersion,notes:channelAnalysis.notes},admission:admissionResult,balances,completeness,resources,sourceFingerprint};
}
