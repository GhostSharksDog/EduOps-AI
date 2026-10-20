import {describe,expect,it} from 'vitest';
import type {AgentFactVO,AgentMessageVO,AgentRunVO,AgentStepVO,AgentTurnContext} from '@/modules/agent/contracts';
import type {EvidenceReference} from '@/shared/contracts/analysis';
import {factsOnlyAnswer,groundedConversationHistory,missingAnalysisQueries,requiredAnalysisQueries} from '@/modules/agent/domain/analysis-completeness';

const context:AgentTurnContext={datasetId:'fixture-dataset',scope:{organizationId:'fixture-org',authorizedCampusIds:[],startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[],dataCutoff:'2026-08-31T15:59:59.999Z'}};
const evidence:EvidenceReference={id:'current-evidence',kind:'metric',sourceId:context.datasetId,version:'current-batch',summary:'本轮程序统计',scope:context.scope as never,updatedAt:'2026-08-31T15:59:59.999Z'};
const fact=(id='current:attendance_rate',patch:Partial<AgentFactVO>={}):AgentFactVO=>({id,label:'出勤率',value:75,unit:'%',status:'ready',evidenceIds:[evidence.id],...patch});
const step=(patch:Partial<AgentStepVO>={}):AgentStepVO=>({id:'step',tool:'query_metrics',status:'completed',input:{metricCodes:['attendance_rate']},facts:[fact()],evidence:[evidence],context,...patch});
const run=(patch:Partial<AgentRunVO>={}):AgentRunVO=>({id:'run',sessionId:'session',status:'failed',steps:[step()],proposals:[],evidence:[evidence],answer:{kind:'analysis',summary:'REJECTED_MODEL 89% 已完成全部课程拆解。',facts:[],hypotheses:['REJECTED_CAUSE'],recommendations:['REJECTED_ACTION'],limitations:[]},errorCode:'UNVERIFIED_NUMBER',errorMessage:'原回答数字未通过核验',startedAt:'2026-10-19T02:00:00.000Z',completedAt:'2026-10-19T02:00:10.000Z',context,...patch});
const question='帮我查看当前课程出勤，与同范围上期比较并按课程拆解';
const message=(id:string,role:AgentMessageVO['role'],content:string,runId:string|null='run'):AgentMessageVO=>({id,sessionId:'session',runId,role,content,createdAt:'2026-10-19T02:00:00.000Z'});

describe('明确维度任务必须有本轮完成证据',()=>{
 it('原始问题要求全局出勤查询和课程出勤拆解，均明确attendance_rate',()=>{
  const required=requiredAnalysisQueries(question,context);
  expect(required.map(item=>({tool:item.tool,input:item.input}))).toEqual([{tool:'query_metrics',input:{metricCodes:['attendance_rate']}},{tool:'query_metric_breakdown',input:{dimension:'course',metricCodes:['attendance_rate']}}]);
 });
 it('只查询主指标或模型声称课程已拆解，仍缺真实课程工具步骤',()=>{
  const required=requiredAnalysisQueries(question,context),source=run();
  expect(missingAnalysisQueries(required,source).map(item=>item.input.dimension)).toEqual(['course']);
  expect(source.answer?.summary).toContain('已完成全部课程拆解');
 });
 it('只有本轮completed且正确维度的步骤可以满足课程拆解',()=>{
  const required=requiredAnalysisQueries(question,context),course=step({id:'course-step',tool:'query_metric_breakdown',input:{dimension:'course',metricCodes:['attendance_rate']}});
  expect(missingAnalysisQueries(required,run({steps:[step(),course]}))).toEqual([]);
  for(const candidate of [{...course,status:'failed' as const},{...course,status:'pending' as const},{...course,input:{dimension:'campus',metricCodes:['attendance_rate']}},{...course,input:{dimension:'channel',metricCodes:['attendance_rate']}}])expect(missingAnalysisQueries(required,run({steps:[step(),candidate]}))).toHaveLength(1);
 });
 it('维度相同但查询了错误指标不能算完成，未指定指标保留全指标兼容',()=>{
  const required=requiredAnalysisQueries(question,context),course=step({id:'course-step',tool:'query_metric_breakdown',input:{dimension:'course',metricCodes:['renewal_rate']}});
  expect(missingAnalysisQueries(required,run({steps:[step(),course]})).map(item=>item.input.dimension)).toEqual(['course']);
  expect(missingAnalysisQueries(required,run({steps:[step({input:{metricCodes:['renewal_rate']}}),course]}))).toHaveLength(2);
  expect(missingAnalysisQueries(required,run({steps:[step({input:{}}),{...course,input:{dimension:'course'}}]}))).toEqual([]);
 });
 it('旧范围或其他数据集的成功步骤不能代替当前课程拆解',()=>{
  const required=requiredAnalysisQueries(question,context);
  const oldScope={...context,datasetId:'other-dataset'},earlierCutoff={...context,scope:{...context.scope,dataCutoff:'2026-08-15T15:59:59.999Z'}};
  for(const selectedContext of [oldScope,earlierCutoff]){
   const course=step({tool:'query_metric_breakdown',input:{dimension:'course'},context:selectedContext});
   expect(missingAnalysisQueries(required,run({steps:[step(),course]}))).toHaveLength(1);
  }
 });
 it('调整范围后，旧全局与课程步骤均失效，新查询完成才可继续',()=>{
  const nextContext={...context,scope:{...context.scope,startDate:'2026-09-01',endDate:'2026-09-30',dataCutoff:'2026-09-30T15:59:59.999Z'}},required=requiredAnalysisQueries(question,nextContext),oldCourse=step({tool:'query_metric_breakdown',input:{dimension:'course'}});
  const source=run({context:nextContext,steps:[step(),oldCourse]});
  expect(missingAnalysisQueries(required,source)).toHaveLength(2);
  source.steps.push(step({id:'new-main',context:nextContext}),step({id:'new-course',tool:'query_metric_breakdown',context:nextContext,input:{dimension:'course',metricCodes:['attendance_rate']}}));
  expect(missingAnalysisQueries(required,source)).toEqual([]);
 });
 it('否定的课程要求不触发拆解，明确其他维度只要求对应维度',()=>{
  expect(requiredAnalysisQueries('查看出勤，不要按课程拆解。',context)).toEqual([]);
  const required=requiredAnalysisQueries('按校区比较出勤，不用按课程拆解。',context);
  expect(required.filter(item=>item.tool==='query_metric_breakdown').map(item=>item.input.dimension)).toEqual(['campus']);
 });
 it('普通未指定维度的问题和学习财务模式不套用经营拆解要求',()=>{
  expect(requiredAnalysisQueries('看看当前出勤情况',context)).toEqual([]);
  expect(requiredAnalysisQueries(question,{datasetId:'learning',scope:{organizationId:'fixture-org',courseKeys:['AAA:2013J'],relativeDayStart:-10,relativeDayEnd:30}})).toEqual([]);
  expect(requiredAnalysisQueries(question,{datasetId:'finance',scope:{organizationId:'fixture-org',years:[2024,2025]}})).toEqual([]);
 });
});

describe('历史意图和历史事实隔离',()=>{
 it('用户追问和澄清候选保留，旧助手摘要中的89%不再进入模型上下文',()=>{
  const source=run({status:'completed',answer:{kind:'clarification',summary:'旧范围89%为已完成结论。',facts:[fact('historic',{value:89})],hypotheses:[],recommendations:['按旧范围89%处理。'],limitations:[],questions:[{id:'course',prompt:'接着查看哪个课程？',options:[{label:'课程甲',value:'继续查看课程甲'}]}]}});
  const history=[message('user','user','帮我比较当前课程出勤。'),message('assistant','assistant','旧范围89%为已完成结论。'),message('followup','user','先看课程甲。')],result=groundedConversationHistory(history,[source]);
  expect(result[0]).toEqual({role:'user',content:'帮我比较当前课程出勤。'});expect(result[2]).toEqual({role:'user',content:'先看课程甲。'});
  expect(JSON.stringify(result)).not.toContain('89%');expect(JSON.stringify(result)).not.toContain('旧范围89');
  const assistant=JSON.parse(result[1].content);expect(assistant.type).toBe('historical_response');expect(assistant.questions).toEqual(source.answer!.questions);expect(assistant.instruction).toContain('重新调用工具');
 });
 it('关联运行不存在时也不回退注入原始旧摘要',()=>{
  const result=groundedConversationHistory([message('old','assistant','OLD_UNVERIFIED_89%','missing-run')],[]);
  expect(result[0].role).toBe('assistant');expect(result[0].content).not.toContain('89');expect(result[0].content).not.toContain('OLD_UNVERIFIED');expect(JSON.parse(result[0].content).questions).toEqual([]);
 });
});

describe('拒绝模型正文后仅保留可核验事实',()=>{
 it('只保留completed同冻结范围并有有效引用的程序事实，明确partial且不复用模型内容',()=>{
  const current=fact(),oldContext={...context,scope:{...context.scope,startDate:'2026-07-01',endDate:'2026-07-31'}},source=run({steps:[step(),step({id:'failed',status:'failed',facts:[fact('failed',{value:89})]}),step({id:'old',context:oldContext,facts:[fact('old',{value:89})]}),step({id:'no-ref',facts:[fact('no-ref',{evidenceIds:[]})]}),step({id:'bad-ref',facts:[fact('bad-ref',{evidenceIds:['not-returned']})]})]});
  const partial=factsOnlyAnswer(source,'UNVERIFIED_NUMBER');
  expect(partial?.facts).toEqual([current]);expect(partial?.partial).toEqual({kind:'facts_only',reasonCode:'UNVERIFIED_NUMBER'});
  expect(partial?.hypotheses).toEqual([]);expect(partial?.recommendations).toEqual([]);
  expect(JSON.stringify(partial)).not.toMatch(/REJECTED_MODEL|REJECTED_CAUSE|REJECTED_ACTION|89%|已完成全部课程拆解/);
 });
 it('无完成证据、无匹配范围或无事实引用时不能制造partial结果',()=>{
  const other={...context,datasetId:'other-dataset'};
  for(const source of [run({steps:[]}),run({steps:[step({status:'failed'})]}),run({steps:[step({context:other})]}),run({steps:[step({facts:[fact('none',{evidenceIds:[]})]})]}),run({context:undefined})])expect(factsOnlyAnswer(source,'UNVERIFIED_NUMBER')).toBeNull();
 });
 it('权限、机构或批次错误不降级为看似可用的部分回答',()=>{
  for(const code of ['FORBIDDEN','FORBIDDEN_TOOL','OUTSIDE_SCOPE','INVALID_CONTEXT','BATCH_CHANGED','SESSION_READ_ONLY'])expect(factsOnlyAnswer(run(),code)).toBeNull();
 });
 it('提供待补工具元数据，但不把原失败状态改成完成或覆盖原记录',()=>{
  const source=run(),before=JSON.stringify(source),partial=factsOnlyAnswer(source,'INCOMPLETE_ANALYSIS',['query_metric_breakdown:course']);
  expect(partial?.partial).toEqual({kind:'facts_only',reasonCode:'INCOMPLETE_ANALYSIS',missingTools:['query_metric_breakdown:course']});
  expect(partial?.limitations.join('')).toContain('尚缺');expect(JSON.stringify(source)).toBe(before);expect(source.status).toBe('failed');expect(source.answer?.summary).toContain('89%');
 });
 it('未知值仍作为未知事实保存，不填零，也不把它改成可执行建议',()=>{
  const unknown=fact('unknown',{value:null,status:'insufficient_data'}),partial=factsOnlyAnswer(run({steps:[step({facts:[unknown]})]}),'MODEL_TIMEOUT');
  expect(partial?.facts).toEqual([unknown]);expect(partial?.facts[0].value).toBeNull();expect(partial?.recommendations).toEqual([]);expect(partial?.partial?.reasonCode).toBe('MODEL_TIMEOUT');
 });
});
