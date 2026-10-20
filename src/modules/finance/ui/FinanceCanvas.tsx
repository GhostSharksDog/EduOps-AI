'use client';

import {useEffect, useMemo, useState} from 'react';
import {Alert, Button, Card, Collapse, Drawer, Flex, Select, Spin, Table, Tag, Typography} from 'antd';
import {useAuthStore} from '@/modules/identity/client';
import type {DatasetVO} from '@/modules/education/contracts';
import {financeScopeSchema, type FinanceScope} from '@/shared/contracts/analysis';
import type {FinanceAnalysis} from '../contracts';
import {annualValues} from '../domain/annual';
import BusinessChart from '@/shared/ui/BusinessChart';

function initialScope(datasetId:string):FinanceScope {
 if(typeof window === 'undefined') return {years:[]};
 const params = new URLSearchParams(window.location.search);
 if(params.get('datasetId') && params.get('datasetId') !== datasetId) return {years:[]};
 try {
  const raw = params.get('financeScope');
  const parsed = financeScopeSchema.safeParse(raw ? JSON.parse(raw) : {years:JSON.parse(params.get('financeYears') ?? '[]')});
  return parsed.success ? parsed.data : {years:[]};
 } catch {return {years:[]};}
}
function financeHref(path:string,datasetId:string,scope:FinanceScope) {
 return path+'?'+new URLSearchParams({datasetId,financeScope:JSON.stringify({years:[...scope.years]})});
}

export default function FinanceCanvas({dataset}:{dataset:DatasetVO}) {
 const token = useAuthStore(s => s.token);
 const [applied, setApplied] = useState<FinanceScope>(() => initialScope(dataset.id)), [draft, setDraft] = useState<FinanceScope>(applied), [scopeOpen, setScopeOpen] = useState(false);
 const [data, setData] = useState<FinanceAnalysis|null>(null), [availableYears, setAvailableYears] = useState<number[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(false), [revision, setRevision] = useState(0);
 useEffect(() => {
  const controller = new AbortController(); setLoading(true); setError(''); setData(null);
  fetch('/api/overview/query', {method:'POST', headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}, body:JSON.stringify({datasetId:dataset.id,financeScope:applied}), signal:controller.signal}).then(async response => {
   const body = await response.json(); if(!response.ok) throw Error(body.message ?? '财务案例加载失败');
   if(!controller.signal.aborted) {setData(body.data); setAvailableYears(body.data.years);}
  }).catch(failure => {if(failure.name !== 'AbortError') setError(failure.message);}).finally(() => {if(!controller.signal.aborted) setLoading(false);});
  return () => controller.abort();
 }, [token,dataset.id,applied,revision]);
 useEffect(() => {
  const next = financeHref(window.location.pathname,dataset.id,applied);
  if(window.location.pathname+window.location.search !== next) {window.history.replaceState(null,'',next); window.dispatchEvent(new Event('education-scope-change'));}
 }, [dataset.id,applied]);
 const annual = useMemo(() => data?.annual.map(record => ({...record,values:annualValues(record)})) ?? [], [data]);
 const valid = financeScopeSchema.safeParse(draft), sourceComplete = data && data.completeness.imported === data.completeness.expected;
 const chart = {tooltip:{trigger:'axis'},legend:{top:0,bottom:'auto',data:['营业收入','营业成本','毛利']},grid:{left:55,right:20,bottom:35,top:42},xAxis:{type:'category',data:annual.map(record => String(record.year))},yAxis:{type:'value',name:'亿元'},series:['revenue','cost','grossProfit'].map((code,index) => ({name:['营业收入','营业成本','毛利'][index],type:'bar',data:annual.map(record => Number(record.values[code as keyof typeof record.values])/1e8)}))};

 return <Spin spinning={loading}><Flex vertical gap={16}>
  <div className="business-page-header"><Typography.Title level={2}>年度财务分析</Typography.Title><Flex gap={8} wrap><Button href="/dashboard/help#finance">帮助</Button><Button type="primary" href={financeHref('/dashboard/agent',dataset.id,applied)}>智能分析</Button></Flex></div>
  <Card size="small"><Flex gap={8} wrap align="center" justify="space-between">
   <Flex gap={8} wrap align="center" style={{minWidth:0,flex:1}}><Tag color="blue">公开真实 · 集团年度</Tag><Typography.Text>{applied.years.length?applied.years.join('、')+'年':'全部已导入年度'}</Typography.Text>{data&&<Tag color={sourceComplete?'green':'orange'}>{sourceComplete?'完整导入':'部分导入'} · {data.completeness.imported}/{data.completeness.expected}条</Tag>}</Flex>
   <Button onClick={() => {setDraft({years:[...applied.years]});setScopeOpen(true);}}>修改范围</Button>
  </Flex></Card>
  <Drawer title="修改财务分析范围" open={scopeOpen} onClose={() => setScopeOpen(false)} size={440} footer={<Flex justify="end" gap={8}><Button onClick={() => setScopeOpen(false)}>取消</Button><Button type="primary" disabled={!valid.success||loading} onClick={() => {if(valid.success){setApplied(valid.data);setScopeOpen(false);setRevision(n => n+1);}}}>应用范围</Button></Flex>}>
   <Typography.Paragraph>选择年度，留空查看全部已导入年度。</Typography.Paragraph><Select aria-label="财务年度" mode="multiple" placeholder="全部已导入年度" style={{width:'100%'}} value={draft.years} options={availableYears.map(year => ({label:String(year),value:year}))} onChange={years => setDraft({years})}/>
   {!valid.success&&<Alert type="warning" title="请选择有效年度" style={{marginTop:12}}/>}
  </Drawer>
  {error&&<Alert type="error" title={error} action={<Button onClick={() => setRevision(n => n+1)}>重试</Button>}/>}
  {data&&<>
   {!sourceComplete&&<Alert type="warning" title="年度数据尚未完整导入" description={`仅统计已完成的${data.completeness.imported}条，预期${data.completeness.expected}条。`}/>}
   <div className="metric-grid">{data.metrics.map(metric => <Card key={metric.code} className="metric-card"><Typography.Text type="secondary">{metric.label} · {data.annual.at(-1)?.year??'无年度'}</Typography.Text><div style={{fontSize:36,fontWeight:750,color:'var(--edu-primary)',fontVariantNumeric:'tabular-nums'}}>{metric.value===null?'—':(metric.unit==='元'?metric.value/1e8:metric.value).toLocaleString('zh-CN',{maximumFractionDigits:2})}<small style={{fontSize:14}}> {metric.unit==='元'?'亿元':'%'}</small></div><Typography.Text type="secondary">{metric.change===null?'缺少上一年度对比':`同比 ${metric.change>=0?'+':''}${metric.change.toFixed(2)}${metric.changeUnit}`}</Typography.Text></Card>)}</div>
   <Card title="收入、成本与毛利年度比较"><BusinessChart title="集团年度收入成本毛利" option={chart} rows={annual.map(record => ({年度:record.year,营业收入:record.revenue,营业成本:record.cost,毛利:record.values.grossProfit}))} empty={!annual.length}/></Card>
   <Flex justify="end"><Button href={financeHref('/dashboard/decisions',dataset.id,applied)}>查看建议与任务</Button></Flex>
   <Collapse items={[
    {key:'sources',label:'原始金额与来源依据',children:<Table rowKey="year" size="small" scroll={{x:1000}} pagination={false} dataSource={data.annual} columns={[{title:'年度',dataIndex:'year'},{title:'营业收入（元）',dataIndex:'revenue'},{title:'营业成本（元）',dataIndex:'cost'},{title:'销售费用（元）',dataIndex:'selling'},{title:'管理费用（元）',dataIndex:'administrative'},{title:'披露来源',render:(_,record) => <><a href={record.sourceUrl} target="_blank" rel="noreferrer">{record.sourceVersion} 第{record.sourcePage}页</a><br/>{record.disclosedAt}{record.historicalSources.length>0&&<details><summary>历史披露</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(record.historicalSources,null,2)}</pre></details>}</>}]} />},
    {key:'limits',label:'财务数据如何解释',children:<ul>{data.limitations.map(value => <li key={value}>{value}</li>)}</ul>},
   ]}/>
  </>}
 </Flex></Spin>;
}
