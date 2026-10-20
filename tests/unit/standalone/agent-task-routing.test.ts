import {describe,it,expect} from 'vitest';
import type {AgentActor,ToolDefinition} from '@/modules/agent/contracts';
import type {TaskState} from '@/modules/agent/contracts/task-state';
import {routeTask,taskToolGroups,baseTaskToolNames,selectTaskToolsSchema,selectTaskToolsDefinition,maximumTaskToolSwitches} from '@/modules/agent/domain/task-routing';
import {ToolRegistry,allowedTaskTools,assertAllowedTaskTool} from '@/modules/agent/services/registry';

const actor:AgentActor={organizationId:'fixture-org',userId:'fixture-user',role:'operator'};
const state:TaskState={revision:1,goal:'创建课程出勤标签',userConditions:['最低应出勤四次'],selectedObjects:[{kind:'tag',id:'fixture-tag',version:2,name:'课程出勤关注'}],pendingQuestions:[],datasetId:'fixture-dataset',scopeKey:'fixture-scope',needsReview:false,updatedAt:'2026-10-18T10:00:00.000Z'};
const names=(tools:ToolDefinition[])=>tools.map(tool=>tool.name).sort();
function registry(){
 const result=new ToolRegistry();
 const writes=new Set(['propose_tag','edit_tag_draft','preview_tag_rule','prepare_action_plan','prepare_decision_task','prepare_report','save_knowledge_draft']);
 for(const name of new Set([...baseTaskToolNames,...Object.values(taskToolGroups).flat()]))result.register({name,description:name,mode:writes.has(name)?'propose':'read',status:'ready'});
 result.register({name:'execute_arbitrary_sql',description:'not exposed',mode:'read',status:'ready'});
 result.register({name:'confirm_plan',description:'not exposed',mode:'propose',status:'ready'});
 return result;
}
describe('任务工具轻量路由与权限交集',()=>{
 it('普通交流和操作指导不会自动扩大到经营或写入工具',()=>{
  expect(routeTask('你好')).toMatchObject({intent:'guidance',groups:['guidance']});
  expect(routeTask('怎么创建运营标签和人群？')).toMatchObject({intent:'guidance',groups:['guidance']});
  expect(names(allowedTaskTools(registry(),actor,['guidance'],'operations'))).toEqual([...baseTaskToolNames].sort());
 });
 it('分析、业务准备与知识整理依据用户原文选择，不先调用额外模型',()=>{
  expect(routeTask('帮我查看八月出勤为什么下降')).toMatchObject({intent:'analysis',groups:['analysis']});
  expect(routeTask('查询本月已有决策任务')).toMatchObject({intent:'workflow',groups:['workflow']});
  expect(routeTask('整理业务知识并保存为知识草稿')).toMatchObject({intent:'knowledge',groups:['knowledge']});
 });
 it('复合任务合并工具组，并保留明确的分析与操作准备能力',()=>{
  expect(routeTask('帮我筛选低出勤学员并创建标签，然后保存人群安排跟进')).toMatchObject({intent:'compound',groups:['analysis','tag','workflow']});
  const allowed=names(allowedTaskTools(registry(),actor,['analysis','tag','workflow'],'operations'));
  expect(allowed).toContain('query_metrics');expect(allowed).toContain('propose_tag');expect(allowed).toContain('prepare_action_plan');
  expect(allowed).not.toContain('confirm_plan');expect(allowed).not.toContain('execute_arbitrary_sql');
 });
 it('未知任务只允许指导与内部选组，不猜测正式操作',()=>{
  expect(routeTask('处理一下')).toMatchObject({intent:'clarification',groups:['guidance']});
  expect(selectTaskToolsDefinition).toMatchObject({name:'select_task_tools',mode:'read',status:'ready'});
  expect(maximumTaskToolSwitches).toBe(2);
 });
 it('追问继承已确认目标，范围变化则要求重新确认',()=>{
  expect(routeTask('把阈值改低一点',state).groups).toEqual(['analysis','tag']);
  expect(routeTask('继续',{...state,goal:null,selectedObjects:[{kind:'report',id:'report',name:'月报'}]}).groups).toEqual(['workflow']);
  expect(routeTask('继续',{...state,needsReview:true})).toMatchObject({intent:'clarification',groups:['guidance']});
 });
 it('用户明确不要创建标签时，不因被否定的词开启标签准备',()=>{
  expect(routeTask('别创建标签，只查询出勤指标')).toMatchObject({intent:'analysis',groups:['analysis']});
 });
 it('公开学习不开放经营标签，年度财务只开放年度指标及任务准备',()=>{
  expect(routeTask('创建运营标签',undefined,'learning')).toMatchObject({intent:'clarification',groups:['guidance']});
  expect(routeTask('查年度成本和收入',undefined,'finance')).toMatchObject({intent:'analysis',groups:['analysis']});
  expect(routeTask('检索字段字典',undefined,'learning')).toMatchObject({intent:'knowledge',groups:['knowledge']});
  const learning=names(allowedTaskTools(registry(),actor,['analysis','tag','workflow','knowledge'],'learning'));
  expect(learning).toEqual([...baseTaskToolNames,'query_learning_metrics'].sort());
  const finance=names(allowedTaskTools(registry(),actor,['analysis','tag','workflow','knowledge'],'finance'));
  expect(finance).toContain('query_financial_metrics');expect(finance).toContain('prepare_decision_task');expect(finance).not.toContain('query_metrics');expect(finance).not.toContain('prepare_report');expect(finance).not.toContain('query_profile');expect(finance).not.toContain('save_knowledge_draft');
 });
 it('只读角色与任务选择取交集，未识别角色没有工具',()=>{
  const available=allowedTaskTools(registry(),{...actor,role:'viewer'},['tag','workflow','knowledge'],'operations');
  expect(available.every(tool=>tool.mode==='read')).toBe(true);expect(names(available)).toContain('query_tags');expect(names(available)).not.toContain('propose_tag');
  expect(allowedTaskTools(registry(),{...actor,role:'unknown'},['analysis'],'operations')).toEqual([]);
 });
 it('没有就绪和伪装为写入的基础工具不向模型开放',()=>{
  const available=new ToolRegistry();
  available.register({name:'query_metrics',description:'missing',mode:'read',status:'unconfigured'});
  available.register({name:'query_scope_options',description:'wrong mode',mode:'propose',status:'ready'});
  expect(allowedTaskTools(available,actor,['analysis'],'operations')).toEqual([]);
 });
 it('调用名必须在当前选择清单内，不能凭已登记名称越过选择',()=>{
  const selected=allowedTaskTools(registry(),actor,['analysis'],'operations');
  expect(()=>assertAllowedTaskTool('query_metrics',selected)).not.toThrow();
  expect(()=>assertAllowedTaskTool('propose_tag',selected)).toThrow('本轮任务');
  expect(()=>assertAllowedTaskTool('confirm_plan',selected)).toThrow('本轮任务');
 });
 it('内部选组严格校验枚举、重复组与多余身份字段',()=>{
  expect(selectTaskToolsSchema.safeParse({groups:['analysis','workflow'],reason:'用户同时请求分析和安排跟进'}).success).toBe(true);
  for(const input of [{groups:[]},{groups:['sql']},{groups:['tag','tag']},{groups:['tag'],organizationId:'other'},{groups:['tag'],reason:''}])expect(selectTaskToolsSchema.safeParse(input).success).toBe(false);
 });
});
