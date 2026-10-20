import {describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {AuthorizedScope,AuthorizedFinanceScope,EvidenceReference} from '@/shared/contracts/analysis';
import type {RiskProposalVO,RiskPreviewVO} from '@/modules/tag/contracts';
import type {OperationalAnalysis} from '@/modules/analytics/contracts';
import type {ChatCompletionVO,ChatMessage} from '@/platform/ai/client';
import {ModelServiceError} from '@/platform/ai/client';
import type {AgentActor,AgentRepository,StoredAgentRun,AgentRunDTO,AgentSessionVO,AgentMessageVO,AgentRunVO} from '@/modules/agent/contracts';
import {agentRunInputSchema} from '@/modules/agent/contracts';
import {AgentApplicationService} from '@/modules/agent/services/service';
import {createAgentToolRegistry} from '@/modules/agent/services/tools';
import {buildAnswer,inspectAnswerFormat} from '@/modules/agent/domain/answer';
import {summarizedConversationObjects,buildConversationalAnswer,ConversationalNumberError} from '@/modules/agent/domain/conversation';
import {AgentError} from '@/modules/agent/domain/errors';
import {createLearningToolRegistry} from '@/modules/agent/services/learning-tools';
import {ToolRegistry} from '@/modules/agent/services/registry';
import {registerScopeTools} from '@/modules/agent/services/scope-tools';
import type {LearningAnalysis} from '@/modules/analytics/contracts';
import type {KnowledgeService} from '@/modules/knowledge/contracts';
import {readTaskState,prepareTaskState,taskMemoryInput} from '@/modules/agent/domain/task-state';

const org=randomUUID(),user=randomUUID(),dataset=randomUUID(),proposalId=randomUUID(),token=randomUUID();
const actor:AgentActor={userId:user,organizationId:org,role:'operator'};
const scope:AuthorizedScope={organizationId:org,authorizedCampusIds:[],startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[],dataCutoff:'2026-08-31T15:59:59.999Z'};
const evidence:EvidenceReference={id:dataset,kind:'metric',sourceId:dataset,version:'v1',summary:'已完成批次',scope,updatedAt:scope.dataCutoff!};
const input=():AgentRunDTO=>({message:'分析出勤情况',requestKey:randomUUID(),datasetId:dataset,scope:{startDate:scope.startDate,endDate:scope.endDate,campusIds:[],courseIds:[],channelIds:[]}});
const tagInput=():AgentRunDTO=>({...input(),message:'创建运营标签并预览规则覆盖名单'});
const call=(id:string,name:string,args:unknown={}):ChatCompletionVO=>({message:{content:null,tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(args)}}]}});
const final=(factIds:string[]=[]):ChatCompletionVO=>({message:{content:JSON.stringify({summary:'依据所选范围完成分析',factIds,hypotheses:['具体原因尚未验证'],recommendations:['核查签到记录'],limitations:['仅针对当前数据范围']})}});
const dialogue=(kind:'conversation'|'clarification'|'analysis'|'action',summary:string,extra:Record<string,unknown>={}):ChatCompletionVO=>({message:{content:JSON.stringify({kind,summary,factIds:[],hypotheses:[],recommendations:[],limitations:[],...extra})}});
const clone=<T>(value:T):T=>structuredClone(value);
function memoryRepository(deadlineMs=120000){
  const records=new Map<string,{stored:StoredAgentRun;hash:string;key:string;owner:string}>(),messages:AgentMessageVO[]=[],sessions=new Map<string,AgentSessionVO>();
  const owner=(a:AgentActor)=>a.organizationId+':'+a.userId;
  const find=(a:AgentActor,id:string)=>{const r=records.get(id);if(!r||r.owner!==owner(a))throw new AgentError('NOT_FOUND','无权访问',404);return r;};
  const repository:AgentRepository={
    getTaskState:vi.fn(async(_a,id)=>{const s=sessions.get(id);if(!s)throw new AgentError('NOT_FOUND','会话不存在',404);return clone(readTaskState(s.taskState,{datasetId:s.datasetId,scope:s.scope},s.updatedAt));}),
    prepare:vi.fn(async(a,data,hash,resolved,_memoryInput)=>{
      const old=[...records.values()].find(r=>r.key===data.requestKey&&r.owner===owner(a));
      if(old){if(old.hash!==hash)throw new AgentError('REQUEST_KEY_CONFLICT','请求编号冲突',409);return {execution:clone(old.stored),reused:true};}
      const now=new Date().toISOString(),id=randomUUID();
      let session:AgentSessionVO|undefined=data.sessionId?sessions.get(data.sessionId):{id:randomUUID(),title:data.message,datasetId:data.datasetId!,scope:resolved!,createdBy:a.userId,editable:true,createdAt:now,updatedAt:now};
      if(!session)throw new AgentError('NOT_FOUND','会话不存在',404);
      if(resolved&&data.sessionId)session={...session,scope:resolved,datasetId:data.datasetId??session.datasetId};
      const context={datasetId:session.datasetId,scope:session.scope},currentTask=readTaskState(session.taskState,context,now);
      session={...session,taskState:prepareTaskState(currentTask,context,taskMemoryInput(data.message,currentTask),now)};
      sessions.set(session.id,session);
      const stored:StoredAgentRun={session,run:{id,sessionId:session.id,status:'running',steps:[{id:'context',tool:'resolve_context',status:'completed',evidence:[],context,runtime:{engineVersion:'business-agent-v3',model:'fixture',promptVersion:'fixture',recordedAt:now,taskMemory:clone(session.taskState)}}],proposals:[],evidence:[],answer:null,errorCode:null,errorMessage:null,startedAt:now,completedAt:null,context},message:data.message,deadlineAt:new Date(Date.now()+deadlineMs).toISOString()};
      records.set(id,{stored:clone(stored),hash,key:data.requestKey,owner:owner(a)});
      messages.push({id:randomUUID(),sessionId:session.id,runId:id,role:'user',content:data.message,createdAt:now});return {execution:stored,reused:false};
    }),
    save:vi.fn(async(a,run)=>{find(a,run.id).stored.run=clone(run);}),
    finish:vi.fn(async(a,run,expected=['running'],update)=>{const record=find(a,run.id);if(!expected.includes(record.stored.run.status))return false;record.stored.run=clone(run);const s=sessions.get(run.sessionId);if(s&&update&&s.taskState?.revision===update.expectedRevision&&['completed','awaiting_confirmation'].includes(run.status)&&!run.recoveryOf){s.taskState={...clone(update.state),revision:update.expectedRevision+1,updatedAt:new Date().toISOString()};sessions.set(s.id,s);}return true;}),
    getRun:vi.fn(async(a,id)=>clone(find(a,id).stored)),
    listSessions:vi.fn(async()=>[...sessions.values()]),
    getSession:vi.fn(async(a,id)=>({session:sessions.get(id)!,messages:messages.filter(m=>m.sessionId===id),runs:[...records.values()].filter(r=>r.owner===owner(a)&&r.stored.session.id===id).map(r=>clone(r.stored.run))})),
    history:vi.fn(async(_,id)=>messages.filter(m=>m.sessionId===id)),
  };
  return {repository,records,messages};
}
function harness(responses:Array<ChatCompletionVO|Error>,options:{configured?:boolean;deadlineMs?:number}={}){
  const memory=memoryRepository(options.deadlineMs),captured:ChatMessage[][]=[];
  let current:RiskProposalVO={id:proposalId,datasetId:dataset,name:'出勤风险',scope,rule:{type:'absence_count',minimumAbsences:2,minimumDue:3},version:1,status:'draft',preview:null,publishedTagId:null,createdAt:'',updatedAt:''};
  const preview={token,fingerprint:'a'.repeat(64),memberCount:2,evidence:[evidence],observedCount:5,unknownStudentCount:1,scope,members:[{displayName:'SECRET_STUDENT'}]} as unknown as RiskPreviewVO;
  const metrics=vi.fn(async()=>({dataset:{id:dataset,name:'测试数据',origin:'simulated'},scope,metrics:[{code:'attendance_rate',value:80,numerator:8,denominator:10,scope,evidence:[evidence],status:'ready',reason:'测试',unknownCount:0,details:{}}],trend:[],breakdown:[],riskStudents:[{studentId:'private',displayName:'SECRET_STUDENT',absent:2,leave:0,unknown:0}],batches:[]} as OperationalAnalysis));
  const tags={list:vi.fn(async()=>[current]),get:vi.fn(async()=>clone(current)),create:vi.fn(async()=>clone(current)),preview:vi.fn(async()=>{current={...current,status:'awaiting_confirmation',preview};return clone(current);})};
  const knowledge={search:vi.fn<KnowledgeService['search']>(async()=>({status:'ready' as const,message:'已查询',data:{query:'口径',hits:[{id:'hit',sourceId:'source',logicalSourceId:'logical',version:'1',title:'口径',kind:'definition',text:'仅使用逐课签到计算',similarity:0.9,evidence:{...evidence,kind:'knowledge' as const}}]}}))};
  const breakdown=vi.fn(async()=>[{id:'course-a',name:'课程甲',analysis:clone(await metrics.mock.results.at(-1)!.value)}]);
  const registry=createAgentToolRegistry({metrics:{query:metrics,breakdown},tags,profiles:{list:vi.fn(async()=>[]),query:vi.fn()},knowledge});
  const chat=vi.fn(async(messages:ChatMessage[],_tools:unknown[]=[],_options?:{signal?:AbortSignal;json?:boolean})=>{captured.push(clone(messages));const response=responses.shift();if(response instanceof Error)throw response;if(!response)throw Error('mock responses exhausted');return response;});
  const confirmTag=vi.fn(async()=>{current={...current,status:'published',publishedTagId:randomUUID()};return clone(current);});
  const datasetScope=vi.fn(async()=>scope);
  const service=new AgentApplicationService({repository:memory.repository,registry,model:{chat},configured:()=>options.configured??true,datasetScope,confirmTag,getTag:tags.get});
  return {service,chat,metrics,breakdown,tags,knowledge,registry,captured,confirmTag,datasetScope,...memory};
}

describe('模型暂时异常的受控恢复',()=>{
 const busy=(status=503)=>new ModelServiceError('模型服务暂时异常','MODEL_HTTP',{httpStatus:status});
 const runtime=(run:AgentRunVO|null|undefined)=>run?.steps.find(step=>step.id==='context')?.runtime;
 it.each([502,503,504])('HTTP %s最多恢复一次，等待状态及每次实际模型输入均持久化',async status=>{
  vi.useFakeTimers();
  try{
   const h=harness([busy(status),dialogue('conversation','可以查看当前数据来源')]),pending=h.service.run(input(),actor);
   await vi.advanceTimersByTimeAsync(0);
   const waiting=[...h.records.values()][0].stored.run;
   expect(runtime(waiting)?.recovery).toMatchObject({status:'waiting',httpStatus:status,round:1});
   expect(runtime(waiting)?.recovery?.retryAt).toBe(new Date(Date.now()+1000).toISOString());
   expect(h.chat).toHaveBeenCalledTimes(1);
   await vi.advanceTimersByTimeAsync(1000);
   const result=await pending;
   expect(result.data?.status).toBe('completed');expect(h.chat).toHaveBeenCalledTimes(2);
   expect(runtime(result.data)?.recovery).toMatchObject({status:'recovered',httpStatus:status,round:1});
   expect(runtime(result.data)?.input?.rounds.map(round=>round.round)).toEqual([0,1]);
   expect(runtime(result.data)?.input?.rounds[1].messages).toEqual([]);
   expect(runtime(result.data)?.input?.rounds[1].retryOfRound).toBe(0);
   expect(runtime(result.data)?.input?.rounds[1].usesTools).toBe(runtime(result.data)?.input?.rounds[0].usesTools);
   expect(runtime(result.data)?.input?.rounds[1].json).toBe(runtime(result.data)?.input?.rounds[0].json);
   expect(h.captured[1]).toEqual(h.captured[0]);
   expect(result.data?.steps.map(step=>step.tool)).toEqual(['resolve_context']);
  }finally{vi.useRealTimers();}
 });
 it('首个请求连续503仅调用两次，不生成不存在的事实',async()=>{
  vi.useFakeTimers();
  try{
   const h=harness([busy(),busy(),dialogue('conversation','不应再次调用')]),pending=h.service.run(input(),actor);
   await vi.advanceTimersByTimeAsync(1000);const result=await pending;
   expect(result.data?.errorCode).toBe('MODEL_HTTP');expect(h.chat).toHaveBeenCalledTimes(2);expect(h.metrics).not.toHaveBeenCalled();
   expect(result.data?.answer).toBeNull();expect(runtime(result.data)?.recovery?.status).toBe('failed');expect(runtime(result.data)?.input?.rounds).toHaveLength(2);
  }finally{vi.useRealTimers();}
 });
 it('查询后连续503仅重试模型一次，失败时保留真正取得的事实',async()=>{
  vi.useFakeTimers();
  try{
   const h=harness([call('metric','query_metrics'),busy(),busy(),dialogue('conversation','不应再次调用')]),pending=h.service.run(input(),actor);
   await vi.advanceTimersByTimeAsync(1000);
   const result=await pending;
   expect(result.data?.status).toBe('failed');expect(result.data?.errorCode).toBe('MODEL_HTTP');
   expect(h.chat).toHaveBeenCalledTimes(3);expect(h.metrics).toHaveBeenCalledTimes(1);
   expect(result.data?.answer?.facts[0].value).toBe(80);
   expect(runtime(result.data)?.recovery).toMatchObject({status:'failed',httpStatus:503,round:2});
   expect(runtime(result.data)?.input?.rounds).toHaveLength(3);
  }finally{vi.useRealTimers();}
 });
 it.each([400,401,402,403,404,429])('HTTP %s不自动恢复',async status=>{
  const h=harness([busy(status),dialogue('conversation','不应调用')]),result=await h.service.run(input(),actor);
  expect(result.data?.errorCode).toBe('MODEL_HTTP');expect(h.chat).toHaveBeenCalledTimes(1);expect(runtime(result.data)?.recovery).toBeUndefined();
 });
 it('网络或格式错误不进入HTTP恢复机制',async()=>{
  for(const code of ['MODEL_NETWORK','INVALID_JSON','INVALID_CHAT']){
   const h=harness([new ModelServiceError('未完成请求',code),dialogue('conversation','不应调用')]),result=await h.service.run(input(),actor);
   expect(result.data?.errorCode).toBe(code);expect(h.chat).toHaveBeenCalledTimes(1);expect(runtime(result.data)?.recovery).toBeUndefined();
  }
 });
 it('恢复等待期间可以取消，取消后不再发出模型请求',async()=>{
  vi.useFakeTimers();
  const controller=new AbortController(),controllerSpy=vi.spyOn(globalThis,'AbortController').mockImplementation(function(){return controller;});
  try{
   const h=harness([busy(),dialogue('conversation','不应调用')]),pending=h.service.run(input(),actor);
   await vi.advanceTimersByTimeAsync(0);expect(h.chat).toHaveBeenCalledTimes(1);
   controller.abort();await vi.advanceTimersByTimeAsync(1000);
   const result=await pending;
   expect(result.data?.errorCode).toBe('EXECUTION_TIMEOUT');expect(h.chat).toHaveBeenCalledTimes(1);
   expect(runtime(result.data)?.recovery?.status).toBe('failed');
  }finally{controllerSpy.mockRestore();vi.useRealTimers();}
 });
 it('草稿已经写入后遇到503，仅重发模型请求，不重复写草稿或预览',async()=>{
  vi.useFakeTimers();
  try{
   const h=harness([call('draft','propose_tag',{name:'出勤风险',rule:{type:'absence_count',minimumAbsences:2,minimumDue:3}}),busy(),call('preview','preview_tag_rule',{proposalId,version:1}),dialogue('action','已完成草稿和预览，请核对后在页面发布')]),pending=h.service.run(tagInput(),actor);
   await vi.advanceTimersByTimeAsync(1000);const result=await pending;
   expect(result.data?.status).toBe('awaiting_confirmation');expect(h.tags.create).toHaveBeenCalledTimes(1);expect(h.tags.preview).toHaveBeenCalledTimes(1);expect(h.confirmTag).not.toHaveBeenCalled();
   expect(h.chat).toHaveBeenCalledTimes(4);expect(result.data?.steps.map(step=>step.tool)).toEqual(['resolve_context','propose_tag','preview_tag_rule']);
   expect(h.captured[2]).toEqual(h.captured[1]);
  }finally{vi.useRealTimers();}
 });
 it('恢复请求计入六次实际调用预算，最后一次为无工具的回答请求',async()=>{
  vi.useFakeTimers();
  try{
   const h=harness([busy(),call('metric1','query_metrics'),call('metric2','query_metrics'),call('metric3','query_metrics'),call('metric4','query_metrics'),final(['metric4:attendance_rate'])]),pending=h.service.run(input(),actor);
   await vi.advanceTimersByTimeAsync(1000);const result=await pending;
   expect(result.data?.status).toBe('completed');expect(h.chat).toHaveBeenCalledTimes(6);expect(h.metrics).toHaveBeenCalledTimes(4);
   expect(h.chat.mock.calls.at(-1)?.[1]).toEqual([]);expect(h.chat.mock.calls.at(-1)?.[2]?.json).toBe(true);
   expect(runtime(result.data)?.input?.rounds.map(round=>round.round)).toEqual([0,1,2,3,4,5]);
  }finally{vi.useRealTimers();}
 });
 it('第五次带工具请求失败时不占用最后的回答预算重试',async()=>{
  const h=harness([...Array.from({length:4},(_,index)=>call('metric'+index,'query_metrics')),busy(),call('unexpected','propose_tag',{name:'不应创建',rule:{type:'absence_count',minimumAbsences:2,minimumDue:3}})]),result=await h.service.run(input(),actor);
  expect(result.data?.errorCode).toBe('MODEL_HTTP');expect(h.chat).toHaveBeenCalledTimes(5);expect(h.metrics).toHaveBeenCalledTimes(4);
  expect(h.tags.create).not.toHaveBeenCalled();expect(runtime(result.data)?.recovery).toBeUndefined();
 });
 it('第六次调用失败或剩余总时限不足时不追加恢复请求',async()=>{
  const h=harness([...Array.from({length:5},(_,index)=>call('metric'+index,'query_metrics')),busy(),dialogue('conversation','超预算')]),result=await h.service.run(input(),actor);
  expect(result.data?.errorCode).toBe('MODEL_HTTP');expect(h.chat).toHaveBeenCalledTimes(6);expect(runtime(result.data)?.recovery).toBeUndefined();
  const ending=harness([busy(),dialogue('conversation','超时限')],{deadlineMs:500}),expired=await ending.service.run(input(),actor);
  expect(expired.data?.errorCode).toBe('MODEL_HTTP');expect(ending.chat).toHaveBeenCalledTimes(1);expect(runtime(expired.data)?.recovery).toBeUndefined();
 });
 it('同一运行恢复成功后再遇503，不获得第二次恢复机会',async()=>{
  vi.useFakeTimers();
  try{
   const h=harness([busy(),call('metric','query_metrics'),busy(),dialogue('conversation','不应调用')]),pending=h.service.run(input(),actor);
   await vi.advanceTimersByTimeAsync(1000);const result=await pending;
   expect(result.data?.errorCode).toBe('MODEL_HTTP');expect(h.chat).toHaveBeenCalledTimes(3);expect(h.metrics).toHaveBeenCalledTimes(1);
   expect(runtime(result.data)?.input?.rounds).toHaveLength(3);
  }finally{vi.useRealTimers();}
 });
});

describe('公开学习Agent范围与工具边界',()=>{
 const learningScope={organizationId:org,courseKeys:['AAA:2013J'],relativeDayStart:-20,relativeDayEnd:100};
 const learningInput=()=>({message:'分析学习情况',requestKey:randomUUID(),datasetId:dataset,learningScope:{courseKeys:['AAA:2013J'],relativeDayStart:-20,relativeDayEnd:100}});
 const setup=(responses:ChatCompletionVO[])=>{
  const h=harness(responses),query=vi.fn(async()=>({dataset:{id:dataset,name:'公开数据',origin:'public'},scope:learningScope,metrics:[{code:'activity_count',label:'学习活动记录数',value:100,unit:'条',status:'ready'}],trend:[],courses:[],resources:[],scores:[],outcomes:[],completeness:[],evidence:[{...evidence,scope:undefined,learningScope}],batches:[],relativeDayBounds:{min:-20,max:100}} as LearningAnalysis));
  const learningRegistry=createLearningToolRegistry({learning:{query},knowledge:{search:vi.fn(async()=>({status:'ready' as const,message:'没有知识命中',data:{query:'学习口径',hits:[]}}))}});
  const service=new AgentApplicationService({repository:h.repository,registry:h.registry,learningRegistry,model:{chat:h.chat},configured:()=>true,datasetScope:async()=>scope,learningDatasetScope:async()=>learningScope,confirmTag:h.confirmTag,getTag:h.tags.get});return {...h,service,query};
 };
 it('请求模式互斥，已有会话可明确提交新学习范围',()=>{expect(agentRunInputSchema.safeParse({...learningInput(),scope:input().scope}).success).toBe(false);expect(agentRunInputSchema.safeParse({...learningInput(),sessionId:randomUUID()}).success).toBe(true);expect(agentRunInputSchema.safeParse(learningInput()).success).toBe(true);});
 it('只将学习查询、知识检索和受控组选择交给模型，事实数值由业务工具返回',async()=>{const h=setup([call('learn','query_learning_metrics'),call('rag','search_knowledge',{query:'学习口径'}),final(['learn:activity_count'])]),result=await h.service.run(learningInput(),actor);expect(result.data?.status).toBe('completed');expect(result.data?.answer?.facts[0].value).toBe(100);expect(h.query).toHaveBeenCalledWith(dataset,learningScope);expect(h.metrics).not.toHaveBeenCalled();expect(h.tags.create).not.toHaveBeenCalled();expect(h.chat.mock.calls[0][1].map((t:any)=>t.function.name)).toEqual(['query_learning_metrics','search_knowledge','select_task_tools']);expect(h.chat.mock.calls.at(-1)?.[1].map((t:any)=>t.function.name)).toEqual(['query_learning_metrics','search_knowledge','select_task_tools']);const lastPrompt=h.captured.at(-1)!.at(-1)!.content!;expect(lastPrompt).toContain('["learn:activity_count"]');expect(lastPrompt).toContain('知识检索的hit.id、evidence.id、sourceId');});
 it('即使模型请求经营写入或查询工具也拒绝执行',async()=>{for(const name of ['propose_tag','preview_tag_rule','query_metrics','publish_tag']){const h=setup([call('attack',name,{})]);expect((await h.service.run(learningInput(),actor)).data?.errorCode).toBe('UNKNOWN_TOOL');expect(h.tags.create).not.toHaveBeenCalled();expect(h.metrics).not.toHaveBeenCalled();}});
 it('不能通过学习工具参数扩大机构、数据集、课程或提交SQL；参数错误可澄清恢复',async()=>{for(const args of [{organizationId:'forged'},{datasetId:randomUUID()},{courseKeys:[]},{sql:'SELECT *'}]){const h=setup([call('attack','query_learning_metrics',args),dialogue('clarification','请通过范围设置选择课程批次')]),result=await h.service.run(learningInput(),actor);expect(result.data?.steps.find(s=>s.tool==='query_learning_metrics')?.errorCode).toBe('INVALID_ARGUMENTS');expect(result.data?.status).toBe('completed');expect(h.query).not.toHaveBeenCalled();}});
 it('仅检索知识不能冒充已核对学习数字',async()=>{const h=setup([call('rag','search_knowledge',{query:'学习口径'}),final(),final()]);expect((await h.service.run(learningInput(),actor)).data?.errorCode).toBe('NO_EVIDENCE');expect(h.query).not.toHaveBeenCalled();});
 it('已有学习会话保留固定相对日且重复请求复用结果',async()=>{const h=setup([call('learn','query_learning_metrics'),final(['learn:activity_count']),call('next','query_learning_metrics'),final(['next:activity_count'])]),firstInput=learningInput(),first=(await h.service.run(firstInput,actor)).data!;expect((await h.service.run(firstInput,actor)).data?.id).toBe(first.id);const next=await h.service.run({message:'继续分析',requestKey:randomUUID(),sessionId:first.sessionId},actor);expect(next.data?.status).toBe('completed');expect(h.query).toHaveBeenCalledTimes(2);expect(h.query.mock.calls[1][1]).toEqual(learningScope);});
});

describe('受控Agent执行',()=>{
  it('明确课程拆解时先补缺失只读工具，不让首次最终回答冒充已拆解',async()=>{
    const h=harness([call('metric','query_metrics'),dialogue('analysis','课程拆解显示其他课程超过89%。'),call('split','query_metric_breakdown',{dimension:'course',metricCodes:['attendance_rate']}),dialogue('analysis','课程情况已核查，{{label4}}为{{f4}}。')]);
    const result=await h.service.run({...input(),message:'帮我看看当前范围的出勤情况，比较变化并拆解可能受影响的课程。'},actor);
    expect(result.data?.status).toBe('completed');expect(h.metrics).toHaveBeenCalledTimes(1);expect(h.breakdown).toHaveBeenCalledTimes(1);expect(h.chat).toHaveBeenCalledTimes(4);
    expect(h.chat.mock.calls[2][1].some((tool:any)=>tool.function.name==='query_metric_breakdown')).toBe(true);
    expect(h.captured[2].findLast(message=>message.role==='user')?.content).toContain('必要查询尚未完成');expect(result.data?.answer?.summary).not.toContain('89');
  });
  it('连续忽略必要课程查询时保持失败并只展示程序事实，不能仅解读补成成功',async()=>{
    const h=harness([call('metric','query_metrics'),dialogue('analysis','课程拆解已完成，其他课程超过89%。'),dialogue('analysis','课程拆解已完成。'),dialogue('analysis','课程拆解已完成。')]);
    const result=await h.service.run({...input(),message:'按课程拆解出勤情况'},actor),run=result.data!;
    expect(result.status).toBe('error');expect(run.status).toBe('failed');expect(run.errorCode).toBe('INCOMPLETE_ANALYSIS');expect(run.answer?.partial).toMatchObject({kind:'facts_only',missingTools:['query_metric_breakdown:course']});
    expect(run.answer?.facts).toHaveLength(3);expect(run.answer?.summary).not.toContain('89');expect(run.answer?.summary).not.toContain('课程拆解已完成');expect(run.answer?.hypotheses).toEqual([]);expect(run.answer?.recommendations).toEqual([]);
    expect(run.recoveryEligibility?.eligible).toBe(false);expect(h.metrics).toHaveBeenCalledTimes(1);expect(h.tags.create).not.toHaveBeenCalled();
  });
  it('一次诊断全部未绑定数字字段，唯一修正轮无需重执行查询',async()=>{
    const bad={kind:'analysis',summary:'评审场景20261009有数据',factIds:['metric:attendance_rate'],hypotheses:['具体原因待验证','有26条客诉及15条退款需核查'],recommendations:['核对80人的名单'],limitations:['仅对当前范围有效','观察窗口为30天'],questions:[{id:'next',prompt:'需要核对20人的情况吗',options:[{label:'查看10人',value:'查看12人'}]}]};
    const expected=['summary','hypotheses.1','recommendations.0','limitations.1','questions.0.prompt','questions.0.options.0.label','questions.0.options.0.value'];
    let failure:unknown;
    try{buildConversationalAnswer(JSON.stringify({...bad,factIds:[]}),[],{datasetId:dataset,scope});}catch(error){failure=error;}
    expect(failure).toBeInstanceOf(ConversationalNumberError);expect(failure).toMatchObject({code:'UNVERIFIED_NUMBER',field:'summary',fields:expected});
    const h=harness([call('metric','query_metrics'),{message:{content:JSON.stringify(bad)}},dialogue('analysis','当前数据集已有查询结果，请查看关键事实卡',{factIds:['metric:attendance_rate'],recommendations:['核对异常记录']})]),result=await h.service.run(input(),actor);
    expect(result.data?.status).toBe('completed');expect(h.chat).toHaveBeenCalledTimes(3);expect(h.metrics).toHaveBeenCalledTimes(1);
    const repair=h.captured.at(-1)!.findLast(message=>message.role==='user')!.content!;
    for(const path of expected)expect(repair).toContain(path);
    expect(repair).toContain('当前数据集');expect(repair).toContain('不能换成汉字数量规避校验');expect(repair).toContain('factIds');
    expect(repair).not.toContain('20261009');expect(repair).not.toContain('26条');expect(h.chat.mock.calls.at(-1)?.[1]).toEqual([]);
  });
  it.each(['覆盖26人','覆盖二十六人','当前数据集20261009','出勤率８０％'])('多字段诊断仍拒绝原样或改用汉字的未核验数字：%s',summary=>{
    expect(()=>buildConversationalAnswer(JSON.stringify({kind:'conversation',summary,factIds:[],hypotheses:[],recommendations:[],limitations:[]}),[],{datasetId:dataset,scope})).toThrow(ConversationalNumberError);
  });
  it('格式修正说明明确字段类型与条目上限，仅传安全路径且不重执行工具',async()=>{
    const invalid={message:{content:JSON.stringify({summary:'依据查询解释',factIds:['metric:attendance_rate'],hypotheses:Array(9).fill('原因尚未验证'),recommendations:[{action:'SECRET_PAYLOAD'}],limitations:[]})}};
    const h=harness([call('metric','query_metrics'),invalid,final(['metric:attendance_rate'])]),result=await h.service.run(input(),actor);
    expect(result.data?.status).toBe('completed');expect(h.metrics).toHaveBeenCalledTimes(1);
    const repair=h.captured.at(-1)!.findLast(message=>message.role==='user')!.content!;
    expect(repair).toContain('INVALID_ANSWER');expect(repair).toContain('最多8项');expect(repair).toContain('最多80项');expect(repair).not.toContain('SECRET_PAYLOAD');expect(h.chat.mock.calls.at(-1)?.[1]).toEqual([]);
  });
  it('普通指导缺少空数组时定向说明全部缺失路径，保持严格格式且不查询业务',async()=>{
    const invalid={message:{content:JSON.stringify({kind:'conversation',summary:'在标签与人群里设置规则，先预览名单再确认。'})}};
    const h=harness([invalid,dialogue('conversation','进入标签与人群，设置规则后先预览名单。')]);
    expect((await h.service.run({...input(),message:'怎么创建人群？'},actor)).data?.status).toBe('completed');
    const repair=h.captured.at(-1)!.findLast(message=>message.role==='user')!.content!;
    for(const key of ['factIds','hypotheses','recommendations','limitations'])expect(repair).toContain('"path":"'+key+'"');
    expect(repair).toContain('不能只返回kind和summary');expect(h.metrics).not.toHaveBeenCalled();expect(h.chat).toHaveBeenCalledTimes(2);
  });
  it('草稿版本与含数字名称只能用程序提供的绑定，仍拒绝直接抄写版本',()=>{
    const p={id:proposalId,name:'出勤80关注',version:3,rule:{type:'attendance_below',thresholdPercent:80,minimumDue:4}} as AgentRunVO['proposals'][number];
    const raw={kind:'action',summary:'草稿{{rule:'+proposalId+':name}}，版本v{{rule:'+proposalId+':version}}，请在卡片核对。',factIds:[],hypotheses:[],recommendations:[],limitations:[]};
    expect(buildConversationalAnswer(JSON.stringify(raw),[],{datasetId:dataset,scope},[p]).summary).toBe('草稿出勤80关注，版本v3，请在卡片核对。');
    expect(()=>buildConversationalAnswer(JSON.stringify({...raw,summary:'草稿版本v3已准备。'}),[],{datasetId:dataset,scope},[p])).toThrow(ConversationalNumberError);
  });
  it('未核验数字仅在剩余轮数内修正一次，不重新执行工具或改变事实',async()=>{
    const invalid={message:{content:JSON.stringify({summary:'覆盖99人',factIds:['metric:attendance_rate'],hypotheses:[],recommendations:[],limitations:[]})}};
    const h=harness([call('metric','query_metrics'),invalid,final(['metric:attendance_rate'])]),result=await h.service.run(input(),actor);
    expect(result.data?.status).toBe('completed');expect(result.data?.answer?.facts[0].value).toBe(80);expect(h.metrics).toHaveBeenCalledTimes(1);expect(h.chat).toHaveBeenCalledTimes(3);expect(h.chat.mock.calls.at(-1)?.[1]).toEqual([]);
  });
  it('修正阶段仍调用写工具或再次输出未核验数字时明确失败',async()=>{
    const invalid={message:{content:JSON.stringify({summary:'覆盖99人',factIds:[],hypotheses:[],recommendations:[],limitations:[]})}};
    const h=harness([call('metric','query_metrics'),invalid,call('write','propose_tag',{name:'不应写入',rule:{type:'renewal_due',withinDays:30}})]),result=await h.service.run(input(),actor);
    expect(result.data?.errorCode).toBe('INVALID_ANSWER');expect(h.tags.create).not.toHaveBeenCalled();
    const twice=harness([call('metric','query_metrics'),invalid,invalid]);expect((await twice.service.run(input(),actor)).data?.errorCode).toBe('UNVERIFIED_NUMBER');expect(twice.chat).toHaveBeenCalledTimes(3);
  });
  it('真实工具事实用于回答，模型上下文不包含成员资料',async()=>{
    const h=harness([call('metric','query_metrics'),final(['metric:attendance_rate'])]),result=await h.service.run(input(),actor);
    expect(result.status).toBe('ready');expect(result.data?.status).toBe('completed');expect(result.data?.answer?.facts[0]).toMatchObject({value:80,numerator:8,denominator:10});
    expect(JSON.stringify(h.captured)).not.toContain('SECRET_STUDENT');expect(h.metrics).toHaveBeenCalledWith(dataset,scope,undefined);
  });
  it('同一执行重复查询保留每个来源版本，事实与模型工具结果引用对应版本',async()=>{
    const h=harness([call('first','query_metrics'),call('updated','query_metrics'),call('repeat','query_metrics'),final(['first:attendance_rate','updated:attendance_rate','repeat:attendance_rate'])]);
    const original=await h.metrics();h.metrics.mockClear();
    const updated={...clone(original),metrics:original.metrics.map(m=>({...m,value:60,numerator:6,evidence:m.evidence.map(e=>({...e,version:'v2'}))}))};
    h.metrics.mockResolvedValueOnce(original).mockResolvedValueOnce(updated).mockResolvedValueOnce(updated);
    const result=await h.service.run(input(),actor),run=result.data!;
    expect(run.status).toBe('completed');
    expect(run.evidence.map(e=>({id:e.id,sourceId:e.sourceId,version:e.version}))).toEqual([{id:dataset+'@v1',sourceId:dataset,version:'v1'},{id:dataset+'@v2',sourceId:dataset,version:'v2'}]);
    expect(run.steps.filter(s=>s.tool==='query_metrics').map(s=>s.facts![0].evidenceIds)).toEqual([[dataset+'@v1'],[dataset+'@v2'],[dataset+'@v2']]);
    expect(run.answer!.facts.map(f=>({value:f.value,evidenceIds:f.evidenceIds}))).toEqual([{value:80,evidenceIds:[dataset+'@v1']},{value:60,evidenceIds:[dataset+'@v2']},{value:60,evidenceIds:[dataset+'@v2']}]);
    const toolMessages=h.captured.at(-1)!.filter(m=>m.role==='tool');
    expect(toolMessages.map(m=>{const payload=JSON.parse(m.content!);return {id:payload.evidence[0].id,metricId:payload.facts.find((fact:any)=>fact.id===payload.result.metrics[0].factId).evidenceIds[0],factId:payload.facts[0].evidenceIds[0]};})).toEqual([
      {id:dataset+'@v1',metricId:dataset+'@v1',factId:dataset+'@v1'},
      {id:dataset+'@v2',metricId:dataset+'@v2',factId:dataset+'@v2'},
      {id:dataset+'@v2',metricId:dataset+'@v2',factId:dataset+'@v2'},
    ]);
    expect(original.metrics[0].evidence[0].id).toBe(dataset);
  });
  it('固定会话范围，拒绝模型伪造机构、数据集和任意SQL',async()=>{
    for(const args of [{organizationId:'forged'},{datasetId:randomUUID()},{sql:'SELECT *'}]){
      const h=harness([call('malicious','query_metrics',args),dialogue('clarification','请在页面选择统计范围')]),result=await h.service.run(input(),actor);
      expect(result.data?.steps.find(s=>s.tool==='query_metrics')?.errorCode).toBe('INVALID_ARGUMENTS');expect(h.metrics).not.toHaveBeenCalled();expect(result.data?.steps.find(s=>s.tool==='query_metrics')?.input).toBeUndefined();
    }
  });
  it('未知或发布工具不会执行',async()=>{
    const h=harness([call('publish','publish_tag')]),result=await h.service.run(input(),actor);
    expect(result.data?.errorCode).toBe('UNKNOWN_TOOL');expect(h.confirmTag).not.toHaveBeenCalled();expect(h.tags.create).not.toHaveBeenCalled();
  });
  it('viewer可查询交流但不可写，缺模型配置不保存伪任务',async()=>{
    const h=harness([dialogue('conversation','可以通过已保存人群查看画像')]);expect((await h.service.run(input(),{...actor,role:'viewer'})).data?.status).toBe('completed');expect(h.chat.mock.calls[0][1].every((t:any)=>!['propose_tag','preview_tag_rule'].includes(t.function.name))).toBe(true);
    const denied=harness([call('write','propose_tag',{name:'不应写入',rule:{type:'renewal_due',withinDays:30}})]);expect((await denied.service.run(input(),{...actor,role:'viewer'})).data?.errorCode).toBe('FORBIDDEN_TOOL');expect(denied.tags.create).not.toHaveBeenCalled();
    const absent=harness([],{configured:false});expect(await absent.service.run(input(),actor)).toMatchObject({status:'unconfigured',data:null});expect(absent.repository.prepare).not.toHaveBeenCalled();
  });
  it('相同请求幂等，参数变化拒绝同一个编号',async()=>{
    const h=harness([call('metric','query_metrics'),final()]),request=input();
    const a=await h.service.run(request,actor),b=await h.service.run(request,actor);expect(a.data?.id).toBe(b.data?.id);expect(h.chat).toHaveBeenCalledTimes(2);expect(h.records.size).toBe(1);expect(h.messages).toHaveLength(1);
    await expect(h.service.run({...request,message:'另一个问题'},actor)).rejects.toMatchObject({code:'REQUEST_KEY_CONFLICT'});
  });
  it('下一条消息沿用服务器保存的范围，跨机构读取被拒绝',async()=>{
    const h=harness([call('first','query_metrics'),final(),call('next','query_metrics'),final()]);const first=await h.service.run(input(),actor);
    const second=await h.service.run({sessionId:first.data!.sessionId,requestKey:randomUUID(),message:'继续核查'},actor);
    expect(second.data?.sessionId).toBe(first.data?.sessionId);expect(h.metrics.mock.calls[1]).toEqual([dataset,scope,undefined]);
    await expect(h.service.getRun({...actor,organizationId:randomUUID()},first.data!.id)).rejects.toMatchObject({status:404});
  });
  it('创建和预览只保存草稿，令牌不发送给模型，人工确认绑定版本',async()=>{
    const h=harness([call('draft','propose_tag',{name:'出勤风险',rule:{type:'absence_count',minimumAbsences:2,minimumDue:3}}),call('preview','preview_tag_rule',{proposalId,version:1}),dialogue('action','草稿已预览，请核对规则并通过页面确认',{factIds:['preview:coverage']})]);
    const result=await h.service.run(tagInput(),actor),run=result.data!;
    expect(run.status).toBe('awaiting_confirmation');expect(run.proposals[0]).toMatchObject({previewToken:token,estimatedCount:2});expect(h.confirmTag).not.toHaveBeenCalled();
    expect(run.proposals[0].evidence[0]).toMatchObject({id:dataset+'@v1',sourceId:dataset,version:'v1'});
    expect(run.steps.find(s=>s.tool==='preview_tag_rule')?.facts![0].evidenceIds).toEqual([dataset+'@v1']);
    expect(h.tags.create.mock.calls[0][3]).toBe(run.id+':draft');expect(JSON.stringify(h.captured)).not.toContain(token);expect(JSON.stringify(h.captured)).not.toContain('SECRET_STUDENT');
    await expect(h.service.confirm({runId:run.id,proposalId,version:2,previewToken:token},actor)).rejects.toMatchObject({code:'STALE_CONFIRMATION'});
    await expect(h.service.confirm({runId:run.id,proposalId,version:1,previewToken:token},{...actor,role:'viewer'})).rejects.toMatchObject({status:403});
    expect(h.confirmTag).not.toHaveBeenCalled();
    const confirmed=await h.service.confirm({runId:run.id,proposalId,version:1,previewToken:token},actor);
    expect(confirmed.status).toBe('completed');expect(h.confirmTag).toHaveBeenCalledWith(org,user,proposalId,1,token);
    expect(confirmed.proposals[0].evidence[0].id).toBe(run.evidence[0].id);
  });
  it('不能预览其他执行的草稿',async()=>{
    const h=harness([call('unlinked','preview_tag_rule',{proposalId,version:1})]),result=await h.service.run({...tagInput(),message:'预览运营标签规则'},actor);
    expect(result.data?.errorCode).toBe('UNLINKED_PROPOSAL');expect(h.tags.preview).not.toHaveBeenCalled();
  });
  it('写工具失败不自动重试，也不输出供应商原始错误',async()=>{
    const h=harness([call('write','propose_tag',{name:'风险',rule:{type:'absence_count',minimumAbsences:2,minimumDue:3}}),dialogue('conversation','草稿保存未完成，请检查服务后重新操作')]);
    h.tags.create.mockRejectedValueOnce(Error('SECRET_TOKEN provider payload'));
    const result=await h.service.run(tagInput(),actor);expect(result.data?.steps.find(s=>s.tool==='propose_tag')?.status).toBe('failed');expect(h.tags.create).toHaveBeenCalledTimes(1);expect(JSON.stringify(result)).not.toContain('SECRET_TOKEN');
  });
  it('工具服务未配置不能被记为成功',async()=>{
    const h=harness([call('search','search_knowledge',{query:'口径'}),dialogue('conversation','向量模型尚未配置，请在业务知识查看已有材料')]);
    h.knowledge.search.mockResolvedValueOnce({status:'unconfigured',message:'向量模型尚未配置',data:null});
    const result=await h.service.run(input(),actor);expect(result.data?.steps.find(s=>s.tool==='search_knowledge')?.errorCode).toBe('TOOL_UNAVAILABLE');expect(result.data?.steps.find(s=>s.tool==='search_knowledge')?.status).toBe('failed');
  });
  it('最多六轮和八次工具调用，不重复执行同一调用编号',async()=>{
    const rounds=harness(Array.from({length:6},(_,i)=>call('round-'+i,'query_profile')));
    expect((await rounds.service.run(input(),actor)).data?.errorCode).toBe('INVALID_ANSWER');expect(rounds.chat).toHaveBeenCalledTimes(6);
    const many=harness([{message:{content:null,tool_calls:Array.from({length:8},(_,i)=>call('tool-'+i,'query_profile').message.tool_calls![0])}},call('ninth','query_profile')]);
    const limit=await many.service.run(input(),actor);expect(limit.data?.errorCode).toBe('TOOL_LIMIT');expect(limit.data?.steps.filter(s=>s.tool!=='resolve_context')).toHaveLength(8);
    const repeated=harness([call('same','query_metrics'),call('same','query_metrics')]);expect((await repeated.service.run(input(),actor)).data?.errorCode).toBe('DUPLICATE_TOOL_CALL');expect(repeated.metrics).toHaveBeenCalledTimes(1);
  });
  it('超时和中断执行保存明确失败状态',async()=>{
    const h=harness([],{deadlineMs:10});h.chat.mockImplementationOnce(()=>new Promise(()=>{}));
    const result=await h.service.run(input(),actor);expect(result.data?.errorCode).toBe('EXECUTION_TIMEOUT');expect(h.repository.finish).toHaveBeenCalled();
    const stored=[...h.records.values()][0].stored;stored.run.status='running';stored.deadlineAt=new Date(Date.now()-1).toISOString();
    expect((await h.service.getRun(actor,stored.run.id)).errorCode).toBe('EXECUTION_EXPIRED');
  });
});
describe('连续业务交流与恢复',()=>{
 it('长对话对象优先保留最近结果，JSON完整且不夹带运行输入或页面长链接',async()=>{
  const h=harness([dialogue('conversation','可以继续提问')]),base=(await h.service.run(input(),actor)).data!;
  const runs=Array.from({length:8},(_,index)=>({...clone(base),id:randomUUID(),answer:{...base.answer!,recommendations:Array(8).fill('核对签到及课程安排'.repeat(180))},actionPlan:{steps:[{kind:'save_segment',status:'completed',result:{id:randomUUID(),label:'查看已保存名单',url:'/dashboard/data/portrait?private='+('PRIVATE_LONG_URL'.repeat(2000))}}]} as unknown as AgentRunVO['actionPlan']}));
  const text=summarizedConversationObjects(runs,{datasetId:dataset,scope}),objects=JSON.parse(text);
  expect(text.length).toBeLessThanOrEqual(16000);expect(objects[0].runId).toBe(runs.at(-1)!.id);expect(objects[0].actions[0].result.id).toBe(runs.at(-1)!.actionPlan!.steps[0].result!.id);expect(text).not.toContain('PRIVATE_LONG_URL');expect(text).not.toContain('runtime');
 });
 it('数字修正定位实际建议字段并提供可信规则参数，避免只修改摘要',async()=>{
  const h=harness([call('draft','propose_tag',{name:'出勤',rule:{type:'absence_count',minimumAbsences:2,minimumDue:3}}),dialogue('action','草稿已保存',{recommendations:['确认前核对至少缺勤2次的规则']}),dialogue('action','草稿已保存',{recommendations:['核对规则后预览']})]);
  const result=(await h.service.run(tagInput(),actor)).data!;
  expect(result.status).toBe('awaiting_confirmation');
  const repair=h.captured.at(-1)!.findLast(m=>m.role==='user'&&m.content?.includes('回答校验未通过'))!.content!;expect(repair).toContain('recommendations.0');expect(repair).toContain('{{rule:'+proposalId+':minimumAbsences}}');expect(repair).not.toContain('SECRET_STUDENT');
 });
 it('同轮切换范围后失败只展示新范围事实，旧步骤仍可追溯',async()=>{
  const nextScope={...scope,startDate:'2026-07-01',endDate:'2026-07-31'},h=harness([call('old','query_metrics'),call('change','change_analysis_scope',{scope:{startDate:nextScope.startDate,endDate:nextScope.endDate,campusIds:[],courseIds:[],channelIds:[],dataCutoff:nextScope.dataCutoff}}),call('new','query_metrics'),call('unknown','unknown_tool')]);
  registerScopeTools(h.registry,'operations',async()=>({}));h.datasetScope.mockResolvedValueOnce(scope).mockResolvedValueOnce(nextScope);
  const result=(await h.service.run(input(),actor)).data!;
  expect(result.status).toBe('failed');expect(result.context?.scope.startDate).toBe(nextScope.startDate);
  expect(result.answer?.facts.every(f=>f.id.startsWith('new:'))).toBe(true);
  expect(result.steps.find(s=>s.id==='old')?.facts?.[0].id).toBe('old:attendance_rate');expect(result.steps.find(s=>s.id==='old')?.context?.scope).toEqual(scope);
 });
 it('写工具参数校验未执行时可纠正，已开始的写失败仍不自动重试',async()=>{
  const h=harness([call('invalid','propose_tag',{name:'出勤',rule:{type:'all',conditions:[{type:'attendance_below',thresholdPercent:80,minimumDue:4}]}}),call('corrected','propose_tag',{name:'出勤',rule:{type:'attendance_below',thresholdPercent:80,minimumDue:4}}),dialogue('action','草稿已保存，下一步预览')]);
  const result=(await h.service.run(tagInput(),actor)).data!;
  expect(result.status).toBe('awaiting_confirmation');expect(h.tags.create).toHaveBeenCalledTimes(1);
  expect(result.steps.find(s=>s.id==='invalid')?.errorCode).toBe('INVALID_ARGUMENTS');
  const failedTool=JSON.parse(h.captured[1].find(m=>m.role==='tool')!.content!);expect(failedTool).toMatchObject({operationAttempted:false,mayCorrectArguments:true});
 });
 it('出勤变化使用程序冻结的对比结果和两期证据，不由模型计算差值',async()=>{
  const h=harness([call('read','query_metrics'),dialogue('analysis','对比期{{fact:read:comparison:period}}出勤为{{fact:read:previous:attendance_rate}}，本期变化{{fact:read:change:attendance_rate}}。')]);
  const current=await h.metrics();h.metrics.mockClear();
  const previousScope={...scope,startDate:'2026-07-01',endDate:'2026-07-31'};
  const prior={...current.metrics[0],value:90,numerator:9,scope:previousScope,evidence:[{...evidence,version:'prior',scope:previousScope}]};
  h.metrics.mockResolvedValue({...current,comparison:{scope:previousScope,metrics:[prior],changes:[{code:'attendance_rate',change:-10,unit:'个百分点',reason:''}]}});
  const result=(await h.service.run(input(),actor)).data!;
  expect(result.status).toBe('completed');expect(result.answer?.summary).toContain('2026-07-01 至 2026-07-31');expect(result.answer?.summary).toContain('-10个百分点');
  expect(result.answer?.facts.find(f=>f.id==='read:change:attendance_rate')?.evidenceIds).toEqual([dataset+'@v1',dataset+'@prior']);
  const tool=JSON.parse(h.captured.at(-1)!.find(m=>m.role==='tool')!.content!);expect(tool.facts.find((fact:any)=>fact.id===tool.result.comparison.metrics[0].factId).value).toBe(90);expect(tool.result.comparison.metrics[0].value).toBeUndefined();expect(tool.result.riskStudents).toBeUndefined();
 });
 it('操作步骤和一次确认可正常交流，未查询的经营数量仍拒绝',async()=>{
  const h=harness([dialogue('conversation','1. 打开标签与人群\n2. 设置规则并预览\n第3步核对一张确认卡，一次确认后查看结果。操作：1）预览；2）核对；3）确认。')]);
  expect((await h.service.run(input(),actor)).data?.answer?.summary).toContain('一次确认');
  for(const summary of ['发生一次退款','覆盖12人','退款2026元']){
   const blocked=harness([dialogue('conversation',summary),dialogue('conversation',summary)]);
   expect((await blocked.service.run(input(),actor)).data?.errorCode).toBe('UNVERIFIED_NUMBER');
  }
 });
 it('澄清中的候选周期可选择，不允许伪造当前范围或覆盖人数',async()=>{
  const h=harness([dialogue('clarification','请选择希望分析的周期',{questions:[{id:'period',prompt:'是否扩大到近3个月？',options:[{label:'扩到近3个月再对比',value:'last_3_months'}]}]})]);
  expect((await h.service.run(input(),actor)).data?.answer?.questions?.[0].options?.[0].value).toBe('扩到近3个月再对比');
  for(const text of ['当前范围是近3个月','覆盖200人，是否继续？']){
   const invalid=dialogue('clarification',text),blocked=harness([invalid,invalid]);
   expect((await blocked.service.run(input(),actor)).data?.errorCode).toBe('UNVERIFIED_NUMBER');
  }
 });
 it('允许引用实际存在的建议序号，拒绝超出本次建议列表的序号',async()=>{
  const recommendations=['核实签到和课程安排'];
  const h=harness([dialogue('conversation','下一步按建议第 1 项安排跟进',{recommendations})]);
  expect((await h.service.run(input(),actor)).data?.status).toBe('completed');
  const invalid=dialogue('conversation','按第2项建议执行',{recommendations}),blocked=harness([invalid,invalid]);
  expect((await blocked.service.run(input(),actor)).data?.errorCode).toBe('UNVERIFIED_NUMBER');
 });
 it('操作指导和普通交流不强制查询数据库或检索知识',async()=>{
  const h=harness([dialogue('conversation','在标签与人群打开标签规则，先设置条件，再预览名单，核对后发布。')]);
  const result=await h.service.run({...input(),message:'怎么创建人群？'},actor);expect(result.data?.status).toBe('completed');expect(result.data?.answer?.kind).toBe('conversation');expect(h.metrics).not.toHaveBeenCalled();expect(h.tags.create).not.toHaveBeenCalled();expect(result.data?.steps.filter(s=>s.tool!=='resolve_context')).toEqual([]);
 });
 it('模型请求按真实增量输入记录，重建每轮请求与实际调用一致',async()=>{
  const h=harness([call('read','query_metrics'),dialogue('analysis','依据程序事实完成分析',{factIds:['read:attendance_rate']})]);
  const result=await h.service.run(input(),actor),runtime=result.data?.steps.find(s=>s.id==='context')?.runtime;expect(runtime?.engineVersion).toBe('business-agent-v3');expect(runtime?.input?.rounds).toHaveLength(2);
  const reconstructed:unknown[]=[];for(const [index,round] of runtime!.input!.rounds.entries()){reconstructed.push(...round.messages);expect(reconstructed).toEqual(h.captured[index]);}expect(runtime?.input?.tools.length).toBeGreaterThan(0);expect(runtime?.input?.rounds.every(r=>r.usesTools)).toBe(true);
 });
 it('对象有歧义时保留明确选项，不通过猜测执行写入',async()=>{
  const h=harness([dialogue('clarification','你希望分析哪个课程？',{questions:[{id:'course',prompt:'请选择课程',options:[{label:'数学',value:'分析数学课程'},{label:'英语',value:'分析英语课程'}]}]})]);
  const result=await h.service.run({...input(),message:'看看这个课程怎么样'},actor);expect(result.data?.answer?.questions?.[0].options).toHaveLength(2);expect(result.data?.answer?.kind).toBe('clarification');expect(h.tags.create).not.toHaveBeenCalled();expect(h.metrics).not.toHaveBeenCalled();
 });
 it('事实占位符由服务端填入数字与周期，并绑定真实证据',async()=>{
  const h=harness([call('read','query_metrics'),dialogue('analysis','本期出勤率为{{fact:read:attendance_rate}}，统计起始日{{scope:startDate}}。')]);
  const result=await h.service.run(input(),actor);expect(result.data?.answer?.summary).toContain('80%');expect(result.data?.answer?.summary).toContain('2026-08-01');expect(result.data?.answer?.facts[0].evidenceIds).toEqual([dataset+'@v1']);expect(result.data?.answer?.summary).not.toContain('{{');
 });
 it('任务截止日期可引用已核验记录回答，无需强制查询经营指标；裸日期仍拒绝',async()=>{
  const h=harness([call('task','query_decision_tasks'),dialogue('analysis','任务完成期限为{{fact:task:due_date}}，当前{{fact:task:count}}。')]),facts=[{id:'task:due_date',label:'任务完成期限',value:null,displayValue:'2026-10-31',unit:'',status:'ready',evidenceIds:['task-record']},{id:'task:count',label:'待执行任务数',value:1,unit:'项',status:'ready',evidenceIds:['task-record']}];
  h.registry.register({name:'query_decision_tasks',description:'读取已保存任务',mode:'read',status:'ready'},async()=>({status:'ready',message:'已核验',data:{result:{},facts,evidence:[{...evidence,id:'task-record'}]}}));
  const result=await h.service.run({...input(),message:'这个任务什么时候完成？'},actor);expect(result.data?.status).toBe('completed');expect(result.data?.answer?.summary).toBe('任务完成期限为2026-10-31，当前1项。');expect(result.data?.answer?.facts[0]).toMatchObject({value:null,displayValue:'2026-10-31',status:'ready'});expect(h.metrics).not.toHaveBeenCalled();
  const forged=harness([call('task','query_decision_tasks'),dialogue('analysis','任务截止2026-11-30。'),dialogue('analysis','任务截止2026-11-30。')]);forged.registry.register({name:'query_decision_tasks',description:'读取任务',mode:'read',status:'ready'},async()=>({status:'ready',message:'已核验',data:{result:{},facts,evidence:[{...evidence,id:'task-record'}]}}));expect((await forged.service.run({...input(),message:'查询这个任务的完成期限'},actor)).data?.errorCode).toBe('UNVERIFIED_NUMBER');
 });
 it('财务会话能够只读查询任务状态，不为日期问答强制调用年度财务指标',async()=>{
  const h=harness([call('task','query_decision_tasks'),dialogue('analysis','任务状态为{{fact:task:state}}。')]),financeScope={organizationId:org,years:[2024]},registry=new ToolRegistry<AuthorizedFinanceScope>();
  registry.register({name:'query_decision_tasks',description:'读取财务跟进任务',mode:'read',status:'ready'},async()=>({status:'ready',message:'已核验',data:{result:{},facts:[{id:'task:state',label:'任务状态',value:null,displayValue:'待复核',unit:'',status:'ready',evidenceIds:['record']}],evidence:[{...evidence,id:'record',scope:undefined,financeScope}]}}));
  const service=new AgentApplicationService({repository:h.repository,registry:h.registry,financeRegistry:registry,financeDatasetScope:async()=>financeScope,model:{chat:h.chat},configured:()=>true,datasetScope:async()=>scope,confirmTag:h.confirmTag,getTag:h.tags.get}),result=await service.run({message:'任务目前什么状态？',requestKey:randomUUID(),datasetId:dataset,financeScope:{years:[2024]}},actor);
  expect(result.data?.status).toBe('completed');expect(result.data?.answer?.summary).toBe('任务状态为待复核。');expect(h.metrics).not.toHaveBeenCalled();
 });
 it('同会话明确改变范围后新一轮冻结新范围，旧分析保持原周期',async()=>{
  const h=harness([call('first','query_metrics'),final(['first:attendance_rate']),call('next','query_metrics'),final(['next:attendance_rate'])]);
  const first=(await h.service.run(input(),actor)).data!,newScope={...scope,startDate:'2026-07-01',endDate:'2026-07-31',dataCutoff:'2026-07-31T15:59:59.999Z'};h.datasetScope.mockResolvedValue(newScope);
  const second=(await h.service.run({sessionId:first.sessionId,requestKey:randomUUID(),message:'分析七月出勤情况',datasetId:dataset,scope:{startDate:newScope.startDate,endDate:newScope.endDate,campusIds:[],courseIds:[],channelIds:[],dataCutoff:newScope.dataCutoff}},actor)).data!;
  expect(second.sessionId).toBe(first.sessionId);expect(second.context?.scope).toEqual(newScope);expect(h.metrics.mock.calls[1][1]).toEqual(newScope);expect((await h.service.getRun(actor,first.id)).context?.scope).toEqual(scope);
 });
 it('下一轮可继续预览同会话草稿；其他会话的草稿仍拒绝',async()=>{
  const h=harness([call('draft','propose_tag',{name:'出勤风险',rule:{type:'absence_count',minimumAbsences:2,minimumDue:3}}),dialogue('action','已保存草稿，下一步预览范围'),call('preview','preview_tag_rule',{proposalId,version:1}),dialogue('action','已经重新预览，请核对覆盖范围',{factIds:['preview:coverage']})]);
  const first=(await h.service.run(tagInput(),actor)).data!,next=await h.service.run({sessionId:first.sessionId,requestKey:randomUUID(),message:'预览上一个草稿'},actor);expect(next.data?.status).toBe('awaiting_confirmation');expect(h.tags.preview).toHaveBeenCalledTimes(1);expect(next.data?.proposals[0].id).toBe(proposalId);
  const other=harness([call('preview','preview_tag_rule',{proposalId,version:1})]);expect((await other.service.run({...tagInput(),message:'预览运营标签规则'},actor)).data?.errorCode).toBe('UNLINKED_PROPOSAL');expect(other.tags.preview).not.toHaveBeenCalled();
 });
 it('只读瞬时故障最多重试一次；写失败保留错误且不自动重试',async()=>{
  const h=harness([call('read','query_metrics'),final(['read:attendance_rate'])]);h.metrics.mockRejectedValueOnce(new AgentError('TOOL_UNAVAILABLE','暂不可用',503));const recovered=await h.service.run(input(),actor);expect(recovered.data?.status).toBe('completed');expect(h.metrics).toHaveBeenCalledTimes(2);
  const writer=harness([call('draft','propose_tag',{name:'风险',rule:{type:'renewal_due',withinDays:30}}),dialogue('conversation','草稿没有保存成功，请检查服务后重新发起')]);writer.tags.create.mockRejectedValueOnce(new AgentError('TOOL_UNAVAILABLE','暂不可用',503));const failed=await writer.service.run(tagInput(),actor);expect(writer.tags.create).toHaveBeenCalledTimes(1);expect(failed.data?.steps.find(s=>s.tool==='propose_tag')?.errorCode).toBe('TOOL_UNAVAILABLE');expect(failed.data?.answer?.summary).toContain('没有保存成功');
 });
});
describe('Agent答案与请求校验',()=>{
  it('格式诊断不泄露模型内容、未知字段名称或身份信息，严格拒绝对象与过长数组',()=>{
    const value={summary:'SECRET_NAME',factIds:[],hypotheses:Array(9).fill('待验证'),recommendations:[{private_name:'SECRET_NAME'}],limitations:[],SECRET_PHONE:'SECRET_NUMBER'};
    const diagnostics=inspectAnswerFormat(JSON.stringify(value));
    expect(diagnostics.issues).toEqual(expect.arrayContaining([{path:'hypotheses',code:'too_big'},{path:'recommendations.0',code:'invalid_type'},{path:'$',code:'unrecognized_keys'}]));
    expect(JSON.stringify(diagnostics)).not.toMatch(/SECRET|private_name/);expect(diagnostics.fields).toContainEqual({name:'unknown_field',type:'string'});expect(()=>buildAnswer(JSON.stringify(value),[])).toThrow('不符合约定格式');
  });
  it('一次性费用是业务术语，明确的次数金额仍须拒绝',()=>{
    const text=(summary:string)=>JSON.stringify({summary,factIds:[],hypotheses:[],recommendations:[],limitations:[]});
    expect(buildAnswer(text('费用变化可能与一次性费用有关，原因待核查'),[]).summary).toContain('一次性费用');
    expect(buildAnswer(text('关注重点人群，核对原因后安排跟进'),[]).summary).toContain('重点人群');
    for(const value of ['发生一次退款','费用增加一万元','出勤提高五个百分点','费用增加零点五元'])expect(()=>buildAnswer(text(value),[])).toThrow('未核验');
  });
  it('拒绝模型改写经营数字和伪证据',()=>{
    const facts=[{id:'metric',label:'出勤率',value:null,unit:'%',status:'insufficient_data',evidenceIds:['source']}];
    expect(()=>buildAnswer(JSON.stringify({summary:'出勤率99%',factIds:['metric'],hypotheses:[],recommendations:[],limitations:[]}),facts)).toThrow('未核验');
    expect(()=>buildAnswer(JSON.stringify({summary:'出勤率九成',factIds:['metric'],hypotheses:[],recommendations:[],limitations:[]}),facts)).toThrow('未核验');
    expect(()=>buildAnswer(final(['made-up']).message.content,facts)).toThrow('没有查询依据');
    expect(buildAnswer(final(['metric']).message.content,facts).facts[0].value).toBeNull();
  });
  it('新会话必选范围，已有会话可明确调整范围但不能伪造机构',()=>{
    expect(agentRunInputSchema.safeParse({message:'问题',requestKey:randomUUID()}).success).toBe(false);
    expect(agentRunInputSchema.safeParse({...input(),sessionId:randomUUID()}).success).toBe(true);
    expect(agentRunInputSchema.safeParse({...input(),organizationId:'forged'}).success).toBe(false);
  });
});

describe('Agent真实服务的只读图表保存',()=>{
 it('把业务工具图表保存到执行步骤，模型消息只收到原事实与证据',async()=>{
  const h=harness([call('visual-read','query_metrics'),final(['visual-read:attendance_rate'])]);
  const result=(await h.service.run(input(),actor)).data!;
  expect(result.status).toBe('completed');
  const step=result.steps.find(item=>item.id==='visual-read')!,stored=[...h.records.values()][0].stored.run.steps.find(item=>item.id==='visual-read')!;
  expect(step.visualizations).toHaveLength(1);expect(stored.visualizations).toEqual(step.visualizations);
  expect(step.visualizations![0]).toMatchObject({kind:'bar',metricCodes:['attendance_rate'],unit:'%',source:{datasetId:dataset,analysisType:'operations',origin:'simulated'}});
  expect(step.visualizations![0].series[0].points[0]).toEqual({value:80,status:'ready'});expect(step.visualizations![0].evidenceIds).toEqual([dataset+'@v1']);
  const tool=JSON.parse(h.captured.at(-1)!.find(message=>message.role==='tool')!.content!);
  expect(tool).not.toHaveProperty('visualizations');expect(tool.result).not.toHaveProperty('visualizations');expect(tool).not.toHaveProperty('option');
  expect(tool.facts[0].value).toBe(80);expect(tool.evidence[0].id).toBe(dataset+'@v1');expect(JSON.stringify(h.captured)).not.toContain(step.visualizations![0].id);
 });
});
