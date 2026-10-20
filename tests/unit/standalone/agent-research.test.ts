import {afterEach,describe,it,expect,vi} from 'vitest';
import type {StoredAgentRun,AgentRunVO,AgentActor} from '@/modules/agent/contracts';
import {agentTaskComparisonSchema} from '@/modules/agent/contracts/research';
import {compareAgentTasks,describeAgentTask,identifyAgentVersion} from '@/modules/agent/domain/research';
import {publicAgentResponse} from '@/modules/agent/services/public-response';
import {canAccess} from '@/modules/identity/contracts/local';
import {runWithCompany,clearTestCompanyContext} from '@/platform/company/context';
const db=vi.hoisted(()=>({queryRows:vi.fn(),queryOne:vi.fn(),execute:vi.fn(),transaction:vi.fn()}));
vi.mock('@/platform/database',()=>db);
import {agentResearchService,assertAgentResearchActor} from '@/modules/agent/services/research';
const org='11111111-1111-4111-8111-111111111111',dataset='33333333-3333-4333-8333-333333333333',user='44444444-4444-4444-8444-444444444444';
const actor:AgentActor={userId:user,organizationId:org,role:'viewer'};
function sample(engine:'business-agent-v1'|'business-agent-v2'|'business-agent-v3'='business-agent-v2'):StoredAgentRun {
 const context={datasetId:dataset,scope:{organizationId:org,authorizedCampusIds:[],startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[],dataCutoff:'2026-08-31T15:59:59.999Z'}},evidence={id:'data-evidence',kind:'metric' as const,sourceId:dataset,version:'batch-v1',summary:'冻结批次',updatedAt:'2026-08-31T15:59:59.999Z'},fact={id:'attendance',label:'出勤率',value:80,unit:'%',status:'ready',evidenceIds:['data-evidence']};
 const run:AgentRunVO={id:engine==='business-agent-v1'?'55555555-5555-4555-8555-555555555555':'66666666-6666-4666-8666-666666666666',sessionId:'77777777-7777-4777-8777-777777777777',status:'completed',steps:[{id:'context',tool:'resolve_context',status:'completed',evidence:[],context,runtime:{engineVersion:engine,model:'recorded-model',promptVersion:'recorded-prompt',recordedAt:'2026-10-14T00:00:00.000Z',input:{version:'agent-input-v1',tools:[],rounds:[{round:0,messages:[{role:'user',content:'分析出勤'}],usesTools:true,json:false}]} }},{id:'q',tool:'query_metrics',status:'completed',evidence:[evidence],facts:[fact],context}],proposals:[],evidence:[evidence],answer:{kind:'analysis',summary:'事实',facts:[fact],hypotheses:[],recommendations:['核查签到'],limitations:[]},errorCode:null,errorMessage:null,startedAt:'2026-10-14T00:00:00.000Z',completedAt:'2026-10-14T00:01:00.000Z',context};
 return {run,message:'分析出勤',deadlineAt:'2026-10-14T00:02:00.000Z',session:{id:run.sessionId,title:'测试',datasetId:dataset,scope:context.scope,createdBy:user,editable:true,createdAt:run.startedAt,updatedAt:run.startedAt}};
}
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();clearTestCompanyContext();});
describe('真实Agent任务比较口径',()=>{
 it('第三版显式识别与逐轮工具清单兼容，历史版本不被推断为第三版',()=>{
  const saved=sample('business-agent-v3'),runtime=saved.run.steps[0].runtime!;
  expect(identifyAgentVersion(saved.run).engine).toBe('v3');
  expect(describeAgentTask(saved,1).inputsRecorded).toBe(false);
  runtime.input!.rounds[0].toolNames=['query_metrics'];
  expect(describeAgentTask(saved,1)).toMatchObject({engine:'v3',inputsRecorded:true,executionKind:'task'});
  runtime.input!.rounds.push({round:1,messages:[{role:'tool',content:'selected'}],usesTools:true,json:false,toolNames:['prepare_action_plan']});
  expect(describeAgentTask(saved,1).modelCalls).toBe(2);
  delete saved.run.steps[0].runtime;expect(identifyAgentVersion(saved.run).engine).toBe('v2');
 });
 it('内部切组不冒充业务调用，第三版模型重发必须保留同一工具清单',()=>{
  const saved=sample('business-agent-v3'),rounds=saved.run.steps[0].runtime!.input!.rounds;
  rounds[0].toolNames=['query_metrics'];rounds.push({round:1,retryOfRound:0,messages:[],usesTools:true,json:false,toolNames:['query_metrics']});
  saved.run.steps.push({id:'select',tool:'select_task_tools',status:'completed',evidence:[]});
  expect(describeAgentTask(saved,1)).toMatchObject({inputsRecorded:true,modelCalls:2,toolSelectionCalls:1,tools:{attempted:1}});
  rounds[1].toolNames=['propose_tag'];expect(describeAgentTask(saved,1).inputsRecorded).toBe(false);
 });
 it('仅恢复解读保留冻结事实但零业务调用，不计入完整任务成功或严格效率对照',()=>{
  const saved=sample('business-agent-v3'),runtime=saved.run.steps[0].runtime!;
  runtime.recoveryOf={runId:'original-run',kind:'interpretation',fingerprint:'frozen-fingerprint'};
  runtime.input!.rounds[0]={round:0,messages:[{role:'user',content:'恢复这份冻结结果的解释'}],usesTools:false,json:true,toolNames:[]};
  saved.run.steps[1].tool='restore_frozen_facts';
  const described=describeAgentTask(saved,1);
  expect(described).toMatchObject({executionKind:'interpretation_recovery',inputsRecorded:true,tools:{attempted:0,completed:0},facts:{consistent:true},actions:{formallyCompleted:null}});
  expect(described.limitations.join('')).toContain('不能计作完整业务任务完成');
  const compared=compareAgentTasks(describeAgentTask(sample(),1),described);
  expect(compared.strict).toBe(false);expect(compared.limitations.join('')).toContain('不是完整业务任务');
 });
 it('相同模型请求的恢复引用计入实际调用，缺少或伪造引用不能冒充完整输入',()=>{
  const saved=sample(),rounds=saved.run.steps[0].runtime!.input!.rounds;
  rounds.push({round:1,retryOfRound:0,messages:[],usesTools:true,json:false});
  expect(describeAgentTask(saved,1)).toMatchObject({inputsRecorded:true,modelCalls:2,tools:{attempted:1}});
  rounds[1].retryOfRound=1;expect(describeAgentTask(saved,1).inputsRecorded).toBe(false);
  rounds[1].retryOfRound=0;rounds[1].usesTools=false;expect(describeAgentTask(saved,1).inputsRecorded).toBe(false);
  delete rounds[1].retryOfRound;expect(describeAgentTask(saved,1).inputsRecorded).toBe(false);
 });
 it('进度只暴露白名单恢复状态，重试不计作业务工具且不泄漏模型输入',()=>{
  const saved=sample();saved.run.steps[0].runtime!.recovery={status:'waiting',httpStatus:503,round:1,retryAt:'2026-10-15T02:20:00.000Z'};
  const safe=publicAgentResponse(saved.run) as AgentRunVO;
  expect(safe.steps[0].runtime?.recovery).toEqual(saved.run.steps[0].runtime!.recovery);
  expect(safe.steps[0].runtime).not.toHaveProperty('input');
  expect(describeAgentTask(saved,1).tools.attempted).toBe(1);
  const malformed={runtime:{recovery:{status:'waiting',httpStatus:401,round:1,retryAt:'2026-10-15T02:20:00.000Z',private:'secret'}}};
  expect((publicAgentResponse(malformed) as typeof malformed).runtime).not.toHaveProperty('recovery');
  const withExtra={runtime:{recovery:{...saved.run.steps[0].runtime!.recovery,private:'secret'}}};
  expect(JSON.stringify(publicAgentResponse(withExtra))).not.toContain('secret');
 });
 it('同问题、原始范围和完整输入与版本才允许严格对照，人工评分仍待评价',()=>{
  const result=compareAgentTasks(describeAgentTask(sample('business-agent-v1'),1),describeAgentTask(sample(),2));
  expect(result.strict).toBe(true);expect(result.manualEvaluation).toBe('pending');expect(result.old.model).toBe('recorded-model');expect(result.new.tools).toEqual({attempted:1,completed:1,failed:0,argumentErrors:0,pending:0});expect(result.new.actions.formallyCompleted).toBeNull();expect(result.limitations.join('')).toContain('不代表回答语义正确');
 });
 it('问题、数据批次和知识来源不匹配时明确描述性，不能靠成功状态认定同条件',()=>{
  const old=sample('business-agent-v1'),next=sample();next.message='分析续费';next.run.evidence[0].version='batch-v2';next.run.steps[1].evidence[0].version='batch-v2';next.run.steps.push({id:'kb',tool:'search_knowledge',status:'completed',evidence:[{id:'knowledge-evidence',kind:'knowledge',sourceId:'source',version:'2',summary:'口径',updatedAt:next.run.startedAt}]});
  const result=compareAgentTasks(describeAgentTask(old,1),describeAgentTask(next,1));expect(result.strict).toBe(false);expect(result.limitations.join('')).toContain('用户问题不同');expect(result.limitations.join('')).toContain('冻结数据版本不一致');expect(result.limitations.join('')).toContain('知识来源或版本不同');
 });
 it('未知事实保留空值和状态，不当作零或核验失败',()=>{
  const saved=sample();const fact=saved.run.steps[1].facts![0];fact.value=null;fact.status='insufficient_data';saved.run.answer!.facts=[structuredClone(fact)];const result=describeAgentTask(saved,3);expect(result.facts).toMatchObject({verified:1,unknown:1,consistent:true});expect(saved.run.answer!.facts[0].value).toBeNull();
 });
 it('事实值与单位须逐项匹配，引用必须来自程序工具证据',()=>{
  const saved=sample();saved.run.answer!.facts=[{...saved.run.answer!.facts[0],value:99,unit:'人',evidenceIds:['invented']}];const result=describeAgentTask(saved,1);expect(result.facts.consistent).toBe(false);expect(result.facts.invalidFactIds).toEqual(['attendance']);expect(result.facts.invalidEvidenceIds).toEqual(['invented']);
 });
 it('旧范围补录不是新引擎证据；不使用当前环境模型推测旧记录',()=>{
  vi.stubEnv('CHAT_MODEL','current-config');const saved=sample();saved.run.steps[0].id='legacy-context';delete saved.run.steps[0].runtime;expect(identifyAgentVersion(saved.run).engine).toBe('v1');const described=describeAgentTask(saved,null);expect(described.model).toBeNull();expect(described.inputsRecorded).toBe(false);expect(described.contextSource).toBe('legacy');expect(compareAgentTasks(described,describeAgentTask(sample(),1)).strict).toBe(false);
 });
 it('参数错误计入工具尝试，交流completed不能算正式业务任务完成',()=>{
  const saved=sample();saved.run.steps.push({id:'invalid',tool:'propose_tag',status:'failed',errorCode:'INVALID_ARGUMENTS',evidence:[]});const described=describeAgentTask(saved,1);expect(described.tools).toMatchObject({attempted:2,completed:1,failed:1,argumentErrors:1});expect(described.actions.formallyCompleted).toBeNull();expect(described.manualTaskCompletion).toBe('pending');
 });
 it('正式动作须全部完成且保留真实结果编号，失败与缺失结果不能算闭环',()=>{
  const saved=sample();saved.run.actionPlan={id:'plan',runId:saved.run.id,version:1,datasetId:dataset,scope:saved.run.context!.scope,status:'completed',steps:[{id:'report-step',kind:'generate_report',title:'月报',status:'completed',input:{kind:'generate_report',kindOfReport:'monthly',anchorDate:'2026-08-01'},result:{id:'actual-report',url:'/dashboard/reports',label:'报告'}}],evidence:[],sourceFingerprint:'batch-v1',createdAt:saved.run.startedAt,updatedAt:saved.run.completedAt!};
  expect(describeAgentTask(saved,1).actions.formallyCompleted).toBe(true);delete saved.run.actionPlan.steps[0].result;expect(describeAgentTask(saved,1).actions.formallyCompleted).toBe(false);saved.run.actionPlan.steps[0].status='failed';saved.run.actionPlan.status='partially_failed';expect(describeAgentTask(saved,1).actions).toMatchObject({failed:1,formallyCompleted:false});
 });
 it('公开响应仅返回输入摘要，嵌套run/session/progress均不泄露原始提示且不修改仓储对象',()=>{
  const run=sample().run;run.steps[0].runtime!.input!.rounds[0].messages=[{role:'system',content:'private-internal-prompt'}];const payload={data:{run,runs:[run]}};const safe=publicAgentResponse(payload);expect(JSON.stringify(safe)).not.toContain('private-internal-prompt');expect(JSON.stringify(safe)).not.toContain('"messages"');expect((safe as typeof payload).data.run.steps[0].runtime?.inputSummary).toMatchObject({recorded:true,calls:1});expect(run.steps[0].runtime?.input?.rounds[0].messages).toHaveLength(1);
 });
 it('比较请求拒绝相同运行、额外身份字段；viewer只开放精确只读路径',()=>{
  const id=sample().run.id;expect(agentTaskComparisonSchema.safeParse({oldRunId:id,newRunId:id}).success).toBe(false);expect(agentTaskComparisonSchema.safeParse({oldRunId:sample('business-agent-v1').run.id,newRunId:id,organizationId:org}).success).toBe(false);expect(canAccess('viewer','POST','/api/agent/research/compare')).toBe(true);expect(canAccess('viewer','POST','/api/agent/research/compare/confirm')).toBe(false);expect(canAccess('viewer','POST','/api/agent/actions/confirm')).toBe(false);
 });
 it('服务要求已验证公司身份，伪造组织或账号在查询前拒绝；正常读取按机构参数过滤',async()=>{
  vi.stubEnv('COMPANY_REGISTRY_JSON','');vi.stubEnv('DEFAULT_COMPANY_CODE','main');vi.stubEnv('SYSTEM_USER_ID',org);clearTestCompanyContext();expect(()=>assertAgentResearchActor(actor)).toThrow('拒绝');
  await runWithCompany('main',async()=>{expect(()=>assertAgentResearchActor({...actor,userId:'other'})).toThrow('已验证');expect(()=>assertAgentResearchActor({...actor,organizationId:'foreign'})).toThrow('已验证');db.queryRows.mockResolvedValue([]);expect(await agentResearchService.list(actor)).toEqual([]);expect(db.queryRows.mock.calls[0][1]).toEqual([org]);expect(db.queryRows.mock.calls[0][0]).toContain('e."organizationId"=$1::uuid');expect(db.execute).not.toHaveBeenCalled();},actor);
 });
});
