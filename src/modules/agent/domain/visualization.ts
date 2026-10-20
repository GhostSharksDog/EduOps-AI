import type {OperationalAnalysis,OperationalMetric,LearningAnalysis} from '@/modules/analytics/contracts';
import {metricLabels} from '@/modules/analytics/contracts';
import type {FinanceAnalysis,FinanceCode} from '@/modules/finance/contracts';
import {annualValues,financeLabels} from '@/modules/finance/contracts';
import type {AuthorizedScope,EvidenceReference} from '@/shared/contracts/analysis';
import {agentVisualizationSchema,MAX_AGENT_VISUALIZATIONS} from '../contracts/visualization';
import type {AgentVisualization} from '../contracts/visualization';

type Point=AgentVisualization['series'][number]['points'][number];
type Source=AgentVisualization['source'];
const ref=(e:EvidenceReference)=>e.id+'@'+e.version;
const refs=(values:readonly EvidenceReference[])=>[...new Set(values.map(ref))];
const unit=(metric:Pick<OperationalMetric,'unit'>)=>metric.unit==='currency'?'元':metric.unit==='count'?'条':metric.unit==='hours'?'课时':'%';
const name=(metric:Pick<OperationalMetric,'code'|'displayName'>)=>metric.displayName??metricLabels[metric.code]??metric.code;
const point=(value:number|null,status='ready'):Point=>value!==null&&Number.isFinite(value)&&status==='ready'?{value,status:'ready'}:{value:null,status:status==='not_applicable'?'not_applicable':status==='insufficient_data'?'insufficient_data':'unknown'};
const unique=<T>(values:T[])=>[...new Set(values)];
const byValue=(a:{value:number|null},b:{value:number|null})=>a.value===null?b.value===null?0:1:b.value===null?-1:b.value-a.value;

/** Historical JSON is optional: malformed or unreferenced charts are omitted, never repaired with invented numbers. */
export function boundedAgentVisualizations(value:unknown,evidence?:readonly Pick<EvidenceReference,'id'>[]):AgentVisualization[]{
 if(!Array.isArray(value))return [];
 const known=evidence?new Set(evidence.map(item=>item.id)):undefined,result:AgentVisualization[]=[],ids=new Set<string>();
 for(const item of value){
  const parsed=agentVisualizationSchema.safeParse(item);
  if(!parsed.success||ids.has(parsed.data.id)||known&&parsed.data.evidenceIds.some(id=>!known.has(id)))continue;
  ids.add(parsed.data.id);result.push(parsed.data);if(result.length===MAX_AGENT_VISUALIZATIONS)break;
 }
 return result;
}

/** Rank across completed steps before applying the display bound, so later requested metrics are not lost. */
export function prioritizedAgentVisualizations(value:unknown,evidence?:readonly Pick<EvidenceReference,'id'>[],preferredMetricCodes:readonly string[]=[],preferredKind?:AgentVisualization['kind']):AgentVisualization[]{
 if(!Array.isArray(value))return [];
 const rank=(visual:AgentVisualization)=>{const index=preferredMetricCodes.findIndex(code=>visual.metricCodes.includes(code));return index<0?preferredMetricCodes.length:index;};
 const ordered=value.map((item,index)=>({parsed:agentVisualizationSchema.safeParse(item),index})).filter((item):item is {parsed:{success:true;data:AgentVisualization};index:number}=>item.parsed.success).sort((a,b)=>rank(a.parsed.data)-rank(b.parsed.data)||(preferredKind?Number(b.parsed.data.kind===preferredKind)-Number(a.parsed.data.kind===preferredKind):0)||a.index-b.index);
 return boundedAgentVisualizations(ordered.map(item=>item.parsed.data),evidence);
}

function operationsSource(result:OperationalAnalysis):Source{
 const {organizationId:_,authorizedCampusIds:__,observationCutoff:___,...scope}=result.scope;
 return {datasetId:result.dataset.id,datasetName:result.dataset.name,origin:result.dataset.origin,analysisType:'operations',scope};
}

export function operationalMetricVisualizations(result:OperationalAnalysis,toolCallId:string):AgentVisualization[]{
 if(!result.dataset?.id||!result.dataset.name||!result.scope)return [];
 const source=operationsSource(result),graphs:AgentVisualization[]=[];
 // The existing service exposes attendance trend only. Do not invent trends for the other metrics.
 if(result.metrics.some(metric=>metric.code==='attendance_rate')&&result.trend.length){
  const trend=result.trend.slice(-30),evidence=result.metrics.filter(metric=>metric.code==='attendance_rate').flatMap(metric=>metric.evidence);
  graphs.push({id:toolCallId+':attendance-trend',title:'出勤率趋势',kind:'line',metricCodes:['attendance_rate'],unit:'%',categories:trend.map(row=>row.period),categoryLabel:'统计月份',series:[{name:'出勤率',points:trend.map(row=>point(row.value))}],evidenceIds:refs(evidence),source,note:'按已完成批次与本轮范围计算；缺失值保留断点，不以零补齐。'});
 }
 for(const displayUnit of unique(result.metrics.map(unit))){
  const metrics=result.metrics.filter(metric=>unit(metric)===displayUnit),baseline=result.comparison?.metrics;
  if(!metrics.length)continue;
  const evidence=[...metrics.flatMap(metric=>metric.evidence),...(baseline?.filter(metric=>metrics.some(current=>current.code===metric.code)).flatMap(metric=>metric.evidence)??[])];
  const series:AgentVisualization['series']=[{name:'本期',points:metrics.map(metric=>point(metric.value,metric.status))}];
  if(baseline)series.push({name:'对比期',points:metrics.map(metric=>{const previous=baseline.find(item=>item.code===metric.code);return previous?point(previous.value,previous.status):point(null);})});
  graphs.push({id:toolCallId+':metric-'+encodeURIComponent(displayUnit),title:baseline?'本期与对比期':'本期指标',kind:'bar',metricCodes:metrics.map(metric=>metric.code),unit:displayUnit,categories:metrics.map(name),categoryLabel:'经营指标',series,evidenceIds:refs(evidence),source,note:result.comparison?'本期 '+result.scope.startDate+' 至 '+result.scope.endDate+'；对比期 '+result.comparison.scope.startDate+' 至 '+result.comparison.scope.endDate+'。各项比率按各自分子分母计算。':'按本轮统计范围查询；没有可用对比期时只绘制本期。'});
 }
 return boundedAgentVisualizations(graphs);
}

export function metricBreakdownVisualizations(rows:{id:string;name:string;analysis:OperationalAnalysis}[],dimension:'campus'|'course'|'channel',toolCallId:string,scope?:AuthorizedScope,totalGroups=rows.length):AgentVisualization[]{
 if(!rows.length||!rows[0].analysis.dataset?.id||!rows[0].analysis.dataset.name)return [];
 const label={campus:'校区',course:'课程',channel:'渠道'}[dimension],source=operationsSource({...rows[0].analysis,...(scope?{scope}:{})}),codes=unique(rows.flatMap(row=>row.analysis.metrics.map(metric=>metric.code))).slice(0,8),graphs:AgentVisualization[]=[];
 for(const code of codes){
  const groups=rows.map(row=>({name:row.name,metric:row.analysis.metrics.find(metric=>metric.code===code)})).map(row=>({...row,value:row.metric?.status==='ready'?row.metric.value:null})).sort(byValue).slice(0,30);
  const exemplar=groups.find(group=>group.metric)?.metric;if(!exemplar)continue;
  graphs.push({id:toolCallId+':'+dimension+':'+code,title:label+'对比 · '+name(exemplar),kind:'bar',metricCodes:[code],unit:unit(exemplar),categories:groups.map(group=>group.name),categoryLabel:label,series:[{name:name(exemplar),points:groups.map(group=>group.metric?point(group.metric.value,group.metric.status):point(null))}],evidenceIds:refs(groups.flatMap(group=>group.metric?.evidence??[])),source,note:'各组单独计算，不平均百分比；跨组人数可能重叠。'+(totalGroups>30?'仅展示查询返回的前30组，组内按数值排序；未知值置后。':'未知值保留为空。')+(dimension==='channel'&&code==='class_fill_rate'?'此项为渠道席位贡献率，分母为所选班级总班额。':'')});
 }
 return boundedAgentVisualizations(graphs);
}

export function learningVisualizations(result:LearningAnalysis,toolCallId:string):AgentVisualization[]{
 if(!result.dataset?.id||!result.dataset.name||!result.scope)return [];
 const source:Source={datasetId:result.dataset.id,datasetName:result.dataset.name,origin:result.dataset.origin,analysisType:'learning',scope:{courseKeys:result.scope.courseKeys,...(result.scope.relativeDayStart!==undefined?{relativeDayStart:result.scope.relativeDayStart}:{}),...(result.scope.relativeDayEnd!==undefined?{relativeDayEnd:result.scope.relativeDayEnd}:{})}},evidenceIds=refs(result.evidence),graphs:AgentVisualization[]=[];
 const trend=result.trend.slice(-30),complete=['oulad_course','oulad_activity'].every(kind=>result.completeness.some(item=>item.kind===kind&&item.status==='complete'));
 if(trend.length)graphs.push({id:toolCallId+':learning-activity',title:'相对周学习点击',kind:'line',metricCodes:['click_count'],unit:'次',categories:trend.map(row=>'相对周 '+row.week),categoryLabel:'课程相对周',series:[{name:'学习点击',points:trend.map(row=>point(row.clicks))}],evidenceIds,source,note:'学习点击不代表签到。'+(!complete?'当前存在部分或缺失导入，请结合完整性提示阅读。':'')+(result.trend.length>30?'仅展示最近30个相对周。':'')});
 const courses=result.courses.map(row=>({name:row.name,value:row.clicks})).sort(byValue).slice(0,30);
 if(courses.length)graphs.push({id:toolCallId+':learning-courses',title:'课程批次学习点击',kind:'bar',metricCodes:['click_count'],unit:'次',categories:courses.map(row=>row.name),categoryLabel:'课程批次',series:[{name:'学习点击',points:courses.map(row=>point(row.value))}],evidenceIds,source,note:'不同课程批次相对日对齐，不伪造实际开课日期。'});
 if(result.scores.length)graphs.push({id:toolCallId+':learning-scores',title:'测评分数分布',kind:'bar',metricCodes:['average_score'],unit:'条',categories:result.scores.slice(0,30).map(row=>row.label),categoryLabel:'分数区间',series:[{name:'测评记录',points:result.scores.slice(0,30).map(row=>point(row.count))}],evidenceIds,source,note:'为已知评分的记录分布；缺失评分和免修情况见完整数据依据。'});
 return boundedAgentVisualizations(graphs);
}

export function financeVisualizations(result:FinanceAnalysis,toolCallId:string):AgentVisualization[]{
 if(!result.dataset?.id||!result.dataset.name||!result.scope)return [];
 const source:Source={datasetId:result.dataset.id,datasetName:result.dataset.name,origin:result.dataset.origin,analysisType:'finance',scope:{years:result.scope.years}},annual=[...result.annual].sort((a,b)=>a.year-b.year).slice(-30),evidenceIds=refs(result.evidence),graphs:AgentVisualization[]=[];
 if(!annual.length)return [];
 for(const group of [{id:'amount',title:'年度收入、成本与毛利',unit:'元',codes:['revenue','cost','grossProfit']},{id:'margin',title:'年度毛利率与费用率',unit:'%',codes:['grossMargin','sellingRatio','administrativeRatio']}] as const){
  graphs.push({id:toolCallId+':finance-'+group.id,title:group.title,kind:'bar',metricCodes:[...group.codes],unit:group.unit,categories:annual.map(row=>String(row.year)),categoryLabel:'披露年度',series:group.codes.map((code:FinanceCode)=>({name:financeLabels[code],points:annual.map(row=>point(annualValues(row)[code]))})),evidenceIds,source,note:'集团公开年度披露；金额单位为人民币元，不代表校区、月度或学员经营流水。'});
 }
 return boundedAgentVisualizations(graphs);
}

export function visualizationRows(visual:AgentVisualization):Record<string,string|number|null>[] {
 return visual.categories.map((category,index)=>Object.fromEntries([[visual.categoryLabel,category],...visual.series.flatMap(series=>[[series.name+'（'+visual.unit+'）',series.points[index]?.value??null],[series.name+'状态',series.points[index]?.status==='ready'?'已计算':series.points[index]?.status==='not_applicable'?'不适用':series.points[index]?.status==='insufficient_data'?'数据不足':'未知']])]) as Record<string,string|number|null>);
}
