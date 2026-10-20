import {afterEach,describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {ChatCompletionVO,ChatMessage} from '@/platform/ai/client';
import type {EvidenceReference} from '@/shared/contracts/analysis';
import type {AgentActor,AgentRepository,AgentRunVO,AgentSessionVO,AgentTurnContext,StoredAgentRun} from '@/modules/agent/contracts';
import type {AgentFrozenEvidence} from '@/modules/agent/contracts/research';
import {AgentError} from '@/modules/agent/domain/errors';
import {emptyTaskState,taskScopeKey,evidenceScopeKey} from '@/modules/agent/domain/task-state';
import {InterpretationRecoveryService,interpretationEligibility,frozenRunBasis} from '@/modules/agent/services/interpretation-recovery';

const organizationId=randomUUID(),userId=randomUUID(),datasetId=randomUUID();
const actor:AgentActor={organizationId,userId,role:'operator'};
const context:AgentTurnContext={datasetId,scope:{organizationId,authorizedCampusIds:[],startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[],dataCutoff:'2026-08-31T15:59:59.999Z'}};
const fingerprint='a'.repeat(64);
const clone=<T>(value:T):T=>structuredClone(value);
const answer=(summary='原冻结出勤率为{{fact:attendance}}，请先核对签到完整性。'):ChatCompletionVO=>({message:{content:JSON.stringify({kind:'analysis',summary,factIds:['attendance'],hypotheses:['签到缺失可能影响结果，仍待核实。'],recommendations:['核对原周期的签到记录，并记录核查结果。'],limitations:[]})}});
const malformed=():ChatCompletionVO=>({message:{content:'not-json'}});
const forbidden=():ChatCompletionVO=>({message:{content:null,tool_calls:[{id:'forbidden-call',type:'function',function:{name:'propose_tag',arguments:'{}'}}]}});
type Reply=ChatCompletionVO|Error|(()=>Promise<ChatCompletionVO>);

function sourceRecord():StoredAgentRun{
 const now=new Date().toISOString(),sessionId=randomUUID(),runId=randomUUID();
 const evidence:EvidenceReference[]=[{id:'metric-evidence',kind:'metric',sourceId:datasetId,version:'source-batch',summary:'原周期的程序统计',scope:context.scope as never,updatedAt:now},{id:'knowledge-evidence',kind:'knowledge',sourceId:randomUUID(),version:'2',summary:'已审核的指标口径',updatedAt:now}];
 const facts=[{id:'attendance',label:'出勤率',value:80,unit:'%',status:'ready',evidenceIds:['metric-evidence']}];
 const freeze:AgentFrozenEvidence={version:'agent-evidence-v1',datasetId,scopeKey:taskScopeKey(context),dataFingerprint:fingerprint,knowledgeVersions:[{sourceId:evidence[1].sourceId,version:'2'}],frozenAt:now};
 const run:AgentRunVO={id:runId,sessionId,status:'failed',steps:[{id:'context',tool:'resolve_context',status:'completed',evidence:[],context:clone(context),runtime:{engineVersion:'business-agent-v3',model:'fixture-model',promptVersion:'fixture-v3',recordedAt:now,freeze}},{id:'metrics',tool:'query_metrics',status:'completed',context:clone(context),facts:clone(facts),evidence:clone(evidence)}],proposals:[],evidence:clone(evidence),answer:{kind:'analysis',summary:'原智能解读失败，已保留程序事实。',facts:clone(facts),hypotheses:[],recommendations:[],limitations:['模型连接中断']},errorCode:'MODEL_NETWORK',errorMessage:'原模型连接中断',startedAt:now,completedAt:now,context:clone(context)};
 // The next-query range and current task deliberately differ from the old frozen run.
 const currentContext:AgentTurnContext={datasetId,scope:{...context.scope,startDate:'2026-09-01',endDate:'2026-09-30'} as AgentTurnContext['scope']};
 const taskState={...emptyTaskState(currentContext,now,4),goal:'跟进当前周期的续费',userConditions:['保留当前任务目标']};
 const session:AgentSessionVO={id:sessionId,title:'已有连续对话',datasetId,scope:currentContext.scope,createdBy:userId,editable:true,createdAt:now,updatedAt:now,taskState};
 return {run,session,message:'分析原周期的出勤情况',deadlineAt:new Date(Date.now()+120000).toISOString()};
}

function harness(responses:Reply[]=[answer()],options:{configured?:boolean;deadlineMs?:number}={}){
 const source=sourceRecord(),sources=new Map([[source.run.id,clone(source)]]),session=clone(source.session);
 const recoveries=new Map<string,{key:string;owner:string;hash:string;saved:StoredAgentRun}>();
 const owner=(value:AgentActor)=>value.organizationId+':'+value.userId;
 function lookup(value:AgentActor,id:string):StoredAgentRun{
  if(value.organizationId!==organizationId)throw new AgentError('NOT_FOUND','无权访问此执行',404);
  const saved=sources.get(id)??recoveries.get(id)?.saved;
  if(!saved)throw new AgentError('NOT_FOUND','执行不存在',404);
  return {...clone(saved),session:{...clone(session),editable:session.createdBy===value.userId||value.role==='admin'}};
 }
 const repository:AgentRepository={
  prepare:vi.fn(async()=>{throw new Error('重新解读不能启动完整分析');}),
  getRun:vi.fn(async(value,id)=>lookup(value,id)),
  progress:vi.fn(async(value,key)=>{const entry=[...recoveries.values()].find(entry=>entry.owner===owner(value)&&entry.key===key);return {prepared:!!entry,run:entry?clone(entry.saved.run):null,deadlineAt:entry?.saved.deadlineAt??null,expired:false};}),
  prepareRecovery:vi.fn(async(value,input)=>{
   const old=[...recoveries.values()].find(entry=>entry.owner===owner(value)&&entry.key===input.requestKey);
   if(old){if(old.hash!==input.requestHash)throw new AgentError('REQUEST_KEY_CONFLICT','解读请求发生冲突',409);return {execution:clone(old.saved),reused:true};}
   const now=new Date().toISOString(),id=randomUUID();
   const run:AgentRunVO={id,sessionId:session.id,status:'running',steps:[{id:'context',tool:'resolve_context',status:'completed',context:clone(input.context),evidence:[],runtime:{engineVersion:'business-agent-v3',model:'fixture-model',promptVersion:'interpretation-recovery-v1',recordedAt:now,freeze:clone(input.freeze),recoveryOf:{runId:input.sourceRunId,kind:'interpretation',fingerprint:input.freeze.dataFingerprint}}},{id:'frozen-facts',tool:'restore_frozen_facts',status:'completed',context:clone(input.context),facts:clone(input.facts),evidence:clone(input.evidence)}],proposals:[],evidence:clone(input.evidence),answer:null,errorCode:null,errorMessage:null,startedAt:now,completedAt:null,context:clone(input.context)};
   const saved:StoredAgentRun={run,session:clone(session),message:source.message,deadlineAt:new Date(Date.now()+(options.deadlineMs??120000)).toISOString()};
   recoveries.set(id,{owner:owner(value),key:input.requestKey,hash:input.requestHash,saved:clone(saved)});return {execution:saved,reused:false};
  }),
  save:vi.fn(async(value,run)=>{const entry=recoveries.get(run.id);if(!entry||entry.owner!==owner(value))throw new AgentError('NOT_FOUND','恢复执行不存在',404);entry.saved.run=clone(run);}),
  finish:vi.fn(async(value,run,expected=['running'])=>{const entry=recoveries.get(run.id);if(!entry||entry.owner!==owner(value)||!expected.includes(entry.saved.run.status))return false;entry.saved.run=clone(run);return true;}),
  listSessions:vi.fn(async()=>[clone(session)]),getSession:vi.fn(async()=>({session:clone(session),messages:[],runs:[]})),history:vi.fn(async()=>[]),
 };
 const chat=vi.fn(async(_messages:ChatMessage[],_tools:unknown[],_options?:{signal?:AbortSignal;json?:boolean})=>{const next=responses.shift();if(next instanceof Error)throw next;if(typeof next==='function')return next();if(!next)throw new Error('受控模型响应已用完');return clone(next);});
 const fingerprintRead=vi.fn(async()=>fingerprint),validateKnowledge=vi.fn(async()=>{}),authorizeScope=vi.fn(async()=>{});
 const service=new InterpretationRecoveryService({repository,model:{chat},configured:()=>options.configured??true,fingerprint:fingerprintRead,validateKnowledge,authorizeScope,safeError:error=>error instanceof AgentError?error:new AgentError('MODEL_ERROR','受控模型调用失败',502)});
 return {service,repository,source,sources,session,recoveries,chat,fingerprintRead,validateKnowledge,authorizeScope};
}

afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
describe('仅恢复冻结事实的智能解读',()=>{
 it('原问题要求课程拆解但仅有总指标时拒绝仅解读，既不调用模型也不创建恢复',async()=>{
  const h=harness(),source=h.sources.get(h.source.run.id)!;source.message='帮我看看当前范围的出勤情况，比较变化并拆解可能受影响的课程。';
  await expect(h.service.retry(actor,source.run.id,{requestKey:randomUUID()})).rejects.toMatchObject({code:'RECOVERY_UNAVAILABLE'});
  expect(h.chat).not.toHaveBeenCalled();expect(h.repository.prepareRecovery).not.toHaveBeenCalled();expect(h.sources.get(source.run.id)?.run.status).toBe('failed');
 });
 it('同一公共范围的不同观察截止不能混入同一冻结解读',()=>{
  const record=sourceRecord(),early={...context,scope:{...context.scope,observationCutoff:'2026-08-31T15:59:59.999Z'}},later={...context,scope:{...context.scope,observationCutoff:'2026-09-30T15:59:59.999Z'}};
  expect(taskScopeKey(early)).toBe(taskScopeKey(later));expect(evidenceScopeKey(early)).not.toBe(evidenceScopeKey(later));
  record.run.context=later;record.run.steps[0].runtime!.freeze!.scopeKey=evidenceScopeKey(later);
  record.run.steps.push({...clone(record.run.steps[1]),id:'old-observation',context:early,facts:[{...record.run.steps[1].facts![0],id:'stale-observation'}]});
  record.run.steps[1].context=later;
  expect(frozenRunBasis(record.run).facts.map(f=>f.id)).toEqual(['attendance']);expect(interpretationEligibility(record.run).eligible).toBe(true);
  record.run.steps[0].runtime!.freeze!.scopeKey=evidenceScopeKey(early);expect(interpretationEligibility(record.run).eligible).toBe(false);
 });
 it('缺少冻结记录、有效事实、结束状态或适用错误时拒绝创建恢复',async()=>{
  const mutations:Array<(saved:StoredAgentRun)=>void>=[
   saved=>{delete saved.run.steps[0].runtime!.freeze;},
   saved=>{saved.run.steps[1].facts=[];},
   saved=>{saved.run.status='running';saved.run.completedAt=null;},
   saved=>{saved.run.errorCode='OUTSIDE_SCOPE';},
   saved=>{saved.run.steps[0].runtime!.freeze!.scopeKey='wrong-scope';},
  ];
  for(const mutate of mutations){const h=harness();mutate(h.source);h.sources.set(h.source.run.id,clone(h.source));expect(interpretationEligibility(h.source.run).eligible).toBe(false);await expect(h.service.retry(actor,h.source.run.id,{requestKey:randomUUID()})).rejects.toMatchObject({code:'RECOVERY_UNAVAILABLE'});expect(h.repository.prepareRecovery).not.toHaveBeenCalled();expect(h.chat).not.toHaveBeenCalled();}
 });
 it('仅用旧冻结事实调用模型，原失败执行、当前会话范围和任务记忆保持不变',async()=>{
  const h=harness(),beforeSource=clone(h.sources.get(h.source.run.id)),beforeSession=clone(h.session);
  const result=await h.service.retry(actor,h.source.run.id,{requestKey:randomUUID()});
  expect(result.status).toBe('ready');expect(result.data).toMatchObject({status:'completed',recoveryOf:{runId:h.source.run.id,kind:'interpretation'},proposals:[]});
  expect(result.data?.context).toEqual(context);expect(result.data?.answer?.facts[0].value).toBe(80);expect(result.data?.answer?.summary).toContain('80%');
  expect(result.data?.steps.map(step=>step.tool)).toEqual(['resolve_context','restore_frozen_facts']);expect(result.data?.actionPlan).toBeUndefined();
  expect(h.chat).toHaveBeenCalledTimes(1);expect(h.chat.mock.calls[0][1]).toEqual([]);expect(h.chat.mock.calls[0][2]).toMatchObject({json:true});
  expect(h.repository.prepare).not.toHaveBeenCalled();expect(h.repository.history).not.toHaveBeenCalled();expect(h.sources.get(h.source.run.id)).toEqual(beforeSource);expect(h.session).toEqual(beforeSession);
  expect(h.authorizeScope).toHaveBeenCalledWith(actor,context);expect(h.fingerprintRead).toHaveBeenCalledTimes(2);expect(h.validateKnowledge).toHaveBeenCalledTimes(2);
 });
 it('恢复开始前批次变化时不创建执行，也不调用模型',async()=>{
  const h=harness();h.fingerprintRead.mockResolvedValue('changed-batch');
  await expect(h.service.retry(actor,h.source.run.id,{requestKey:randomUUID()})).rejects.toMatchObject({code:'BATCH_CHANGED'});
  expect(h.repository.prepareRecovery).not.toHaveBeenCalled();expect(h.chat).not.toHaveBeenCalled();
 });
 it('解读完成前依据变化则保存明确失败及原事实，不发布新解释',async()=>{
  const h=harness();h.fingerprintRead.mockResolvedValueOnce(fingerprint).mockResolvedValueOnce('new-business-state');
  const result=await h.service.retry(actor,h.source.run.id,{requestKey:randomUUID()});
  expect(result.status).toBe('error');expect(result.data).toMatchObject({status:'failed',errorCode:'BATCH_CHANGED'});expect(result.data?.answer?.summary).not.toContain('80%');expect(result.data?.answer?.facts[0].value).toBe(80);expect(h.sources.get(h.source.run.id)?.run.errorCode).toBe('MODEL_NETWORK');
 });
 it('审核知识在开始前或解读期间撤销时拒绝展示为成功',async()=>{
  for(const during of [false,true]){
   const h=harness();if(during)h.validateKnowledge.mockResolvedValueOnce(undefined);
   h.validateKnowledge.mockRejectedValueOnce(new AgentError('KNOWLEDGE_CHANGED','知识已撤销，请重新查询',409));
   if(during){const result=await h.service.retry(actor,h.source.run.id,{requestKey:randomUUID()});expect(result.data?.errorCode).toBe('KNOWLEDGE_CHANGED');expect(result.status).toBe('error');}
   else{await expect(h.service.retry(actor,h.source.run.id,{requestKey:randomUUID()})).rejects.toMatchObject({code:'KNOWLEDGE_CHANGED'});expect(h.chat).not.toHaveBeenCalled();}
  }
 });
 it('重复请求复用保存结果，相同请求编号不能换成其他源执行',async()=>{
  const h=harness(),requestKey=randomUUID(),first=await h.service.retry(actor,h.source.run.id,{requestKey}),second=await h.service.retry(actor,h.source.run.id,{requestKey});
  expect(second.data?.id).toBe(first.data?.id);expect(h.repository.prepareRecovery).toHaveBeenCalledTimes(1);expect(h.chat).toHaveBeenCalledTimes(1);
  const another=clone(h.source);another.run.id=randomUUID();h.sources.set(another.run.id,another);
  await expect(h.service.retry(actor,another.run.id,{requestKey})).rejects.toMatchObject({code:'REQUEST_KEY_CONFLICT'});expect(h.chat).toHaveBeenCalledTimes(1);
 });
 it('格式仅修复一次，持续无效的回答不会无限调用模型',async()=>{
  const fixed=harness([malformed(),answer()]);expect((await fixed.service.retry(actor,fixed.source.run.id,{requestKey:randomUUID()})).status).toBe('ready');expect(fixed.chat).toHaveBeenCalledTimes(2);
  const failed=harness([malformed(),malformed(),answer()]),result=await failed.service.retry(actor,failed.source.run.id,{requestKey:randomUUID()});
  expect(result.data?.errorCode).toBe('INVALID_ANSWER');expect(failed.chat).toHaveBeenCalledTimes(2);expect(result.data?.answer?.facts[0].value).toBe(80);
 });
 it('裸写经营数字不能覆盖程序值，修复后仅使用原事实引用',async()=>{
  const h=harness([answer('出勤率为99%，应当全部跟进。'),answer()]),result=await h.service.retry(actor,h.source.run.id,{requestKey:randomUUID()});
  expect(result.status).toBe('ready');expect(result.data?.answer?.summary).toContain('80%');expect(result.data?.answer?.summary).not.toContain('99');expect(h.chat).toHaveBeenCalledTimes(2);
  for(const [,tools,options] of h.chat.mock.calls){expect(tools).toEqual([]);expect(options?.json).toBe(true);}
 });
 it('模型尝试调用标签工具只作为无效回答处理，不产生草稿或业务执行',async()=>{
  const h=harness([forbidden(),forbidden(),answer()]),result=await h.service.retry(actor,h.source.run.id,{requestKey:randomUUID()});
  expect(result.data?.status).toBe('failed');expect(result.data?.errorCode).toBe('INVALID_ANSWER');expect(h.chat).toHaveBeenCalledTimes(2);expect(result.data?.proposals).toEqual([]);expect(result.data?.actionPlan).toBeUndefined();expect(result.data?.steps.map(step=>step.tool)).toEqual(['resolve_context','restore_frozen_facts']);expect(h.repository.prepare).not.toHaveBeenCalled();
 });
 it('只读账号可以恢复自己会话，不能恢复其他账号会话',async()=>{
  const own=harness(),readOnly={...actor,role:'viewer'};expect((await own.service.retry(readOnly,own.source.run.id,{requestKey:randomUUID()})).status).toBe('ready');
  const other=harness();await expect(other.service.retry({...readOnly,userId:randomUUID()},other.source.run.id,{requestKey:randomUUID()})).rejects.toMatchObject({code:'SESSION_READ_ONLY',status:403});expect(other.chat).not.toHaveBeenCalled();expect(other.repository.prepareRecovery).not.toHaveBeenCalled();
 });
 it('模型超时中止该解读，原结果及当前任务不变',async()=>{
  vi.useFakeTimers();const h=harness([()=>new Promise<ChatCompletionVO>(()=>{})],{deadlineMs:120000}),before=clone(h.session);
  const pending=h.service.retry(actor,h.source.run.id,{requestKey:randomUUID()});await vi.advanceTimersByTimeAsync(0);expect(h.chat).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(120000);const result=await pending;
  expect(result.data?.errorCode).toBe('EXECUTION_TIMEOUT');expect(h.chat.mock.calls[0][2]?.signal?.aborted).toBe(true);expect(result.data?.answer?.facts[0].value).toBe(80);expect(h.sources.get(h.source.run.id)?.run.status).toBe('failed');expect(h.session).toEqual(before);
 });
 it('缺少模型配置时不创建恢复，恢复参数拒绝身份和范围字段',async()=>{
  const h=harness([],{configured:false}),result=await h.service.retry(actor,h.source.run.id,{requestKey:randomUUID()});expect(result.status).toBe('unconfigured');expect(h.repository.prepareRecovery).not.toHaveBeenCalled();expect(h.chat).not.toHaveBeenCalled();
  await expect(h.service.retry(actor,h.source.run.id,{requestKey:randomUUID(),organizationId:'forged'})).rejects.toThrow();expect(h.repository.prepareRecovery).not.toHaveBeenCalled();
 });
});
