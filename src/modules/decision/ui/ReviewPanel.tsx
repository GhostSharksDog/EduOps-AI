'use client';
import {useEffect,useState,useRef} from 'react';
import {Alert,Button,Card,Descriptions,Flex,Input,InputNumber,Table,Tag,Typography} from 'antd';
import type {DecisionTask,ReviewPeriod,ReviewPreview,QuantitativeReview} from '../contracts';
import {defaultReviewPeriod,reviewBaselineScope} from '../domain/review';
import AnalysisRangeSummary from '@/shared/ui/AnalysisRangeSummary';
import {isFinanceScope} from '@/shared/contracts/analysis';
import {reviewMetricLabels} from '../contracts';

const number=(n:number|null,unit='')=>n===null?'未计算':n.toLocaleString('zh-CN',{maximumFractionDigits:2})+(unit?' '+unit:'');
export function FrozenReview({value}:{value:QuantitativeReview}){return <Flex vertical gap={12}>
 <Alert type={value.status==='ready'?'info':'warning'} title={value.goals?'按执行前目标核验':'历史任务 · 仅描述性对比'} description="这是前后数据观察，不能单独证明任务造成了经营变化。"/>
 {isFinanceScope(value.beforeScope)?<Typography.Paragraph>原分析年度：{value.beforeScope.years.join('、')} · 数据集 {value.datasetId}</Typography.Paragraph>:<AnalysisRangeSummary name="原分析数据集" origin={value.recordType==='demonstration'?'simulated':'public'} scope={value.beforeScope}/>}
 {isFinanceScope(value.afterScope)?<Typography.Paragraph>复核年度：{value.afterScope.years.join('、')} · 同一集团年度来源</Typography.Paragraph>:<AnalysisRangeSummary name="复核数据集（同一来源）" origin={value.recordType==='demonstration'?'simulated':'public'} scope={value.afterScope}/>}
 <Table size="small" rowKey="code" pagination={false} scroll={{x:650}} dataSource={value.metrics} columns={[{title:'指标',dataIndex:'label'},{title:'执行前（按当前口径重算）',render:(_,m)=><Flex vertical><span>{number(m.before,m.unit)}</span><Typography.Text type={m.baselineVerification?.status==='changed'?'danger':'secondary'}>{m.baselineVerification?.status==='matched'?'与冻结事实一致':m.baselineVerification?.status==='changed'?'与原事实不同':'原事实未收录此项'}</Typography.Text></Flex>},{title:'复核期',render:(_,m)=>number(m.after,m.unit)},{title:'变化',render:(_,m)=>number(m.change,m.changeUnit)},{title:'执行前目标',render:(_,m)=>m.goal?(m.goal.operator==='at_least'?'≥ ':'≤ ')+number(m.goal.target,m.unit):'未设置'},{title:'达成情况',render:(_,m)=>m.achieved===null?<Tag>尚不能判断</Tag>:<Tag color={m.achieved?'green':'orange'}>{m.achieved?'达到目标':'未达到目标'}</Tag>}]}/>
 <Typography.Paragraph type="secondary">执行前列使用当前计算口径重新核验，并逐项比对原分析保存的事实；原分析没有记录该项时只提供描述性观察。</Typography.Paragraph>
 {value.metrics.some(m=>m.reason)&&<Alert type="warning" title="数据限制" description={value.metrics.filter(m=>m.reason).map(m=><p key={m.code}>{m.label}：{m.reason}</p>)}/>}
 <details><summary>分子分母、截止时间与数据依据</summary>{value.metrics.map(m=><Card size="small" key={m.code} title={m.label} style={{marginTop:8}}>{m.baselineVerification&&<Typography.Paragraph type={m.baselineVerification.status==='changed'?'danger':'secondary'}>{m.baselineVerification.explanation}{m.baselineVerification.status!=='not_recorded'?' 原冻结值：'+number(m.baselineVerification.originalValue,m.unit):''}</Typography.Paragraph>}<Typography.Paragraph>前期：{number(m.beforeNumerator)} / {number(m.beforeDenominator)}；后期：{number(m.afterNumerator)} / {number(m.afterDenominator)}。金额和数量类指标不使用比率分母。</Typography.Paragraph>{m.evidence.map(e=><p key={e.id+'/'+e.version}>{e.summary} · 版本 {e.version.slice(0,60)}</p>)}</Card>)}<Typography.Paragraph type="secondary">计算时间：{new Date(value.calculatedAt).toLocaleString('zh-CN')} · 口径 {value.definitionVersion}</Typography.Paragraph></details>
 </Flex>;}

export default function ReviewPanel({task,request,onPreview}:{task:DecisionTask;request:(path:string,method?:string,body?:unknown)=>Promise<unknown>;onPreview?:(p:ReviewPreview|null)=>void}){
 const sequence=useRef(0);
 const [period,setPeriod]=useState<ReviewPeriod|null>(null),[preview,setPreview]=useState<ReviewPreview|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 useEffect(()=>{++sequence.current;setLoading(false);setPreview(null);onPreview?.(null);setError('');try{setPeriod(task.goals?.reviewPeriod??defaultReviewPeriod(reviewBaselineScope(task.sourceSnapshot)));}catch(e){setPeriod(null);setError((e as Error).message);}},[task.id,task.version,task.goals,task.sourceSnapshot]);
 const change=(p:ReviewPeriod)=>{++sequence.current;setPeriod(p);setPreview(null);onPreview?.(null);};
 const run=async()=>{if(!period||loading)return;const current=++sequence.current;setLoading(true);setError('');try{const p=await request('/api/decisions/'+task.id+'/review/preview','POST',{expectedVersion:task.version,period}) as ReviewPreview;if(current===sequence.current){setPreview(p);onPreview?.(p);}}catch(e){if(current===sequence.current){setPreview(null);onPreview?.(null);setError((e as Error).message);}}finally{if(current===sequence.current)setLoading(false);}};
 return <Card size="small" title="量化复核 · 同来源、同范围比较"><Flex vertical gap={12}>
 {task.goals?<Descriptions size="small" column={1} items={[{key:'set',label:'目标确定时间',children:new Date(task.goals.setAt).toLocaleString('zh-CN')},{key:'goals',label:'执行前目标',children:task.goals.targets.map(g=><Tag key={g.code}>{reviewMetricLabels[g.code]} {g.operator==='at_least'?'≥':'≤'} {g.target}</Tag>)}]}/>:<Typography.Paragraph type="secondary">此任务没有执行前目标，可以查看描述性前后数据，不追溯补写目标。</Typography.Paragraph>}
 {period?.mode==='operations'?<Flex gap={10} wrap><label style={{flex:'1 1 150px'}}>复核开始日期<Input aria-label="复核开始日期" type="date" value={period.startDate} disabled={!!task.goals||loading} onChange={e=>change({...period,startDate:e.target.value})}/></label><label style={{flex:'1 1 150px'}}>复核结束日期<Input aria-label="复核结束日期" type="date" value={period.endDate} disabled={!!task.goals||loading} onChange={e=>change({...period,endDate:e.target.value})}/></label></Flex>:period?.mode==='finance'?<label>复核年度<InputNumber aria-label="复核年度" value={period.year} min={2000} max={2100} disabled={!!task.goals||loading} onChange={year=>year&&change({...period,year})}/></label>:null}
 <Button type="primary" loading={loading} disabled={!period} onClick={()=>void run()}>预览量化复核</Button>
 {error&&<Alert type="error" title={error} action={<Button onClick={()=>void run()}>重试预览</Button>}/>}
 {preview&&<><FrozenReview value={preview}/><Alert type={preview.canConfirm?'success':'warning'} title={preview.canConfirm?'数据已核验，可在“完成复核”时勾选冻结本次对比':'预览未改变任务'} description={preview.status==='ready'?'数据就绪；任务进入待复核后才能页面确认保存。':preview.reasons.join('；')}/></>}
 </Flex></Card>;
}
