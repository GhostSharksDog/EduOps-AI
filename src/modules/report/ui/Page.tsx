'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Alert,App,Button,Collapse,Empty,Flex,Input,Select,Tag,Typography} from 'antd';
import dayjs from 'dayjs';
import {useSearchParams} from 'next/navigation';
import {useAuthStore} from '@/modules/identity/client';
import {ScopePicker} from '@/modules/analytics/client';
import type {SelectedScope} from '@/modules/analytics/client';
import type {ReportVO} from '../contracts';
import {ReviewGuide,rememberReviewRecord} from '@/modules/overview/client';
import {sameAnalysisRange} from '@/shared/lib/analysis-navigation';
import {Workspace,WorkspaceToolbar,WorkspaceSplit,WorkspacePane} from '@/shared/ui/Workspace';
import ReportReader,{reportStates} from './ReportReader';
import styles from './Report.module.css';
export {reportStates} from './ReportReader';
export default function ReportPage(){
 const {message}=App.useApp(),params=useSearchParams(),token=useAuthStore(s=>s.token),role=useAuthStore(s=>s.user?.role),canWrite=role==='admin'||role==='operator';
 const [selectedInput,setSelectedInput]=useState<SelectedScope|null>(null),[kind,setKind]=useState<'weekly'|'monthly'>('monthly'),[items,setItems]=useState<ReportVO[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[filter,setFilter]=useState(''),[showCreate,setShowCreate]=useState(false),[detailOpen,setDetailOpen]=useState(false);
 const [selectedId,setSelectedId]=useState<string|null>(null),sequence=useRef(0);
 useEffect(()=>{const id=params.get('reportId');setSelectedId(id);setDetailOpen(!!id);},[params]);
 const selection=useMemo(()=>{if(!selectedInput)return null;const date=dayjs(selectedInput.scope.startDate),monday=date.subtract((date.day()+6)%7,'day');return {...selectedInput,scope:{...selectedInput.scope,startDate:(kind==='monthly'?date.startOf('month'):monday).format('YYYY-MM-DD'),endDate:(kind==='monthly'?date.endOf('month'):monday.add(6,'day')).format('YYYY-MM-DD')}};},[selectedInput,kind]);
 const load=useCallback(async()=>{const current=++sequence.current;setLoading(true);try{const r=await fetch('/api/reports',{headers:{Authorization:'Bearer '+token}}),b=await r.json();if(!r.ok)throw new Error(b.message);if(current===sequence.current){setItems(b.data);setError('');}}catch(e){if(current===sequence.current)setError(e instanceof Error?e.message:'报告服务不可用');}finally{if(current===sequence.current)setLoading(false);}},[token]);
 useEffect(()=>{void load();return()=>{++sequence.current;};},[load]);
 const shown=selection?items.filter(r=>r.datasetId===selection.datasetId&&sameAnalysisRange(r.snapshot.scope,selection.scope)&&(!filter||(r.snapshot.dataset.name+r.snapshot.scope.startDate+r.snapshot.scope.endDate+(r.kind==='monthly'?'月报':'周报')).includes(filter))):[];
 const open=(id:string,report?:ReportVO)=>{setSelectedId(id);setDetailOpen(true);const url=new URL(window.location.href);url.searchParams.set('reportId',id);if(report){url.searchParams.set('datasetId',report.datasetId);url.searchParams.set('scope',JSON.stringify(report.snapshot.scope));}if(url.href!==window.location.href)window.history.pushState(null,'',url);};
 const closeDetail=()=>{setDetailOpen(false);const url=new URL(window.location.href);url.searchParams.delete('reportId');if(url.href!==window.location.href)window.history.pushState(null,'',url);};
 const select=useCallback((s:SelectedScope)=>{setSelectedInput(s);},[]);
 const generate=async()=>{if(!selection||busy)return;setBusy(true);setError('');const requestKey=crypto.randomUUID();try{const r=await fetch('/api/reports',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({datasetId:selection.datasetId,kind,anchorDate:selection.scope.startDate,campusIds:selection.scope.campusIds,courseIds:selection.scope.courseIds,channelIds:selection.scope.channelIds,...(selection.scope.dataCutoff?{dataCutoff:selection.scope.dataCutoff}:{}),requestKey})}),b=await r.json();if(!r.ok)throw new Error(b.message);rememberReviewRecord('reportId',b.data.id);if(b.data.status==='failed')message.error(b.data.errorMessage??'报告生成失败，数据依据已保留');else if(b.data.status==='completed')message.success('报告已生成');await load();setShowCreate(false);open(b.data.id,b.data);}catch(e){await load();setError((e instanceof Error?e.message:'生成请求失败')+'；可以刷新列表核对已保存的任务。');}finally{setBusy(false);}};
 return <Workspace className={styles.reportWorkspace} fit label="运营报告工作区">
 <WorkspaceToolbar title="运营报告" actions={<Flex gap={8} wrap><Button href="/dashboard/help#report">帮助</Button><Button loading={loading} onClick={()=>void load()}>刷新</Button><Button type="primary" disabled={!canWrite} onClick={()=>setShowCreate(v=>!v)}>生成报告</Button></Flex>}/>
 <ScopePicker onChange={select} monthly/><ReviewGuide selection={selection}/>
 {error&&<Alert type="error" title={error} action={<Button onClick={()=>void load()}>重新加载</Button>}/>}
 {showCreate&&<section className={styles.compactCreate} aria-label="生成新报告"><Flex gap={12} align="center" wrap><Select aria-label="报告类型" value={kind} disabled={busy} onChange={setKind} style={{width:110}} options={[{value:'monthly',label:'月报'},{value:'weekly',label:'周报'}]}/><span className={styles.period}>{selection?selection.scope.startDate+' 至 '+selection.scope.endDate:'请先选择分析范围'}</span><Button type="primary" disabled={!selection||!canWrite||busy} loading={busy} onClick={()=>void generate()}>生成智能报告</Button><Button disabled={busy} onClick={()=>setShowCreate(false)}>收起</Button>{busy&&<Typography.Text type="secondary" role="status">正在冻结数据并生成分析，完成后在右侧打开。</Typography.Text>}</Flex><Collapse ghost items={[{key:'rules',label:'周期与生成说明',children:<Typography.Paragraph type="secondary" style={{margin:0}}>周报为周一至周日，月报为自然月。数据先冻结，原因需核查；生成最多等待两分钟，失败时保留数据依据。已有报告不会随新导入改写。</Typography.Paragraph>}]} /></section>}
 <WorkspaceSplit columns="minmax(250px, 310px) minmax(0, 1fr)" className={styles.reportSplit}>
 <WorkspacePane title="报告目录" className={`${styles.reportCatalog} ${detailOpen?styles.mobileHidden:''}`} bodyClassName={styles.catalogBody} aria-label="报告目录">
 <Input aria-label="搜索报告" placeholder="搜索数据集或日期" value={filter} allowClear onChange={e=>setFilter(e.target.value)}/>
 <div className={styles.listMeta}>{loading?'正在读取…':`当前范围 ${shown.length} 份`}</div>
 {!loading&&!shown.length&&<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={error?'读取失败，请重试':filter?'没有匹配报告':'此范围还没有报告'}/>}
 {shown.map(r=><button type="button" key={r.id} className={styles.catalogItem} aria-pressed={selectedId===r.id} onClick={()=>open(r.id,r)}><span className={styles.catalogTop}><strong>{r.kind==='monthly'?'月报':'周报'}</strong><Tag color={r.status==='completed'?'green':r.status==='failed'?'red':'blue'}>{reportStates[r.status]}</Tag></span><span className={styles.period}>{r.snapshot.scope.startDate} 至 {r.snapshot.scope.endDate}</span><span className={styles.catalogSource}>{r.snapshot.dataset.origin==='simulated'?'模拟 · ':'公开 · '}{r.snapshot.dataset.name}</span><small>{dayjs(r.createdAt).format('YYYY-MM-DD HH:mm')}</small></button>)}
 </WorkspacePane>
 <WorkspacePane className={`${styles.reportReading} ${!detailOpen?styles.mobileHidden:''}`} aria-label="报告详情" actions={selectedId?<Button size="small" href={'/dashboard/reports/'+selectedId}>独立打开</Button>:undefined}>
 <Button className={styles.backToCatalog} onClick={closeDetail}>返回报告目录</Button>
 {selectedId?<ReportReader key={selectedId} id={selectedId} embedded/>:<Empty className={styles.readerEmpty} description="从左侧选择一份报告，在这里阅读结论和建议"/>}
 </WorkspacePane>
 </WorkspaceSplit>
 </Workspace>;
}
