'use client';
import {Suspense,useEffect,useState,useRef,useMemo,useCallback} from 'react';
import {useSearchParams} from 'next/navigation';
import {Alert,Button,Card,Collapse,Descriptions,Drawer,Empty,Flex,Input,Skeleton,Table,Tabs,Tag,Typography} from 'antd';
import {ArrowLeftOutlined,SearchOutlined,TeamOutlined} from '@ant-design/icons';
import dayjs from 'dayjs';
import {useBusinessApi} from '@/shared/ui/use-business-api';
import {analysisHref,selectionFromSearch,sameAnalysisRange,type AnalysisSelection} from '@/shared/lib/analysis-navigation';
import AnalysisRangeSummary from '@/shared/ui/AnalysisRangeSummary';
import BusinessChart from '@/shared/ui/BusinessChart';
import {barOption} from '@/shared/ui/chart-options';
import {ReviewGuide,rememberReviewRecord} from '@/modules/overview/client';
import {ruleDescription} from '@/modules/tag/contracts';
import type {RiskSegmentSnapshotVO,RiskSnapshotPage} from '@/modules/segment/contracts';
import {useAuthStore} from '@/modules/identity/client';
import type {RiskCrowdProfileVO,RiskStudentProfileVO} from '../contracts';
import styles from './RiskProfilesPage.module.css';

function Distribution({data}:{data:RiskCrowdProfileVO['distributions'][number]}){
 const option=useMemo(()=>barOption(data.values.map(v=>v.label),data.values.map(v=>v.count),'人'),[data]);
 return <Card className={styles.distributionCard} size="small" title={data.title}><BusinessChart title={data.title} option={option} rows={data.values.map(v=>({分类:v.label,学员数:v.count}))} empty={!data.values.some(v=>v.count)}/></Card>;
}
const aborted=(error:unknown)=>error instanceof Error&&error.name==='AbortError';

/** Reads one frozen cohort. It never chooses a different cohort on failure. */
export function RiskProfilePanel({snapshotId,selection,onSnapshot}:{snapshotId:string;selection?:AnalysisSelection|null;onSnapshot?:(snapshot:RiskSegmentSnapshotVO)=>void}){
 const api=useBusinessApi(),token=useAuthStore(s=>s.token);
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(20),[tab,setTab]=useState('summary'),[reload,setReload]=useState(0),[exporting,setExporting]=useState(false);
 const [crowd,setCrowd]=useState<RiskCrowdProfileVO|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [student,setStudent]=useState<RiskStudentProfileVO|null>(null),[drawerOpen,setDrawerOpen]=useState(false),[studentLoading,setStudentLoading]=useState(false),[studentError,setStudentError]=useState(''),[entityId,setEntityId]=useState('');
 const studentRequest=useRef<AbortController|null>(null),exportRequest=useRef<AbortController|null>(null),activeSnapshot=useRef(snapshotId);activeSnapshot.current=snapshotId;
 useEffect(()=>{setPage(1);setTab('summary');setDrawerOpen(false);setStudent(null);studentRequest.current?.abort();exportRequest.current?.abort();return()=>{studentRequest.current?.abort();exportRequest.current?.abort();};},[snapshotId]);
 useEffect(()=>{
  if(!snapshotId){setLoading(false);setCrowd(null);return;}
  const controller=new AbortController();setLoading(true);setError('');setCrowd(null);
  api<RiskCrowdProfileVO>('/api/profiles/search',{snapshotId,pagination:{page,pageSize}},undefined,controller.signal).then(result=>{
   if(controller.signal.aborted)return;setCrowd(result);onSnapshot?.(result.snapshot);
   if(!selection||(selection.datasetId===result.snapshot.datasetId&&sameAnalysisRange(selection.scope,result.snapshot.preview.scope)))rememberReviewRecord('snapshotId',result.snapshot.id,{datasetId:result.snapshot.datasetId,scope:result.snapshot.preview.scope});
  }).catch(e=>{if(!aborted(e)&&!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[api,snapshotId,page,pageSize,reload,onSnapshot,selection]);
 const detail=async(nextEntityId:string)=>{
  studentRequest.current?.abort();const controller=new AbortController();studentRequest.current=controller;
  const selected=snapshotId;setEntityId(nextEntityId);setStudent(null);setStudentError('');setStudentLoading(true);setDrawerOpen(true);
  try{const result=await api<RiskStudentProfileVO>('/api/profiles/search',{snapshotId:selected,entityId:nextEntityId},undefined,controller.signal);if(!controller.signal.aborted&&activeSnapshot.current===selected)setStudent(result);}catch(e){if(!aborted(e)&&!controller.signal.aborted)setStudentError(e instanceof Error?e.message:'画像查询失败');}finally{if(!controller.signal.aborted)setStudentLoading(false);}
 };
 const exportMembers=async()=>{
  if(exporting)return;exportRequest.current?.abort();const controller=new AbortController();exportRequest.current=controller;setExporting(true);
  try{const response=await fetch('/api/segments/risk-snapshots/'+encodeURIComponent(snapshotId)+'/export',{headers:{Authorization:'Bearer '+token},signal:controller.signal});if(!response.ok){const body=await response.json();throw Error(body.message??'导出失败');}const blob=await response.blob();if(controller.signal.aborted)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='人群成员-'+snapshotId+'.csv';link.click();URL.revokeObjectURL(url);}catch(e){if(!aborted(e))setError((e as Error).message);}finally{setExporting(false);}
 };
 const p=crowd?.snapshot.preview,a=crowd?.attendance,b=crowd?.business;
 const mismatch=!!crowd&&!!selection&&(crowd.snapshot.datasetId!==selection.datasetId||!sameAnalysisRange(selection.scope,crowd.snapshot.preview.scope));
 const fullBasis=crowd&&<Collapse ghost items={[{key:'basis',label:'查看冻结说明与完整数据依据',children:<Flex vertical gap={12}>{crowd.facts.map((t,i)=><Typography.Paragraph key={i}>{t}</Typography.Paragraph>)}{crowd.hypotheses.length>0&&<div><Typography.Text strong>待验证原因</Typography.Text>{crowd.hypotheses.map((t,i)=><Typography.Paragraph key={i}>{t}</Typography.Paragraph>)}</div>}<Descriptions column={1} size="small" items={[{key:'saved',label:'保存方式',children:'保存当时的名单，后续数据不会自动改变成员。'},{key:'version',label:'标签版本',children:'v'+crowd.snapshot.tagVersion},{key:'basis',label:'数据依据',children:p!.batches.length+' 个完成批次；概况与分布统计全部成员，名单按页读取。'},{key:'attendance',label:'出勤核对',children:a&&((a.observedStudents??0)>0||a.due>0)?'已出勤 '+a.present+' / 应出勤 '+a.due+'；缺勤 '+a.absent+'、请假 '+a.leave+'、未知 '+a.unknown+' 人次。':'未计算，不以零替代。'},{key:'balance',label:'课时余额',children:b?'可核对 '+b.knownBalanceStudents+' 人，待核查 '+b.unknownBalanceStudents+' 人；截至 '+b.asOf:'尚未计算'},{key:'source',label:'建议来源',children:'固定业务流程，尚未使用大模型生成。'}]}/></Flex>}]} />;
 return <section className={styles.panel} aria-label="所选人群画像" data-testid="cohort-profile-panel">
  {loading&&<div className={styles.panelPadding}><Skeleton active/></div>}
  {error&&<Alert type="error" title={error} showIcon action={<Button onClick={()=>setReload(n=>n+1)}>重新查询</Button>}/>}
  {crowd&&<><header className={styles.profileHeading}><div><Typography.Title level={4}>{crowd.snapshot.name}</Typography.Title><Flex gap={6} wrap><Tag color="green">已保存 · 标签 v{crowd.snapshot.tagVersion}</Tag><Typography.Text type="secondary">{crowd.snapshot.memberCount} 名成员</Typography.Text></Flex></div><Button onClick={()=>setTab('members')}>查看成员名单</Button></header>
   {mismatch&&<Alert type="warning" title="正在查看此人群保存时的范围，与进入页面时的范围不同。"/>}
   <AnalysisRangeSummary name={p!.dataset.name} origin={p!.dataset.origin} scope={p!.scope} catalog={p!.catalog} frozen/>
   <Tabs activeKey={tab} onChange={setTab} className={styles.profileTabs} items={[
    {key:'summary',label:'概要',children:<div className={styles.summaryContent}><div className={styles.profileStats}>{[{label:'学员人数',value:crowd.snapshot.memberCount,unit:'人'},{label:'群体出勤率',value:a!.rate,unit:'%'},{label:'30天内续费待跟进',value:b?.renewalFollowupStudents??null,unit:'人'},{label:'30天内发生客诉',value:b?.recentComplaintStudents??null,unit:'人'}].map(s=><div key={s.label}><small>{s.label}</small><strong>{s.value===null?'—':s.value}<small>{s.value===null?'':' '+s.unit}</small></strong></div>)}</div><Flex gap={8} wrap>{!!a!.unknown&&<Tag color="orange">未知签到 {a!.unknown} 人次</Tag>}{!!b?.unknownBalanceStudents&&<Tag color="orange">课时余额待核查 {b.unknownBalanceStudents} 人</Tag>}{a!.rate===null&&<Tag>出勤数据不足或未计算</Tag>}</Flex><div className={styles.keyRule}><Typography.Text strong>本次筛选规则</Typography.Text><Typography.Paragraph>{p!.rule?ruleDescription(p!.rule):'历史出勤规则'}</Typography.Paragraph></div><section className={styles.followup}><Typography.Title level={5}>跟进建议 <Tag>固定业务流程</Tag></Typography.Title>{crowd.actions.slice(0,3).map((text,i)=><Typography.Paragraph key={i} ellipsis={{rows:2,expandable:true,symbol:'展开'}}>{i+1}. {text}</Typography.Paragraph>)}{!crowd.actions.length&&<Empty description="暂无跟进建议"/>}</section>{fullBasis}</div>},
    {key:'distributions',label:'分布',children:<div className={styles.featureGrid}>{crowd.distributions.map(d=><Distribution key={d.key} data={d}/>)}{!crowd.distributions.length&&<Empty description="尚无可计算分布"/>}</div>},
    {key:'members',label:'成员',children:<div className={styles.membersContent}><Flex justify="space-between" align="center" wrap gap={8}><Typography.Text type="secondary">概况按全部成员计算，名单分批加载</Typography.Text><Button loading={exporting} onClick={()=>void exportMembers()}>导出名单</Button></Flex><Table rowKey="studentId" size="small" dataSource={p!.members} pagination={{current:page,pageSize,total:crowd.pagination?.total??crowd.snapshot.memberCount,showSizeChanger:true,pageSizeOptions:[10,20,50,100],onChange:(next,size)=>{setPage(size!==pageSize?1:next);setPageSize(size);}}} scroll={{x:650}} columns={[{title:'学员',dataIndex:'displayName',width:130},{title:'出勤率',dataIndex:'attendanceRate',width:100,render:v=>v===null?'未知':v===undefined?'未计算':v+'%'},{title:'命中依据',dataIndex:'reason'},{title:'操作',width:120,render:(_,member)=><Button onClick={()=>void detail(member.studentId)}>学员画像</Button>}]} /></div>}
   ]}/>
  </>}
  <Drawer className={styles.studentDrawer} title="学员画像" open={drawerOpen} onClose={()=>{studentRequest.current?.abort();setDrawerOpen(false);setStudent(null);}} size="large">{studentLoading&&<Skeleton active/>}{studentError&&<Alert type="error" title={studentError} action={<Button onClick={()=>void detail(entityId)}>重试查询</Button>}/>}{student&&<><Flex gap={8} wrap><Tag color={student.origin==='simulated'?'orange':'blue'}>{student.origin==='simulated'?'模拟经营':'公开数据'}</Tag><Typography.Text>{student.datasetName}</Typography.Text></Flex>{p&&<Typography.Paragraph type="secondary" style={{marginTop:12}}>{p.scope.startDate} 至 {p.scope.endDate} · 截止 {p.scope.dataCutoff?dayjs(p.scope.dataCutoff).format('YYYY-MM-DD HH:mm:ss'):'未提供'}</Typography.Paragraph>}<Descriptions column={1} items={[{key:'name',label:'学员',children:student.displayName},{key:'grade',label:'年级',children:student.gradeBand},{key:'rate',label:'统计期出勤',children:student.due===undefined?'未计算':student.present+'/'+student.due+'，'+(student.attendanceRate===null?'未知':student.attendanceRate+'%')},{key:'tag',label:'标签版本',children:'v'+student.tagVersion},{key:'reason',label:'命中依据',children:student.reason}]}/>{student.business?.map(c=><Card size="small" key={c.campusId+c.courseId} title={c.campusName+' / '+c.courseName} style={{marginTop:16}}><Typography.Paragraph type="secondary">业务事实截至 {c.asOf}</Typography.Paragraph><Descriptions column={1} items={[{key:'hours',label:'剩余课时',children:c.hours.status==='ready'?c.hours.remaining+' 课时（购课 '+c.hours.purchased+' − 净课耗 '+c.hours.consumed+' − 退款 '+c.hours.refunded+'）':c.hours.reason},{key:'contract',label:'有效合约',children:c.renewalComplete?c.contracts.map(v=>v.endDate+' 到期；'+(v.renewalEligible==='yes'?'具备续费资格':v.renewalEligible==='no'?'无需续费':'资格缺失')+'；'+(v.renewed?'截至当日已续费':'截至当日无已知续费')).join('；')||'无':'数据未完整导入'},{key:'complaints',label:'历史客诉',children:c.complaintsComplete?c.complaints.map(v=>v.occurredAt.slice(0,10)+' '+v.category).join('；')||'无已知记录':'数据未完整导入'}]}/></Card>)}<Collapse ghost items={[{key:'technical',label:'查看内部编号',children:<Typography.Text>{student.studentId}</Typography.Text>}]} /></>}</Drawer>
 </section>;
}

export function RiskProfilesWorkspace({title='人群画像',listPath='/api/profiles'}:{title?:string;listPath?:string}){
 const api=useBusinessApi(),search=useSearchParams(),datasetParam=search.get('datasetId'),scopeParam=search.get('scope'),explicitId=search.get('snapshotId');
 const selection=useMemo(()=>selectionFromSearch(new URLSearchParams({...(datasetParam?{datasetId:datasetParam}:{}),...(scopeParam?{scope:scopeParam}:{})}).toString()),[datasetParam,scopeParam]);
 const [rows,setRows]=useState<RiskSegmentSnapshotVO[]>([]),[loading,setLoading]=useState(true),[selectionLoading,setSelectionLoading]=useState(false),[error,setError]=useState(''),[objectError,setObjectError]=useState(''),[reload,setReload]=useState(0),[id,setId]=useState(''),[query,setQuery]=useState(''),[mobileDetail,setMobileDetail]=useState(!!explicitId),[selected,setSelected]=useState<RiskSegmentSnapshotVO|null>(null);
 const activeId=useRef(id);activeId.current=id;const explicitRef=useRef(explicitId);explicitRef.current=explicitId;
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('');setObjectError('');setRows([]);setSelected(null);setId('');
  const params=new URLSearchParams({summary:'true',...(selection?{datasetId:selection.datasetId,scope:JSON.stringify(selection.scope)}:{})});
  api<RiskSegmentSnapshotVO[]>(listPath+'?'+params,undefined,undefined,controller.signal).then(found=>{
   if(controller.signal.aborted)return;setRows(found);const next=explicitRef.current??found[0]?.id??'';setId(found.some(row=>row.id===next)?next:'');setSelected(found.find(row=>row.id===next)??null);
  }).catch(e=>{if(!aborted(e)&&!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[api,listPath,selection,reload]);
 useEffect(()=>{
  if(loading)return;
  if(!explicitId){const fallback=rows.find(row=>!selection||(row.datasetId===selection.datasetId&&sameAnalysisRange(row.preview.scope,selection.scope)));setId(fallback?.id??'');setSelected(fallback??null);setSelectionLoading(false);setObjectError('');return;}
  const controller=new AbortController();const found=rows.find(row=>row.id===explicitId);
  setObjectError('');setMobileDetail(true);
  if(found){setId(found.id);setSelected(found);setSelectionLoading(false);return()=>controller.abort();}
  setId('');setSelected(null);setSelectionLoading(true);
  api<RiskSnapshotPage>('/api/segments/risk-snapshots/'+encodeURIComponent(explicitId)+'?page=1&pageSize=1',undefined,undefined,controller.signal).then(result=>{if(!controller.signal.aborted){setRows(current=>current.some(row=>row.id===result.snapshot.id)?current:[result.snapshot,...current]);setId(result.snapshot.id);setSelected(result.snapshot);}}).catch(e=>{if(!aborted(e)&&!controller.signal.aborted)setObjectError('指定人群不存在或无法访问：'+e.message);}).finally(()=>{if(!controller.signal.aborted)setSelectionLoading(false);});
  return()=>controller.abort();
 },[api,explicitId,loading,reload]);
 const adopt=(row:RiskSegmentSnapshotVO)=>{setSelected(row);setId(row.id);setMobileDetail(true);const url=new URL(window.location.href);url.searchParams.set('snapshotId',row.id);for(const key of ['runId','proposalId','reportId','taskId'])url.searchParams.delete(key);if(url.href!==window.location.href)window.history.replaceState(null,'',url);};
 const onSnapshot=useCallback((snapshot:RiskSegmentSnapshotVO)=>{if(activeId.current===snapshot.id)setSelected(snapshot);},[]);
 const displayedError=objectError||error;
 const actual=selected?{datasetId:selected.datasetId,scope:selected.preview.scope}:selection;
 const shown=rows.filter(row=>!query.trim()||(row.name+' '+(row.preview.rule?ruleDescription(row.preview.rule):'')).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 return <div className={styles.page} data-testid="cohort-workspace"><header className={styles.toolbar}><div><Typography.Title level={3}>{title}</Typography.Title><Tag>{loading?'加载中':rows.length+' 份名单'}</Tag></div><Button type="primary" href={actual?analysisHref('/dashboard/tags/risk',actual):'/dashboard/tags/risk'}>创建人群</Button></header><ReviewGuide selection={actual}/>
  <div className={styles.split} data-mobile-detail={mobileDetail}>
   <aside className={styles.listPane} aria-label="已保存人群列表"><div className={styles.listHeading}><Input prefix={<SearchOutlined/>} aria-label="搜索已保存人群" placeholder="搜索人群或规则" value={query} onChange={e=>setQuery(e.target.value)}/><Typography.Text type="secondary">保存后的名单不会随数据更新改变</Typography.Text></div><div className={styles.listScroll}>{loading?<Skeleton active/>:error&&rows.length===0?<Alert type="error" title={error} action={<Button onClick={()=>setReload(n=>n+1)}>重新加载</Button>}/>:shown.length?shown.map(row=><button key={row.id} className={styles.listItem} data-selected={id===row.id} aria-pressed={id===row.id} onClick={()=>adopt(row)}><div className={styles.listItemTop}><TeamOutlined/><strong>{row.name}</strong><span>{row.memberCount}人</span></div><p>{row.preview.rule?ruleDescription(row.preview.rule):'历史出勤规则'}</p><div><Tag color={row.preview.dataset.origin==='simulated'?'orange':'blue'}>{row.preview.dataset.origin==='simulated'?'模拟经营':'公开数据'}</Tag><span>v{row.tagVersion} · {row.preview.scope.startDate.slice(5)}—{row.preview.scope.endDate.slice(5)}</span></div></button>):<Empty description={query?'没有匹配的人群':'当前范围暂无已保存人群'}/>}</div></aside>
   <main className={styles.detailPane} aria-label="人群画像与名单"><div className={styles.mobileBack}><Button icon={<ArrowLeftOutlined/>} onClick={()=>setMobileDetail(false)}>返回人群列表</Button>{selected&&<Typography.Text ellipsis>{selected.name}</Typography.Text>}</div>{loading||selectionLoading||(!!explicitId&&explicitId!==id&&!displayedError)?<div className={styles.panelPadding}><Skeleton active/></div>:displayedError?<div className={styles.panelPadding}><Alert type="error" title={displayedError} action={<Button onClick={()=>setReload(n=>n+1)}>重新加载</Button>}/></div>:id?<RiskProfilePanel key={id} snapshotId={id} selection={selection} onSnapshot={onSnapshot}/>:<Empty description="从左侧选择人群查看画像；还没有名单时可创建人群"><Button type="primary" href={actual?analysisHref('/dashboard/tags/risk',actual):'/dashboard/tags/risk'}>创建人群</Button></Empty>}</main>
  </div>
 </div>;
}
export default function RiskProfilesPage(){return <Suspense fallback={<div>加载画像…</div>}><RiskProfilesWorkspace/></Suspense>;}
