'use client';
import {useEffect,useState} from 'react';
import {Alert,Empty,Flex,Select,Tag} from 'antd';
import {useAuthStore} from '@/modules/identity/client';
import {datasetAnalysisType,type DatasetVO} from '@/modules/education/contracts';
import {selectionFromSearch} from '@/shared/lib/analysis-navigation';
import {learningSelectionFromSearch} from '@/shared/lib/learning-navigation';
import OperationsCanvas from './OperationsCanvas';
import LearningCanvas from './LearningCanvas';
import {FinanceCanvas} from '@/modules/finance/client';
import styles from './OverviewEditorial.module.css';
export default function DashboardCanvas({detailed=false}:{detailed?:boolean}){
 const token=useAuthStore(s=>s.token),[datasets,setDatasets]=useState<DatasetVO[]>([]),[id,setId]=useState(''),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();setError('');fetch('/api/education/datasets',{headers:{Authorization:'Bearer '+token},signal:c.signal}).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.message??'数据集加载失败');setDatasets(b.data);const incoming=learningSelectionFromSearch(window.location.search)??selectionFromSearch(window.location.search),params=new URLSearchParams(window.location.search),incomingId=params.get('datasetId')??incoming?.datasetId,saved=localStorage.getItem('overview-dataset');setId(b.data.some((d:DatasetVO)=>d.id===incomingId)?incomingId:b.data.some((d:DatasetVO)=>d.id===saved)?saved:b.data.find((d:DatasetVO)=>d.origin==='simulated'&&d.schemaVersion==='3')?.id??b.data[0]?.id??'');}).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>c.abort();},[token]);
 const dataset=datasets.find(d=>d.id===id);
 const controls=<Flex gap={10} align="center" wrap className={styles.dataControl}><Select aria-label="运营数据集" value={id||undefined} placeholder="选择已导入数据集" style={{minWidth:0,width:420,maxWidth:'100%'}} options={datasets.map(d=>({value:d.id,label:(d.origin==='public'?'[公开] ':'[模拟] ')+d.name}))} onChange={value=>{setId(value);localStorage.setItem('overview-dataset',value);}}/>{dataset&&datasetAnalysisType(dataset)!=='operations'&&<Tag color="blue">{datasetAnalysisType(dataset)==='finance'?'真实年度财务案例':'匿名公开学习'}</Tag>}</Flex>;
 return <div className={styles.dashboard}>{(!dataset||datasetAnalysisType(dataset)!=='operations')&&<div className="analysis-mode-bar">{controls}</div>}{error&&<Alert type="error" title={error}/>} {dataset&&datasetAnalysisType(dataset)==='finance'?<FinanceCanvas key={id} dataset={dataset}/>:dataset&&datasetAnalysisType(dataset)==='learning'?<LearningCanvas key={id} dataset={dataset}/>:dataset&&datasetAnalysisType(dataset)==='operations'?<OperationsCanvas key={id} detailed={detailed} datasetId={id} datasetControl={controls}/>:!error&&<Empty description="当前还没有导入数据，请到工作台准备数据"/>}</div>;
}
