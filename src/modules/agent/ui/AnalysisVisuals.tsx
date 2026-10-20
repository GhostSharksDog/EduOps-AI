'use client';
import {useEffect,useMemo,useState} from 'react';
import {Button,Select,Tag,Typography} from 'antd';
import type {EChartsCoreOption} from 'echarts/core';
import BusinessChart from '@/shared/ui/BusinessChart';
import type {EvidenceReference} from '@/shared/contracts/analysis';
import type {AgentVisualization} from '../contracts/visualization';
import {prioritizedAgentVisualizations,visualizationRows} from '../domain/visualization';
import styles from './AnalysisVisuals.module.css';

const scopeText=(source:AgentVisualization['source'])=>{
 const scope=source.scope;
 if('years' in scope)return scope.years.length?scope.years.join('、')+'年度':'全部已导入年度';
 if('courseKeys' in scope)return (scope.courseKeys.length?'所选课程批次':'全部课程批次')+' · 相对日 '+(scope.relativeDayStart??'起点')+' 至 '+(scope.relativeDayEnd??'终点');
 return scope.startDate+' 至 '+scope.endDate+' · '+(scope.campusIds.length?'所选校区':'全部校区')+' · '+(scope.courseIds.length?'所选课程':'全部课程')+(scope.channelIds.length?' · 所选渠道':'')+(scope.dataCutoff?' · 截止 '+scope.dataCutoff:'');
};
const horizontalChart=(visual:AgentVisualization)=>visual.kind==='bar'&&(visual.categories.length>4||['校区','课程','渠道','课程批次'].includes(visual.categoryLabel));

/** Only this renderer constructs chart options. Stored payloads contain data and source references. */
export function agentVisualizationOption(visual:AgentVisualization):EChartsCoreOption{
 const horizontal=horizontalChart(visual),multiple=visual.series.length>1;
 const categories={type:'category' as const,data:visual.categories,axisLabel:{interval:0,hideOverlap:false,formatter:(value:string)=>value.length>12?value.slice(0,12)+'…':value}},numbers={type:'value' as const,name:visual.unit,scale:false};
 return {animationDuration:180,grid:{left:horizontal?16:12,right:20,top:multiple?45:26,bottom:12,containLabel:true},legend:multiple?{type:'scroll',top:0}:undefined,xAxis:horizontal?numbers:categories,yAxis:horizontal?{...categories,inverse:true}:numbers,series:visual.series.map(series=>({type:visual.kind,name:series.name,data:series.points.map(point=>point.value),connectNulls:false,...(visual.kind==='line'?{showSymbol:true,symbolSize:5}:{barMaxWidth:28}),emphasis:{focus:'series'}}))};
}

export interface AnalysisVisualsProps {
 visualizations:readonly AgentVisualization[];
 evidence?:readonly Pick<EvidenceReference,'id'>[];
 preferredMetricCodes?:readonly string[];
 preferredKind?:AgentVisualization['kind'];
 onEvidence?:(ids:string[])=>void;
}
export default function AnalysisVisuals({visualizations,evidence,preferredMetricCodes=[],preferredKind,onEvidence}:AnalysisVisualsProps){
 const charts=useMemo(()=>prioritizedAgentVisualizations(visualizations,evidence,preferredMetricCodes,preferredKind),[visualizations,evidence,preferredMetricCodes,preferredKind]),[selectedId,setSelectedId]=useState('');
 const current=charts.find(chart=>chart.id===selectedId)??charts[0];
 useEffect(()=>{if(selectedId&&!charts.some(chart=>chart.id===selectedId))setSelectedId('');},[charts,selectedId]);
 const option=useMemo(()=>current?agentVisualizationOption(current):{},[current]);
 const rows=useMemo(()=>current?visualizationRows(current):[],[current]);
 if(!current)return null;
 const horizontal=horizontalChart(current),hasValue=current.series.some(series=>series.points.some(point=>point.value!==null));
 return <section className={styles.root} data-testid="agent-analysis-visuals" aria-label="分析图表">
  <div className={styles.toolbar}><span className={styles.heading}>{current.title}</span>{charts.length>1&&<Select className={styles.selector} aria-label="切换分析图表" value={current.id} onChange={setSelectedId} options={charts.map(chart=>({value:chart.id,label:chart.title+(chart.metricCodes.length>1?' · '+chart.unit:'')}))} popupMatchSelectWidth={false}/>}</div>
  <div className={styles.source}><Tag color={current.source.origin==='simulated'?'orange':'blue'}>{current.source.origin==='simulated'?'模拟经营':current.source.analysisType==='finance'?'公开年度财务':'匿名公开学习'}</Tag><Typography.Text type="secondary" style={{fontSize:12}}>{current.source.datasetName}</Typography.Text></div>
  <BusinessChart title={current.title} option={option} rows={rows} height={horizontal?Math.max(240,Math.min(520,current.categories.length*27+58)):260} empty={!hasValue}/>
  {current.note&&<Typography.Paragraph className={styles.note} type="secondary">{current.note}</Typography.Paragraph>}
  <div className={styles.footer}><details className={styles.details}><summary>统计范围与来源</summary><p style={{margin:'6px 0'}}>{scopeText(current.source)}</p></details>{onEvidence&&<Button size="small" type="link" onClick={()=>onEvidence(current.evidenceIds)}>查看数据依据</Button>}</div>
 </section>;
}
