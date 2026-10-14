'use client';
import {useEffect,useState} from 'react';
import {Alert,Button,Card,Collapse,Flex,Select,Steps,Tag,Typography} from 'antd';
import {useAuthStore} from '@/modules/identity/client';
import {useBusinessApi} from '@/shared/ui/use-business-api';
import {analysisHref,selectionFromSearch,scopeKey} from '@/shared/lib/analysis-navigation';
import type {AnalysisSelection} from '@/shared/lib/analysis-navigation';
import type {JourneyVO} from '../contracts';
type RecordKind='analysis'|'runId'|'proposalId'|'snapshotId'|'reportId'|'taskId';
const nodes=['runId','proposalId','snapshotId','reportId','taskId'] as const;
function key(selection:AnalysisSelection){const user=useAuthStore.getState().user?.id??'local';return 'education-review:'+user+':'+new URLSearchParams(window.location.search).get('review')+':'+scopeKey(selection);}
export function rememberReviewRecord(kind:RecordKind,id:string,selection?:AnalysisSelection){
 if(typeof window==='undefined'||!new URLSearchParams(window.location.search).has('review'))return;const s=selection??selectionFromSearch(window.location.search);if(!s)return;
 try{const name=key(s),old=JSON.parse(localStorage.getItem(name)??'{}'),url=new URL(window.location.href);if(old[kind]===id&&url.searchParams.get(kind)===id)return;
  const clear=kind==='runId'?['proposalId','snapshotId','reportId','taskId']:kind==='proposalId'?[...(old.proposalId&&old.proposalId!==id?['runId']:[]),'snapshotId','reportId','taskId']:kind==='snapshotId'||kind==='reportId'?['taskId']:[];
  clear.forEach(k=>{delete old[k];url.searchParams.delete(k);});old[kind]=id;localStorage.setItem(name,JSON.stringify(old));if(kind!=='analysis')url.searchParams.set(kind,id);
  const scopeUrl=new URL(analysisHref(url.pathname,s),window.location.origin);url.searchParams.set('datasetId',s.datasetId);url.searchParams.set('scope',scopeUrl.searchParams.get('scope')!);window.history.replaceState(window.history.state,'',url);window.dispatchEvent(new Event('education-review-progress'));
 }catch{/* 本地存储不可用时仍可通过保存对象继续。 */}
}
export default function ReviewGuide({selection}:{selection?:AnalysisSelection|null}){
 const api=useBusinessApi(),[scenario,setScenario]=useState(''),[data,setData]=useState<JourneyVO|null>(null),[error,setError]=useState(''),[visited,setVisited]=useState(false),[revision,setRevision]=useState(0);
 const resolved=selection??(typeof window!=='undefined'?selectionFromSearch(window.location.search):null),selectionKey=resolved?scopeKey(resolved):'';
 useEffect(()=>{let alive=true,sequence=0;const review=new URLSearchParams(window.location.search).get('review');setScenario(review??'');setData(null);setError('');if(!review||!resolved)return;
  const load=async()=>{const generation=++sequence,params=new URLSearchParams(window.location.search);let saved:Record<string,string>={};try{saved=JSON.parse(localStorage.getItem(key(resolved))??'{}');}catch{/* URL仍可恢复。 */}
   setVisited(!!saved.analysis);const records=Object.fromEntries(nodes.map(k=>[k,params.get(k)??saved[k]]).filter(([,v])=>!!v));
   try{const result=await api<JourneyVO>('/api/overview/journey/query',{datasetId:resolved.datasetId,scope:JSON.parse(new URL(analysisHref('/dashboard',resolved),window.location.origin).searchParams.get('scope')!),...records});if(alive&&generation===sequence){setData(result);setError('');}}catch(e){if(alive&&generation===sequence)setError((e as Error).message);}
  };void load();window.addEventListener('education-review-progress',load);return()=>{alive=false;window.removeEventListener('education-review-progress',load);};
 },[api,selectionKey,revision]);
 if(!scenario)return null;
 if(!resolved)return null;
 const records=data?.records??{},ready=[...(data?.ready??Array(8).fill(false))];ready[0]=visited;const first=ready.findIndex(v=>!v),current=first<0?7:first,extra={review:scenario,...Object.fromEntries(Object.entries(records).filter(([,v])=>!!v))} as Record<string,string>;
 const link=(path:string,more:Record<string,string>={})=>analysisHref(path,resolved,{...extra,...more}),agent=link('/dashboard/agent',{...(records.sessionId?{sessionId:records.sessionId}:{}),prompt:scenario==='combination'?'创建出勤率低于80%、应出勤至少4次且同校区同课程未来30天到期尚未续费的组合标签，查询指标与口径并预览。':'查询指标与口径，解释出勤变化，创建出勤率低于80%、应出勤至少4次的标签草稿并预览。'});
 const actions=[{label:'查看当前范围指标',href:link('/dashboard')},{label:'提交智能分析',href:agent},{label:'生成或编辑标签草稿',href:records.runId?agent:link('/dashboard/tags/risk')},{label:'核对规则并重新预览',href:link('/dashboard/tags/risk')},{label:'核对并确认发布',href:link('/dashboard/tags/risk')},{label:'保存人群并查看画像',href:records.snapshotId?link('/dashboard/data/portrait'):link('/dashboard/tags/risk')},{label:'生成或选择报告',href:link('/dashboard/reports')},{label:records.taskId?'继续执行与复核':'核对建议并安排任务',href:link('/dashboard/decisions',{...(records.reportId?{sourceId:records.reportId}:records.runId?{sourceId:records.runId}:{})})}];
 return <Card size="small" className="review-guide" title={<Flex gap={8} wrap><Tag color="purple">分步操作</Tag><span>{scenario==='combination'?'同课程组合标签':'出勤异常分析'}</span></Flex>} extra={<Button size="small" onClick={()=>{const url=new URL(window.location.href);url.searchParams.delete('review');window.location.assign(url.pathname+url.search);}}>退出引导</Button>}>

  {error&&<Alert style={{marginTop:12}} type="warning" title={error} description="请核对所选对象，或从操作指南选择已有记录继续。" action={<Button onClick={()=>setRevision(n=>n+1)}>重新核验</Button>}/>}
  {!!data?.blockers.length&&<Flex gap={8} wrap style={{marginTop:12}}>{data.blockers.map(b=><Button key={b.message} href={b.href}>{b.message}</Button>)}</Flex>}
  <Flex gap={12} wrap align="center" style={{marginTop:16}}><Typography.Text strong>{first<0?'此流程已完成复核':'下一步：'+actions[current].label}</Typography.Text><Button type="primary" disabled={!!error||!data} href={actions[first<0?7:current].href}>{first<0?'查看复核记录':actions[current].label}</Button><Button href="/dashboard/help">步骤说明</Button></Flex>
  {current===6&&!!data?.reports.length&&<Select aria-label="关联已有报告" placeholder="选择同范围已完成报告" style={{width:'100%',marginTop:12}} value={records.reportId} options={data.reports.map(r=>({value:r.id,label:r.label}))} onChange={id=>{rememberReviewRecord('reportId',id,resolved);setRevision(n=>n+1);}}/>}
  {!!data?.warnings.length&&<Typography.Paragraph type="warning" style={{marginTop:12}}>{data.warnings.join('；')}</Typography.Paragraph>}
  <Collapse ghost items={[{key:"flow",label:"查看完整流程",children:(<Steps size="small" current={current} items={['查看指标','智能解释','标签草稿','覆盖预览','人工发布','人群画像','报告依据','决策复核'].map((title,i)=>({title,status:ready[i]?'finish':i===current?'process':'wait'}))}/>)}]}/>
  <Collapse ghost style={{marginTop:12}} items={[{key:'saved',label:'查看已有结果',children:<Flex gap={8} wrap>{records.runId&&<Button href={agent}>查看分析结果</Button>}{records.proposalId&&<Button href={link('/dashboard/tags/risk')}>查看标签</Button>}{records.snapshotId&&<Button href={link('/dashboard/data/portrait')}>查看人群画像</Button>}{records.reportId&&<Button href={link('/dashboard/reports/'+records.reportId)}>查看报告</Button>}{records.taskId&&<Button href={link('/dashboard/decisions')}>查看决策任务</Button>}</Flex>}]} />
 </Card>;
}
