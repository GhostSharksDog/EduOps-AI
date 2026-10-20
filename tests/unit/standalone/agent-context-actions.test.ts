import {describe,expect,it} from 'vitest';
import type {AgentFactVO,AgentQuestionVO,AgentRunVO} from '@/modules/agent/contracts';
import type {ActionPlanVO} from '@/modules/agent/contracts/actions';
import {buildClarificationReply,canSendClarificationImmediately,clientContextKey,contextScopeStatus,getContextActions,safeAgentResultHref,selectKeyFacts} from '@/modules/agent/domain/context-actions';

const now=Date.parse('2026-10-19T02:00:00.000Z');
const scope={organizationId:'org',authorizedCampusIds:[],startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[]};
const fact=(id:string,label:string,value:number|null=75,status='ready'):AgentFactVO=>({id,label,value,unit:'%',status,evidenceIds:['evidence']});
const run=(patch:Partial<AgentRunVO>={}):AgentRunVO=>({id:'run',sessionId:'session',status:'completed',steps:[],proposals:[],evidence:[],answer:{summary:'本轮分析',facts:[fact('q:attendance_rate','出勤率')],hypotheses:[],recommendations:[],limitations:[],kind:'analysis'},errorCode:null,errorMessage:null,startedAt:new Date(now-1000).toISOString(),completedAt:new Date(now).toISOString(),context:{datasetId:'dataset',scope},...patch});
const options=(record=run())=>({run:record,question:'出勤为什么下降？',mode:'operations' as const,writable:true,canContinue:true,scopeStatus:'current' as const,now});
const plan=(patch:Partial<ActionPlanVO>={}):ActionPlanVO=>({id:'plan',version:2,runId:'run',datasetId:'dataset',scope,status:'prepared',steps:[],evidence:[],sourceFingerprint:'hash',createdAt:new Date(now-1000).toISOString(),updatedAt:new Date(now-1000).toISOString(),...patch});

describe('结果驱动的下一步',()=>{
 it('客户端范围比较忽略权限内部字段及选项顺序，但区分来源、模式、日期和截止',()=>{
  const original={datasetId:'dataset',scope:{...scope,campusIds:['b','a'],courseIds:['c','d'],channelIds:['y','x'],observationCutoff:'first'}};
  const reordered={datasetId:'dataset',scope:{...scope,organizationId:'server-organization',authorizedCampusIds:['b'],campusIds:['a','b'],courseIds:['d','c'],channelIds:['x','y'],observationCutoff:'second'}};
  expect(clientContextKey(original)).toBe(clientContextKey(reordered));
  expect(contextScopeStatus(original,reordered)).toBe('current');
  for(const changed of [{...original,datasetId:'other'},{...original,scope:{...original.scope,endDate:'2026-08-30'}},{...original,scope:{...original.scope,dataCutoff:'2026-09-01T00:00:00.000Z'}},{datasetId:'dataset',scope:{courseKeys:[],relativeDayStart:0}},{datasetId:'dataset',scope:{years:[2024,2025]}}])expect(contextScopeStatus(original,changed)).toBe('different');
  expect(contextScopeStatus(undefined,original)).toBe('unknown');
  expect(contextScopeStatus({datasetId:'dataset',scope:{years:[2025,2024]}},{datasetId:'dataset',scope:{years:[2024,2025]}})).toBe('current');
  expect(contextScopeStatus({datasetId:'dataset',scope:{courseKeys:['b','a'],relativeDayStart:0,relativeDayEnd:10}},{datasetId:'dataset',scope:{courseKeys:['a','b'],relativeDayStart:0,relativeDayEnd:11}})).toBe('different');
 });
 it('没有结果的执行中不提前推荐操作，也不重复生成固定示例',()=>{
  expect(getContextActions(options(run({status:'running'})))).toEqual([]);
  expect(getContextActions(options(run({answer:{summary:'你好',facts:[],hypotheses:[],recommendations:[],limitations:[],kind:'conversation'}})))).toEqual([]);
 });
 it('按当前问题选择指标，不因八项指标中先出现出勤就推荐错误操作',()=>{
  const data=run();data.answer!.facts.push(fact('q:admission_conversion','招生转化率'));
  const actions=getContextActions({...options(data),question:'招生渠道的转化怎么样？'});
  expect(actions.map(action=>action.id)).toEqual(['admission-channel','evidence']);
  expect(actions[0]).toMatchObject({kind:'message',message:expect.stringContaining('按渠道拆解')});
 });
 it('先拆解课程，已有课程拆解时再准备规则预览，所有动作都不直接发布',()=>{
  expect(getContextActions(options())[0]).toMatchObject({id:'attendance-breakdown',kind:'message'});
  const record=run({steps:[{id:'step',tool:'query_metric_breakdown',status:'completed',input:{dimension:'course'},evidence:[]}]});
  expect(getContextActions(options(record))[0]).toMatchObject({id:'attendance-proposal',kind:'message',message:expect.stringContaining('不发布或保存人群')});
  expect(getContextActions({...options(record),writable:false})[0].id).toBe('attendance-breakdown');
 });
 it('八项指标同时返回时明确的续费问题优先，不回落到第一项出勤',()=>{
  const record=run();record.answer!.facts=[fact('q:attendance_rate','出勤率'),fact('q:class_fill_rate','满班率'),fact('q:hours_progress','课耗进度'),fact('q:admission_conversion','招生转化率'),fact('q:renewal_rate','续费率'),fact('q:retention_rate','学员留存率'),fact('q:complaint_count','客诉数量'),fact('q:refund_amount','完成退款金额')];
  const actions=getContextActions({...options(record),question:'续费情况怎么样？'});
  expect(actions[0]).toMatchObject({id:'renewal-course',kind:'message',label:'比较课程续费'});
  expect(actions.every(action=>action.id!=='attendance-breakdown')).toBe(true);
 });
 it('只有本期出勤时下一步使用中性比较，不暗示已证实下降',()=>{
  const actions=getContextActions({...options(),question:'看看当前出勤情况'});
  expect(actions[0]).toMatchObject({id:'attendance-breakdown',label:'比较课程出勤',message:expect.stringContaining('若有完整对比期再比较变化')});
  expect(actions[0].label).not.toContain('下降');
 });
 it('历史范围只给明确切回动作，不能静默在下一轮范围发送追问',()=>{
  const actions=getContextActions({...options(),scopeStatus:'different'});
  expect(actions[0]).toMatchObject({kind:'continue_scope',context:{datasetId:'dataset'}});
  expect(actions.every(action=>action.kind!=='message')).toBe(true);
  expect(getContextActions({...options(),scopeStatus:'unknown',canContinue:false}).map(action=>action.kind)).toEqual(['open_evidence']);
  expect(getContextActions({...options(run({context:undefined})),scopeStatus:'unknown'}).every(action=>action.kind!=='continue_scope')).toBe(true);
 });
 it('失败优先复用冻结依据解读，不能把失败当作正常创建后续',()=>{
  const failed=run({status:'failed',recoveryEligibility:{eligible:true}});
  expect(getContextActions(options(failed)).map(action=>action.kind)).toEqual(['retry_interpretation','open_evidence']);
  expect(getContextActions(options({...failed,recoveryEligibility:{eligible:false,reason:'旧记录缺少冻结依据'}})).map(action=>action.kind)).toEqual(['open_evidence']);
  expect(getContextActions({...options(failed),canContinue:false}).map(action=>action.kind)).toEqual(['open_evidence']);
 });
 it('待确认和部分失败的计划引导核对，不提供模型确认动作',()=>{
  expect(getContextActions(options(run({actionPlan:plan()})))).toEqual([{id:'operations',kind:'open_operations',runId:'run',label:'核对操作计划'}]);
  expect(getContextActions(options(run({actionPlan:plan({status:'partially_failed'})})))[0].label).toBe('查看待恢复步骤');
 });
 it('计划及预览过期只允许重新准备，原完成步骤不重复创建',()=>{
  const expired=run({actionPlan:plan({createdAt:new Date(now-31*60*1000).toISOString()})});
  const actions=getContextActions(options(expired));
  expect(actions.map(action=>action.kind)).toEqual(['open_operations','message']);
  expect(actions[1]).toMatchObject({message:expect.stringContaining('不重复创建')});
  expect(getContextActions({...options(expired),writable:false})).toHaveLength(1);
 });
 it('完成计划仅链接实际成功结果，人群入口优先且拒绝危险地址',()=>{
  const record=run({actionPlan:plan({status:'completed',steps:[
   {id:'tag',kind:'publish_tag',title:'发布',status:'completed',input:{kind:'publish_tag',proposalId:'proposal',version:1,previewToken:'token',previewFingerprint:'fp',sourceFingerprint:'source'},result:{id:'tag',url:'/dashboard/tags/risk?proposalId=proposal',label:'标签'}},
   {id:'segment',kind:'save_segment',title:'保存',status:'completed',input:{kind:'save_segment',publishStepId:'tag',name:'人群'},result:{id:'segment',url:'/dashboard/profiles?snapshotId=segment',label:'人群'}},
   {id:'bad',kind:'save_segment',title:'危险地址',status:'completed',input:{kind:'save_segment',publishStepId:'tag',name:'坏地址'},result:{id:'bad',url:'https://example.invalid',label:'外链'}},
  ]})});
  const actions=getContextActions(options(record));expect(actions).toHaveLength(2);expect(actions[0]).toMatchObject({kind:'open_saved_result',label:'查看已保存人群'});
 });
 it('待预览草稿标明具体版本，已预览草稿先查看确认卡',()=>{
  const proposal={id:'proposal',kind:'tag' as const,version:3,status:'draft' as const,name:'关注名单',estimatedCount:null,previewToken:null,previewFingerprint:null,publishedTagId:null,evidence:[]};
  const actions=getContextActions(options(run({proposals:[proposal]})));
  expect(actions[0]).toMatchObject({kind:'message',message:expect.stringContaining('版本 3')});
  expect(getContextActions(options(run({proposals:[{...proposal,status:'awaiting_confirmation'}]})))[0].kind).toBe('open_operations');
  expect(getContextActions({...options(run({proposals:[proposal]})),writable:false}).every(action=>action.kind!=='message')).toBe(true);
 });
 it('学习与财务模式不推荐经营标签，财务只准备核查事项',()=>{
  const learning=run({steps:[{id:'step',tool:'query_learning_metrics',status:'completed',evidence:[]}]});
  expect(getContextActions({...options(learning),mode:'learning'})[0]).toMatchObject({id:'learning-detail',kind:'message'});
  const finance=run({steps:[{id:'step',tool:'query_financial_metrics',status:'completed',evidence:[]}]});
  expect(getContextActions({...options(finance),mode:'finance'})[0]).toMatchObject({id:'finance-review',message:expect.stringContaining('不直接建立任务')});
  expect(getContextActions({...options(finance),mode:'finance',writable:false})[0].kind).toBe('open_evidence');
 });
 it('有澄清问题时不额外堆叠业务建议',()=>{
  expect(getContextActions(options(run({answer:{summary:'请补充',facts:[],hypotheses:[],recommendations:[],limitations:[],questions:[{id:'period',prompt:'选哪个周期？'}],kind:'clarification'}})))).toEqual([]);
 });
 it('结果链接拒绝跨站、控制字符、编码路径穿越及反斜杠',()=>{
  for(const url of ['https://example.invalid','//evil.invalid/dashboard/','/dashboard/%2e%2e/login','/dashboard/../login','/dashboard/\\evil','/dashboard/%0aevil','/dashboard/a\n'])expect(safeAgentResultHref(url)).toBeNull();
  expect(safeAgentResultHref('/dashboard/profiles?snapshotId=valid')).toBe('/dashboard/profiles?snapshotId=valid');
 });
});

describe('与问题相关的关键事实卡',()=>{
 it('当前主值、程序计算的变化和对比期优先，分子分母不占三张卡',()=>{
  const facts=[fact('q:renewal_rate','续费率'),fact('q:attendance_rate:numerator','出勤率·已识别分子',60),fact('q:attendance_rate:denominator','出勤率·统计分母',80),fact('q:previous:attendance_rate','对比期 出勤率',80),fact('q:change:attendance_rate','出勤率周期变化',-5),fact('q:attendance_rate','出勤率',75)];
  const selected=selectKeyFacts(facts,'出勤为什么下降？');
  expect(selected.map(item=>item.id)).toEqual(['q:attendance_rate','q:change:attendance_rate','q:previous:attendance_rate']);
  expect(selected[0]).toBe(facts[5]);expect(facts[4].value).toBe(-5);
 });
 it('未知指标仍展示未知，不拿其他无关已知值掩盖数据不足',()=>{
  const unknown=fact('q:renewal_rate','续费率',null,'insufficient_data');
  expect(selectKeyFacts([fact('q:attendance_rate','出勤率'),unknown],'续费率是多少？',1)).toEqual([unknown]);
 });
 it('财务年度主值优先最近披露年度，不把最早年度误当本期',()=>{
  const facts=[fact('q:2023:revenue','2023年度 营业收入'),fact('q:2024:revenue','2024年度 营业收入'),fact('q:2025:revenue','2025年度 营业收入'),fact('q:change:revenue','最新年度 营业收入同比变化')];
  expect(selectKeyFacts(facts,'收入有什么变化？').map(item=>item.id)).toEqual(['q:2025:revenue','q:2024:revenue','q:change:revenue']);
 });
 it('不将纯分子分母、步骤数、版本和周期文字伪装关键经营数字',()=>{
  expect(selectKeyFacts([fact('q:plan:steps','计划步骤数'),fact('q:attendance_rate:denominator','出勤率·统计分母'),fact('q:comparison:period','对比期')],'出勤')).toEqual([]);
 });
 it('输入保持原样、同ID只显示一次、默认最多三卡',()=>{
  const original=[fact('a','客诉数量',0),fact('b','完成退款金额',100),fact('c','出勤率'),fact('d','续费率')];
  const snapshot=JSON.stringify(original);
  expect(selectKeyFacts([...original,original[0]],'',20)).toHaveLength(3);
  expect(selectKeyFacts(original,'',0)).toEqual([]);expect(JSON.stringify(original)).toBe(snapshot);
 });
});

describe('澄清回复仅表达用户选择',()=>{
 const questions:AgentQuestionVO[]=[{id:'period',prompt:'选择统计周期',options:[{label:'八月',value:'使用八月的完整统计周期'}]},{id:'course',prompt:'需要哪些课程？',options:[{label:'全部',value:'保留全部课程'}]}];
 it('多问题选择完整后才可统一提交，保留问题与原value，不把label/id当事实',()=>{
  expect(buildClarificationReply(questions,[{questionId:'period',value:'使用八月的完整统计周期'}])).toBeNull();
  const reply=buildClarificationReply(questions,[{questionId:'period',value:'使用八月的完整统计周期'},{questionId:'course',value:'保留全部课程'}]);
  expect(reply).toBe('补充本轮问题的信息：\n选择统计周期：使用八月的完整统计周期\n需要哪些课程？：保留全部课程');
 });
 it('拒绝伪造选项、重复问题、额外选择和空白补参',()=>{
  for(const selections of [[{questionId:'period',value:'任意其他值'}],[{questionId:'period',value:'使用八月的完整统计周期'},{questionId:'period',value:'使用八月的完整统计周期'}]])expect(buildClarificationReply(questions.slice(0,1),selections)).toBeNull();
  expect(buildClarificationReply([questions[0],questions[0]],[])).toBeNull();
  expect(buildClarificationReply([{id:'name',prompt:'名称'}],[{questionId:'name',value:'   '}])).toBeNull();
 });
 it('只有普通补参可一键发送，写入或确认语句先交给输入保护与显式提交',()=>{
  expect(canSendClarificationImmediately('保留全部课程')).toBe(true);
  for(const value of ['确认发布标签','保存人群','创建任务','生成经营报告','审核这份材料',''])expect(canSendClarificationImmediately(value)).toBe(false);
 });
});
