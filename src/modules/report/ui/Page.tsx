'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Alert,App,Button,Card,Collapse,Flex,Select,Table,Tag,Typography} from 'antd';
import {FileTextOutlined} from '@ant-design/icons';
import dayjs from 'dayjs';
import {useRouter} from 'next/navigation';
import {useAuthStore} from '@/modules/identity/client';
import {ScopePicker} from '@/modules/analytics/client';
import type {SelectedScope} from '@/modules/analytics/client';
import type {ReportVO} from '../contracts';
import {ReviewGuide,rememberReviewRecord} from '@/modules/overview/client';
import {analysisHref,sameAnalysisRange} from '@/shared/lib/analysis-navigation';
export const reportStates={generating:'正在生成',completed:'生成完成',failed:'生成失败'};
export default function ReportPage(){
 const {message}=App.useApp(),router=useRouter(),token=useAuthStore(s=>s.token),role=useAuthStore(s=>s.user?.role),canWrite=role==='admin'||role==='operator';
 const [selectedInput,setSelectedInput]=useState<SelectedScope|null>(null),[kind,setKind]=useState<'weekly'|'monthly'>('monthly'),[items,setItems]=useState<ReportVO[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const selection=useMemo(()=>{if(!selectedInput)return null;const date=dayjs(selectedInput.scope.startDate),monday=date.subtract((date.day()+6)%7,'day');return {...selectedInput,scope:{...selectedInput.scope,startDate:(kind==='monthly'?date.startOf('month'):monday).format('YYYY-MM-DD'),endDate:(kind==='monthly'?date.endOf('month'):monday.add(6,'day')).format('YYYY-MM-DD')}};},[selectedInput,kind]);
 const load=useCallback(async()=>{setLoading(true);try{const r=await fetch('/api/reports',{headers:{Authorization:'Bearer '+token}}),b=await r.json();if(!r.ok)throw new Error(b.message);setItems(b.data);setError('');}catch(e){setError(e instanceof Error?e.message:'报告服务不可用');}finally{setLoading(false);}},[token]);useEffect(()=>{void load();},[load]);
 const shown=selection?items.filter(r=>r.datasetId===selection.datasetId&&sameAnalysisRange(r.snapshot.scope,selection.scope)):[],known=!!selection&&!loading&&!error;
 const select=useCallback((s:SelectedScope)=>setSelectedInput(s),[]);
 const generate=async()=>{if(!selection||busy)return;setBusy(true);setError('');const requestKey=crypto.randomUUID();try{const r=await fetch('/api/reports',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({datasetId:selection.datasetId,kind,anchorDate:selection.scope.startDate,campusIds:selection.scope.campusIds,courseIds:selection.scope.courseIds,channelIds:selection.scope.channelIds,...(selection.scope.dataCutoff?{dataCutoff:selection.scope.dataCutoff}:{}),requestKey})}),b=await r.json();if(!r.ok)throw new Error(b.message);rememberReviewRecord('reportId',b.data.id);if(b.data.status==='failed')message.error(b.data.errorMessage??'报告生成失败，数据依据已保留');else if(b.data.status==='completed')message.success('报告已生成');router.push(analysisHref('/dashboard/reports/'+b.data.id,selection));}catch(e){await load();setError((e instanceof Error?e.message:'生成请求失败')+'；可以刷新列表核对已保存的任务。');}finally{setBusy(false);}};
 return <Flex vertical gap={16}><div className="page-heading"><Typography.Title level={2}><FileTextOutlined/> 运营报告</Typography.Title><Button loading={loading} onClick={load}>刷新列表</Button></div><ScopePicker onChange={select} monthly/><ReviewGuide selection={selection}/>
 <Card title="生成新报告"><Flex gap={12} wrap align="center"><Select aria-label="报告类型" value={kind} disabled={busy} onChange={setKind} options={[{value:'monthly',label:'月报'},{value:'weekly',label:'周报'}]}/><Typography.Text type="secondary">{selection?selection.scope.startDate+' 至 '+selection.scope.endDate:'请先选择分析范围'}</Typography.Text><Button type="primary" disabled={!selection||!canWrite||busy} loading={busy} onClick={generate}>生成智能报告</Button>{busy&&<Typography.Text type="secondary">正在分析，通常需要片刻，完成后自动打开报告。</Typography.Text>}</Flex><Collapse ghost style={{marginTop:8}} items={[{key:'rules',label:'报告周期与生成说明',children:<Typography.Paragraph type="secondary" style={{margin:0}}>周报为周一至周日，月报为自然月。数据先冻结，原因需核查；生成最多等待两分钟，失败时保留数据依据。已有报告不会随新导入改写。</Typography.Paragraph>}]} /></Card>
 {error&&<Alert type="error" title={error} action={<Button onClick={load}>重新加载</Button>}/>}
 <Card title={<Flex gap={8} wrap align="center"><span>当前范围的报告</span>{known&&<Tag>{shown.length} 份</Tag>}</Flex>}><Table loading={loading} rowKey="id" dataSource={shown} scroll={{x:650}} locale={{emptyText:known?'还没有报告，选择周报或月报后生成':'等待范围或服务结果'}} columns={[{title:'报告',render:(_,r:ReportVO)=><Button type="link" href={analysisHref('/dashboard/reports/'+r.id,{datasetId:r.datasetId,scope:r.snapshot.scope})}>{r.kind==='monthly'?'月报':'周报'} · {r.snapshot.scope.startDate} 至 {r.snapshot.scope.endDate}</Button>},{title:'状态',render:(_,r:ReportVO)=><Tag color={r.status==='completed'?'green':r.status==='failed'?'red':'blue'}>{reportStates[r.status]}</Tag>},{title:'数据来源',render:(_,r:ReportVO)=><Tag color={r.snapshot.dataset.origin==='simulated'?'orange':'blue'}>{r.snapshot.dataset.origin==='simulated'?'模拟':'公开'} · {r.snapshot.dataset.name}</Tag>},{title:'创建时间',render:(_,r:ReportVO)=>dayjs(r.createdAt).format('YYYY-MM-DD HH:mm')}]} /></Card>
 </Flex>;
}
