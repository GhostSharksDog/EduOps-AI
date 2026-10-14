'use client';
import {useEffect,useMemo,useState,Suspense} from 'react';
import {useSearchParams} from 'next/navigation';
import {Alert,Button,Card,Collapse,Empty,Flex,Statistic,Table,Tag,Typography} from 'antd';
import {TeamOutlined} from '@ant-design/icons';
import {useBusinessApi} from '@/shared/ui/use-business-api';
import {ReviewGuide} from '@/modules/overview/client';
import {ruleDescription} from '@/modules/tag/contracts';
import {analysisHref,selectionFromSearch,sameAnalysisRange} from '@/shared/lib/analysis-navigation';
import AnalysisRangeSummary from '@/shared/ui/AnalysisRangeSummary';
import type {RiskSegmentSnapshotVO} from '../contracts';

function SavedSegments(){
 const api=useBusinessApi(),search=useSearchParams(),[rows,setRows]=useState<RiskSegmentSnapshotVO[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[reload,setReload]=useState(0);
 useEffect(()=>{let alive=true;setLoading(true);setError('');api<RiskSegmentSnapshotVO[]>('/api/segments/risk-snapshots?summary=true').then(r=>{if(alive)setRows(r);}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[api,reload]);
 const selection=useMemo(()=>selectionFromSearch(search.toString()),[search]),shown=selection?rows.filter(r=>r.datasetId===selection.datasetId&&sameAnalysisRange(r.preview.scope,selection.scope)):rows,first=shown[0];
 return <Flex vertical gap={16}><div className="page-heading"><Typography.Title level={2}><TeamOutlined/> 已保存人群</Typography.Title><Button type="primary" href={selection?analysisHref('/dashboard/tags/risk',selection):'/dashboard/tags/risk'}>创建人群</Button></div><ReviewGuide selection={selection}/>{selection&&<AnalysisRangeSummary name={first?.preview.dataset.name??'当前分析范围'} origin={first?.preview.dataset.origin} scope={selection.scope} catalog={first?.preview.catalog??[]}/>}
 {error&&<Alert type="error" title={error} showIcon action={<Button onClick={()=>setReload(n=>n+1)}>重新加载</Button>}/>}
 <Flex gap={12} wrap><Card size="small" style={{flex:'1 1 200px'}}><Statistic title={selection?'当前范围的人群':'已保存人群'} value={loading||error?'—':shown.length}/></Card><Card size="small" style={{flex:'1 1 200px'}}><Statistic title="成员记录（不同名单可能重复）" value={loading||error?'—':shown.reduce((n,s)=>n+s.memberCount,0)}/></Card></Flex>
 <Card title={selection?'当前范围的名单':'人群名单'}><Table loading={loading} rowKey="id" dataSource={shown} scroll={{x:800}} locale={{emptyText:<Empty description={error?'人群查询失败':'还没有保存人群，请先选择规则并预览名单'}/>}} pagination={{pageSize:10}} columns={[{title:'人群',dataIndex:'name',render:(name,s)=><Flex vertical gap={4}><Typography.Text strong>{name}</Typography.Text><Typography.Paragraph type="secondary" ellipsis={{rows:2,expandable:true,symbol:'展开'}} style={{margin:0,maxWidth:340}}>{s.preview.rule?ruleDescription(s.preview.rule):'历史出勤规则'}</Typography.Paragraph></Flex>},{title:'人数',dataIndex:'memberCount',width:90,render:n=><Typography.Text strong>{n} 人</Typography.Text>},{title:'来源',render:(_,s)=><Flex vertical gap={4}><Tag color={s.preview.dataset.origin==='simulated'?'orange':'blue'}>{s.preview.dataset.origin==='simulated'?'模拟经营':'公开数据'}</Tag><Typography.Text type="secondary">{s.preview.dataset.name}</Typography.Text></Flex>},{title:'保存范围',render:(_,s)=><Flex vertical gap={4}><Typography.Text>{s.preview.scope.startDate} 至 {s.preview.scope.endDate}</Typography.Text><Typography.Text type="secondary">标签 v{s.tagVersion}</Typography.Text></Flex>},{title:'操作',width:120,render:(_,s)=><Button href={analysisHref('/dashboard/data/portrait',{datasetId:s.datasetId,scope:s.preview.scope},{snapshotId:s.id})}>查看画像</Button>}]} /><Collapse ghost items={[{key:'saved',label:'已保存人群是什么？',children:<Typography.Paragraph style={{marginBottom:0}}>人工发布标签后，保存当时的成员名单和分析范围。后续导入数据不会自动改变这份名单；再次分析时可建立新的名单。上方成员记录按名单累加，不代表跨名单去重学员数。</Typography.Paragraph>}]} /></Card>
 </Flex>;
}
export default function RiskSegmentsPage(){return <Suspense fallback={<div>加载已保存人群…</div>}><SavedSegments/></Suspense>;}
