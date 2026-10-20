import {describe,expect,it,vi} from 'vitest';
import type {OperationalAnalysis,OperationalMetric,LearningAnalysis} from '@/modules/analytics/contracts';
import type {FinanceAnalysis} from '@/modules/finance/contracts';
import type {AgentToolPayload} from '@/modules/agent/contracts';
import type {AuthorizedScope,EvidenceReference} from '@/shared/contracts/analysis';
import {agentVisualizationSchema,MAX_AGENT_VISUALIZATIONS} from '@/modules/agent/contracts/visualization';
import {boundedAgentVisualizations,financeVisualizations,learningVisualizations,metricBreakdownVisualizations,operationalMetricVisualizations,prioritizedAgentVisualizations,visualizationRows} from '@/modules/agent/domain/visualization';
import {createAgentToolRegistry} from '@/modules/agent/services/tools';

const scope:AuthorizedScope={organizationId:'org',authorizedCampusIds:[],startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[],dataCutoff:'2026-09-01T00:00:00.000Z'};
const evidence:EvidenceReference={id:'metric-source',kind:'metric',sourceId:'dataset',version:'snapshot-v1',summary:'固定测试批次',scope,updatedAt:scope.dataCutoff!};
const metric=(code='attendance_rate',value:number|null=80,unit:OperationalMetric['unit']='percent'):OperationalMetric=>({code,value,unit,numerator:value,denominator:100,scope,evidence:[evidence],status:value===null?'insufficient_data':'ready',reason:'测试',unknownCount:0,details:{}});
const analysis=(metrics=[metric()]):OperationalAnalysis=>({dataset:{id:'dataset',name:'模拟数据',origin:'simulated'},scope,metrics,trend:[{period:'2026-06',value:0,present:0,due:10,unknown:0},{period:'2026-07',value:null,present:0,due:0,unknown:3},{period:'2026-08',value:80,present:8,due:10,unknown:0}],breakdown:[],riskStudents:[],batches:[]});
const versioned={...evidence,id:evidence.id+'@'+evidence.version};

describe('Agent程序图表数据',()=>{
 it('保留真实零值与未知断点，不将缺失值修补为零',()=>{
  const graph=operationalMetricVisualizations(analysis(),'query')[0];
  expect(graph.kind).toBe('line');expect(graph.series[0].points).toEqual([{value:0,status:'ready'},{value:null,status:'unknown'},{value:80,status:'ready'}]);
  expect(visualizationRows(graph)[1]['出勤率（%）']).toBeNull();expect(visualizationRows(graph)[1]['出勤率状态']).toBe('未知');
 });
 it('本期与对比期按单位分开，不计算模型差值或平均分组百分比',()=>{
  const current=analysis([metric(),metric('complaint_count',0,'count'),metric('refund_amount',250,'currency')]);
  current.comparison={scope:{...scope,startDate:'2026-07-01',endDate:'2026-07-31'},metrics:[metric('attendance_rate',null),metric('complaint_count',2,'count')],changes:[]};
  const graphs=operationalMetricVisualizations(current,'query');
  expect(graphs).toHaveLength(4);
  const counts=graphs.find(graph=>graph.unit==='条')!;expect(counts.series.map(series=>series.points[0].value)).toEqual([0,2]);
  const currency=graphs.find(graph=>graph.unit==='元')!;expect(currency.series[1].points[0]).toEqual({value:null,status:'unknown'});
  expect(counts.note).toContain('2026-07-01 至 2026-07-31');
 });
 it('非出勤指标不借用出勤趋势，来源不含服务端机构授权字段',()=>{
  const graphs=operationalMetricVisualizations(analysis([metric('renewal_rate',60)]),'query');
  expect(graphs.every(graph=>graph.kind==='bar')).toBe(true);expect(graphs[0].source.scope).toEqual({startDate:scope.startDate,endDate:scope.endDate,campusIds:[],courseIds:[],channelIds:[],dataCutoff:scope.dataCutoff});
  expect(JSON.stringify(graphs)).not.toContain('organizationId');
 });
 it('维度条形图保留组内原比率、原证据与完整查询范围',()=>{
  const rows=[{id:'a',name:'甲校区',analysis:{...analysis([metric('attendance_rate',80)]),scope:{...scope,campusIds:['a']}}},{id:'b',name:'乙校区',analysis:analysis([metric('attendance_rate',25)])},{id:'c',name:'未知校区',analysis:analysis([metric('attendance_rate',null)])}];
  const graph=metricBreakdownVisualizations(rows,'campus','breakdown',scope)[0];
  expect(graph.categories).toEqual(['甲校区','乙校区','未知校区']);expect(graph.series[0].points.map(point=>point.value)).toEqual([80,25,null]);expect(graph.source.scope).toMatchObject({campusIds:[]});expect(graph.evidenceIds).toEqual([versioned.id]);
 });
 it('渠道满班项清楚标注贡献口径，有界返回且不隐瞒截断',()=>{
  const rows=Array.from({length:30},(_,i)=>({id:String(i),name:'渠道'+i,analysis:analysis([metric('class_fill_rate',i)])}));
  const graph=metricBreakdownVisualizations(rows,'channel','breakdown',scope,40)[0];
  expect(graph.categories).toHaveLength(30);expect(graph.note).toContain('渠道席位贡献率');expect(graph.note).toContain('查询返回的前30组');
 });
 it('拒绝可执行图表配置、非有限数值、长度不匹配和未关联证据',()=>{
  const valid=operationalMetricVisualizations(analysis(),'query')[0];
  expect(boundedAgentVisualizations([{...valid,option:{tooltip:{formatter:'<script>'}}}])).toEqual([]);
  expect(agentVisualizationSchema.safeParse({...valid,series:[{name:'无效',points:[{value:Infinity,status:'ready'}]}]}).success).toBe(false);
  expect(boundedAgentVisualizations([{...valid,series:[{name:'错误长度',points:[{value:1,status:'ready'}]}]}])).toEqual([]);
  expect(boundedAgentVisualizations([{...valid,source:{...valid.source,analysisType:'finance'}}])).toEqual([]);
  expect(boundedAgentVisualizations([valid],[{id:'other-company-reference'}])).toEqual([]);expect(boundedAgentVisualizations([valid],[versioned])).toHaveLength(1);
 });
 it('旧记录、过量图表和重复ID可安全降级',()=>{
  const valid=operationalMetricVisualizations(analysis(),'query')[0];
  expect(boundedAgentVisualizations(undefined)).toEqual([]);expect(boundedAgentVisualizations([null,{},valid,valid])).toHaveLength(1);
  expect(boundedAgentVisualizations(Array.from({length:20},(_,i)=>({...valid,id:'chart-'+i})))).toHaveLength(MAX_AGENT_VISUALIZATIONS);
 });
 it('先按问题指标选择再限制八图，后续步骤的目标图不会丢失，图形偏好不盖过指标',()=>{
  const base=operationalMetricVisualizations(analysis(),'query')[0],early=Array.from({length:8},(_,index)=>({...base,id:'earlier-'+index})),refundBar={...base,id:'later-refund-bar',kind:'bar' as const,metricCodes:['refund_amount'],unit:'元'},refundLine={...refundBar,id:'later-refund-line',kind:'line' as const},all=[...early,refundBar,refundLine],before=JSON.stringify(all);
  expect(boundedAgentVisualizations(all,[versioned]).some(chart=>chart.metricCodes.includes('refund_amount'))).toBe(false);
  const ranked=prioritizedAgentVisualizations(all,[versioned],['refund_amount'],'line');
  expect(ranked).toHaveLength(8);expect(ranked.slice(0,2).map(chart=>chart.id)).toEqual(['later-refund-line','later-refund-bar']);expect(JSON.stringify(all)).toBe(before);
  expect(prioritizedAgentVisualizations([...early,refundBar],[versioned],['refund_amount'],'line')[0].id).toBe('later-refund-bar');
  expect(prioritizedAgentVisualizations(all,[{id:'unrelated-evidence'}],['refund_amount'],'line')).toEqual([]);
 });
 it('学习图仅呈现课程相对周与已导入学习点击，并标识部分数据',()=>{
  const input={dataset:{id:'public',name:'OULAD',origin:'public'},scope:{organizationId:'org',courseKeys:[],relativeDayStart:-20,relativeDayEnd:30},metrics:[],trend:[{week:-1,records:3,clicks:0,activeStudents:1}],courses:[],scores:[],resources:[],outcomes:[],completeness:[{kind:'oulad_activity',status:'partial'}],evidence:[evidence],batches:[]} as unknown as LearningAnalysis;
  const graph=learningVisualizations(input,'learn')[0];expect(graph.categories).toEqual(['相对周 -1']);expect(graph.series[0].points[0].value).toBe(0);expect(graph.note).toContain('点击不代表签到');expect(graph.note).toContain('部分或缺失导入');expect(graph.source.analysisType).toBe('learning');
 });
 it('财务图保持年度与人民币元，零收入比率留空',()=>{
  const input={dataset:{id:'finance',name:'公开年报',origin:'public'},scope:{organizationId:'org',years:[2025]},annual:[{year:2025,revenue:'0.00',cost:'10.00',selling:'1.00',administrative:'2.00'}],evidence:[evidence]} as unknown as FinanceAnalysis;
  const graphs=financeVisualizations(input,'finance');expect(graphs).toHaveLength(2);expect(graphs[0].categories).toEqual(['2025']);expect(graphs[0].series[2].points[0].value).toBe(-10);expect(graphs[1].series[0].points[0].value).toBeNull();expect(graphs[0].unit).toBe('元');expect(graphs[0].note).toContain('不代表校区、月度或学员经营流水');
 });
 it('真实工具将图数据独立放在payload，模型result和成员明细不增加',async()=>{
  const registry=createAgentToolRegistry({metrics:{query:vi.fn(async()=>analysis())},tags:{list:vi.fn(),get:vi.fn(),create:vi.fn(),preview:vi.fn()},profiles:{list:vi.fn(),query:vi.fn()},knowledge:{search:vi.fn()}});
  const response=await registry.execute('query_metrics',{},scope,{actor:{userId:'user',organizationId:'org',role:'viewer'},datasetId:'dataset',runId:'run',toolCallId:'call',signal:new AbortController().signal});
  const data=response.data as AgentToolPayload;expect(data.visualizations?.length).toBeGreaterThan(0);expect(data.result).not.toHaveProperty('visualizations');expect(JSON.stringify(data.visualizations)).not.toContain('riskStudents');expect(boundedAgentVisualizations(data.visualizations,data.evidence)).toHaveLength(data.visualizations!.length);
 });
});
