import {describe,expect,it,vi} from 'vitest';
import type {AuthorizedScope,EvidenceReference} from '@/shared/contracts/analysis';
import {metricCodes} from '@/modules/analytics/contracts';
import type {OperationalAnalysis,OperationalMetric} from '@/modules/analytics/contracts';
import type {AgentToolPayload,ToolExecutionContext} from '@/modules/agent/contracts';
import {createAgentToolRegistry,type AgentBusinessPorts} from '@/modules/agent/services/tools';
import {agentVisualizationSchema} from '@/modules/agent/contracts/visualization';

const scope:AuthorizedScope={organizationId:'fixture-org',authorizedCampusIds:['campus-a'],startDate:'2026-08-01',endDate:'2026-08-31',campusIds:['campus-a'],courseIds:[],channelIds:[],dataCutoff:'2026-08-31T15:59:59.999Z'};
const context:ToolExecutionContext={actor:{userId:'fixture-user',organizationId:scope.organizationId,role:'viewer'},runId:'fixture-run',toolCallId:'fixture-call',datasetId:'fixture-dataset',signal:new AbortController().signal};
const evidence:EvidenceReference={id:'fixture-evidence',kind:'metric',sourceId:context.datasetId,version:'frozen-version',summary:'本轮已完成数据批次',scope,updatedAt:scope.dataCutoff!};
function metric(code:typeof metricCodes[number],index=0,patch:Partial<OperationalMetric>={}):OperationalMetric{
 return {code,unit:code==='complaint_count'?'count':code==='refund_amount'?'currency':'percent',value:code==='refund_amount'?1890:code==='complaint_count'?3:75,numerator:15+index,denominator:20+index,status:'ready',unknownCount:0,reason:'原始质量解释中的计数987654不应直接进入模型',details:{unregisteredDetail:987654},scope,evidence:[evidence],...patch};
}
function analysis(patch:Partial<OperationalAnalysis>={}):OperationalAnalysis{
 const metrics=metricCodes.map((code,index)=>metric(code,index));
 return {dataset:{id:context.datasetId,name:'隔离模拟数据',origin:'simulated'},scope,metrics,trend:[{period:'2026-08',value:75,present:7101,due:8102,unknown:9103}],breakdown:[{campusId:'campus-a',courseId:'course-a',name:'不得从主指标工具混入的课程数字',value:89,present:1112,due:1314,unknown:1516}],riskStudents:[{studentId:'PRIVATE_STUDENT',displayName:'PRIVATE_NAME',absent:1,leave:0,unknown:0}],batches:[{id:'batch',kind:'attendance',rows:100,hash:'file-fingerprint'}],comparison:{scope:{...scope,startDate:'2026-07-01',endDate:'2026-07-31'},metrics:metrics.map(item=>({...item,value:item.code==='attendance_rate'?82:item.value,numerator:9317,denominator:10496})),changes:metrics.map(item=>({code:item.code,change:item.code==='attendance_rate'?-7:0,unit:item.unit==='percent'?'个百分点':item.unit==='currency'?'元':'条',reason:'历史统计解释555不应无绑定地进入模型'}))},...patch};
}
function harness(source=analysis(),groups?:{id:string;name:string;analysis:OperationalAnalysis}[]){
 const rows=groups??[{id:'course-a',name:'课程甲',analysis:source},{id:'course-b',name:'课程乙',analysis:analysis({metrics:source.metrics.map(item=>({...item,value:item.code==='attendance_rate'?null:item.value,status:item.code==='attendance_rate'?'insufficient_data':item.status}))})}];
 const query=vi.fn<AgentBusinessPorts['metrics']['query']>(async()=>source),breakdown=vi.fn(async(_id:string,_scope:AuthorizedScope,_dimension:'campus'|'course'|'channel')=>rows);
 const registry=createAgentToolRegistry({metrics:{query,breakdown},tags:{list:vi.fn(),get:vi.fn(),create:vi.fn(),preview:vi.fn()},profiles:{list:vi.fn(),query:vi.fn()},knowledge:{search:vi.fn()}});
 const execute=async(name:string,input:unknown)=>{const response=await registry.execute(name,input,scope,context);expect(response.status).toBe('ready');return response.data as AgentToolPayload;};
 return {source,rows,query,breakdown,registry,execute};
}
function numberPaths(value:unknown,path=''):string[]{
 if(typeof value==='number')return [path];if(!value||typeof value!=='object')return [];
 return Object.entries(value).flatMap(([key,item])=>numberPaths(item,path?path+'.'+key:key));
}
function referenceIds(value:unknown):string[]{
 if(!value||typeof value!=='object')return [];
 return Object.entries(value).flatMap(([key,item])=>key==='factId'||key.endsWith('FactId')?typeof item==='string'?[item]:[]:referenceIds(item));
}

describe('经营工具模型数据投影',()=>{
 it('主指标工具不返回未绑定的课程拆解、质量细节或历史与趋势计数',async()=>{
  const h=harness(),payload=await h.execute('query_metrics',{metricCodes:['attendance_rate']}),result=payload.result as Record<string,unknown>;
  expect(result).not.toHaveProperty('breakdown');
  const {dataset:_dataset,scope:_scope,batches:_batches,facts:_facts,...businessProjection}=result;
  expect(numberPaths(businessProjection)).toEqual([]);
  const serialized=JSON.stringify(result);
  for(const raw of ['987654','9317','10496','7101','8102','9103','1112','1314','1516','不得从主指标工具混入的课程数字'])expect(serialized).not.toContain(raw);
  expect(result.next).toContain('query_metric_breakdown');
 });
 it('所有结果引用都有真实fact，值来自业务服务，元数据及分子分母引用保持可核查',async()=>{
  const h=harness(),payload=await h.execute('query_metrics',{metricCodes:['attendance_rate']}),result=payload.result as {dataset:unknown;scope:unknown;batches:unknown;facts:unknown;metrics:{factId:string;numeratorFactId:string;denominatorFactId:string}[];comparison:{periodFactId:string;metrics:{factId:string}[];changes:{factId:string}[]};trend:{factId:string}[]};
  const byId=new Map(payload.facts.map(fact=>[fact.id,fact]));
  expect(referenceIds(result).every(id=>byId.has(id))).toBe(true);
  expect(byId.get(result.metrics[0].factId)?.value).toBe(75);expect(byId.get(result.metrics[0].numeratorFactId)?.value).toBe(15);expect(byId.get(result.metrics[0].denominatorFactId)?.value).toBe(20);
  expect(byId.get(result.comparison.metrics[0].factId)?.value).toBe(82);expect(byId.get(result.comparison.changes[0].factId)?.value).toBe(-7);
  expect(byId.get(result.comparison.metrics[0].factId)).toMatchObject({numerator:9317,denominator:10496});
  expect(byId.get(result.comparison.periodFactId)?.displayValue).toBe('2026-07-01 至 2026-07-31');
  expect(byId.get(result.trend[0].factId)?.value).toBe(75);
  expect(byId.get(result.trend[0].factId)).toMatchObject({numerator:7101,denominator:8102});
  expect(result.dataset).toEqual(h.source.dataset);expect(result.scope).toEqual(scope);expect(result.batches).toEqual(h.source.batches);
  expect(result.facts).toEqual(payload.facts.map(({numerator:_,denominator:__,...fact})=>fact));
  expect((result.facts as object[]).every(fact=>!('numerator'in fact)&&!('denominator'in fact))).toBe(true);
  expect(payload.facts.find(fact=>fact.id===result.metrics[0].factId)).toMatchObject({numerator:15,denominator:20});
 });
 it('主指标投影不暴露成员明细，且不改动原业务快照及程序图表',async()=>{
  const source=analysis(),before=JSON.stringify(source),h=harness(source),payload=await h.execute('query_metrics',{metricCodes:['attendance_rate']});
  expect(JSON.stringify(payload.result)).not.toMatch(/PRIVATE_STUDENT|PRIVATE_NAME|studentId|riskStudents/);
  expect(JSON.stringify(source)).toBe(before);
  const trend=payload.visualizations?.find(chart=>chart.kind==='line'),comparison=payload.visualizations?.find(chart=>chart.kind==='bar');
  expect(trend?.series[0].points[0].value).toBe(75);expect(comparison?.series.map(series=>series.points[0].value)).toEqual([75,82]);
  expect(payload.visualizations?.every(chart=>agentVisualizationSchema.safeParse(chart).success)).toBe(true);
  expect((payload.result as Record<string,unknown>).visualizations).toBeUndefined();
 });
 it('请求非出勤指标时不偷偷附带出勤趋势事实或图表',async()=>{
  const h=harness(),payload=await h.execute('query_metrics',{metricCodes:['refund_amount']});
  expect(payload.facts.every(fact=>!fact.id.includes('attendance_rate')&&!fact.id.includes(':period:'))).toBe(true);
  expect((payload.result as {trend:unknown[]}).trend).toEqual([]);
  expect(payload.visualizations?.every(chart=>chart.metricCodes.every(code=>code==='refund_amount')&&chart.unit==='元')).toBe(true);
  expect(h.query).toHaveBeenCalledWith(context.datasetId,scope,['refund_amount']);
 });
 it('专用课程拆解按metricCodes筛选groups、facts和图表，没有未映射的样本计数',async()=>{
  const h=harness(),payload=await h.execute('query_metric_breakdown',{dimension:'course',metricCodes:['attendance_rate']}),result=payload.result as {dimension:string;groups:{id:string;name:string;metrics:{code:string;factId:string}[]}[];facts:unknown};
  expect(result.dimension).toBe('course');expect(result.groups).toHaveLength(2);expect(result.groups.every(group=>group.metrics.length===1&&group.metrics[0].code==='attendance_rate')).toBe(true);
  expect(payload.facts).toHaveLength(2);expect(payload.facts.every(fact=>fact.id.endsWith(':attendance_rate'))).toBe(true);
  expect((result.facts as object[]).every(fact=>!('numerator'in fact)&&!('denominator'in fact)&&!('unknown'in fact))).toBe(true);
  expect(payload.facts.find(fact=>fact.id===context.toolCallId+':course-a:attendance_rate')).toMatchObject({numerator:15,denominator:20});
  const {facts:_facts,...projection}=result;expect(numberPaths(projection)).toEqual([]);
  expect(referenceIds(result).every(id=>payload.facts.some(fact=>fact.id===id))).toBe(true);
  expect(payload.visualizations).toHaveLength(1);expect(payload.visualizations?.[0].metricCodes).toEqual(['attendance_rate']);expect(payload.visualizations?.[0].source.scope).toEqual({startDate:scope.startDate,endDate:scope.endDate,campusIds:scope.campusIds,courseIds:scope.courseIds,channelIds:scope.channelIds,dataCutoff:scope.dataCutoff});
 });
 it('未指定指标时保持八项拆解兼容，各种单位及未知值仍来自程序',async()=>{
  const h=harness(),payload=await h.execute('query_metric_breakdown',{dimension:'course'}),result=payload.result as {groups:{metrics:{code:string}[]}[]};
  expect(result.groups[0].metrics.map(metric=>metric.code)).toEqual([...metricCodes]);expect(payload.facts).toHaveLength(16);
  const unknown=payload.facts.find(fact=>fact.id===context.toolCallId+':course-b:attendance_rate');expect(unknown).toMatchObject({value:null,status:'insufficient_data'});
  const attendance=payload.visualizations?.find(chart=>chart.metricCodes.includes('attendance_rate'));expect(attendance?.series[0].points.some(point=>point.value===null&&point.status==='insufficient_data')).toBe(true);
  expect(payload.visualizations?.find(chart=>chart.metricCodes.includes('complaint_count'))?.unit).toBe('条');expect(payload.visualizations?.find(chart=>chart.metricCodes.includes('refund_amount'))?.unit).toBe('元');
 });
 it('课程筛选只减少返回指标，不改变服务端机构、校区课程或调用权限',async()=>{
  const h=harness();await h.execute('query_metric_breakdown',{dimension:'channel',metricCodes:['refund_amount','complaint_count']});
  expect(h.breakdown).toHaveBeenCalledWith(context.datasetId,scope,'channel');
  for(const input of [{dimension:'course',metricCodes:[]},{dimension:'course',metricCodes:['arbitrary_sql']},{dimension:'course',metricCodes:['attendance_rate'],organizationId:'other'},{dimension:'course',metricCodes:['attendance_rate'],sql:'SELECT *'}])await expect(h.registry.execute('query_metric_breakdown',input,scope,context)).rejects.toThrow();
  expect(h.breakdown).toHaveBeenCalledTimes(1);
  await expect(h.registry.execute('query_metric_breakdown',{dimension:'course'},scope,{...context,actor:{...context.actor,organizationId:'other'}})).rejects.toMatchObject({code:'INVALID_CONTEXT'});expect(h.breakdown).toHaveBeenCalledTimes(1);
 });
 it('拆解结果最多保留三十组，图表和证据均只引用真实保留组',async()=>{
  const source=analysis(),groups=Array.from({length:35},(_,index)=>({id:'course-'+index,name:'课程-'+index,analysis:source})),h=harness(source,groups),payload=await h.execute('query_metric_breakdown',{dimension:'course',metricCodes:['attendance_rate']});
  expect((payload.result as {groups:unknown[];truncated:boolean}).groups).toHaveLength(30);expect((payload.result as {truncated:boolean}).truncated).toBe(true);expect(payload.facts).toHaveLength(30);
  expect(payload.visualizations?.[0].categories).toHaveLength(30);expect(JSON.stringify(payload.result)).not.toContain('course-34');
  expect(payload.visualizations?.every(chart=>chart.evidenceIds.every(id=>payload.evidence.some(evidence=>evidence.id===id)))).toBe(true);
 });
});
