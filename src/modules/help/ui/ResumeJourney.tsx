'use client';
import {useEffect,useState} from 'react';
import {Alert,Button,Card,Empty,Flex,Select,Typography} from 'antd';
import {useBusinessApi} from '@/shared/ui/use-business-api';
import {analysisHref} from '@/shared/lib/analysis-navigation';
import {isFinanceScope,isLearningScope} from '@/shared/contracts/analysis';
import type {AnalysisScope,AuthorizedAnalysisScope} from '@/shared/contracts/analysis';
import type {AgentSessionVO} from '@/modules/agent/contracts';
import type {RiskProposalVO} from '@/modules/tag/contracts';
import type {RiskSegmentSnapshotVO} from '@/modules/segment/contracts';
import type {DecisionTask} from '@/modules/decision/contracts';
interface Entry {id:string;label:string;path:string;datasetId:string;scope:AnalysisScope|AuthorizedAnalysisScope;extra:Record<string,string>;}
function scopeLabel(scope:Entry['scope']) {
 if('years' in scope)return scope.years.length?scope.years.join('、')+'年':'全部年度';
 if('courseKeys' in scope)return '相对日 '+(scope.relativeDayStart??'全部')+' 至 '+(scope.relativeDayEnd??'全部');
 return scope.startDate+' 至 '+scope.endDate;
}
function entryHref(entry:Entry) {
 if('years' in entry.scope)return entry.path+'?'+new URLSearchParams({datasetId:entry.datasetId,financeScope:JSON.stringify({years:entry.scope.years}),...entry.extra});
 if('courseKeys' in entry.scope){const scope=entry.scope;return entry.path+'?'+new URLSearchParams({datasetId:entry.datasetId,learningScope:JSON.stringify({courseKeys:scope.courseKeys,...(scope.relativeDayStart!==undefined?{relativeDayStart:scope.relativeDayStart}:{}),...(scope.relativeDayEnd!==undefined?{relativeDayEnd:scope.relativeDayEnd}:{})}),...entry.extra});}
 return analysisHref(entry.path,{datasetId:entry.datasetId,scope:entry.scope},{review:'attendance',...entry.extra});
}
export default function ResumeJourney(){
 const api=useBusinessApi(),[entries,setEntries]=useState<Entry[]>([]),[id,setId]=useState<string>(),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{let alive=true;setLoading(true);setError('');Promise.all([api<RiskProposalVO[]>('/api/tags/proposals'),api<RiskSegmentSnapshotVO[]>('/api/segments/risk-snapshots'),api<DecisionTask[]>('/api/decisions'),api<AgentSessionVO[]>('/api/agent/sessions')]).then(([tags,snapshots,tasks,sessions])=>{const rows:Entry[]=[...tasks.map(t=>({id:'task:'+t.id,label:'任务 · '+t.action.slice(0,60),path:'/dashboard/decisions',datasetId:t.datasetId,scope:t.sourceSnapshot.scope,extra:{taskId:t.id}})),...snapshots.map(s=>({id:'group:'+s.id,label:'人群 · '+s.name+' · '+s.memberCount+'人',path:'/dashboard/data/portrait',datasetId:s.datasetId,scope:s.preview.scope,extra:{snapshotId:s.id}})),...tags.map(t=>({id:'tag:'+t.id,label:'标签 · '+t.name+' · v'+t.version,path:'/dashboard/tags/risk',datasetId:t.datasetId,scope:t.preview?.scope??t.scope,extra:{proposalId:t.id}})),...sessions.map(s=>({id:'session:'+s.id,label:(isFinanceScope(s.scope)?'财务分析':isLearningScope(s.scope)?'学习分析':'经营分析')+' · '+s.title,path:'/dashboard/agent',datasetId:s.datasetId,scope:s.scope,extra:{sessionId:s.id}}))];if(alive)setEntries(rows);}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[api,revision]);
 const entry=entries.find(e=>e.id===id);
 return <Card title="继续已有记录">
  {error&&<Alert type="error" title={error} action={<Button onClick={()=>setRevision(n=>n+1)}>重新加载</Button>} style={{marginBottom:12}}/>}
  {!loading&&!error&&!entries.length?<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无已保存记录，先从上方选择任务。"/>:<Flex vertical gap={8}>
   <Flex gap={12} wrap><Select aria-label="继续已有流程" loading={loading} showSearch optionFilterProp="label" value={id} onChange={setId} placeholder={loading?'正在读取保存记录':'选择分析、标签、人群或任务'} style={{flex:1,minWidth:0,width:'100%'}} options={entries.map(e=>({value:e.id,label:e.label+' · '+scopeLabel(e.scope)}))}/><Button disabled={!entry} href={entry?entryHref(entry):undefined}>继续操作</Button></Flex>
   {entry&&<Typography.Text type="secondary">{scopeLabel(entry.scope)}</Typography.Text>}
  </Flex>}
 </Card>;
}
