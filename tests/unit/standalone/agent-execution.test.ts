import {describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {AuthorizedScope,EvidenceReference} from '@/shared/contracts/analysis';
import type {RiskProposalVO,RiskPreviewVO} from '@/modules/tag/contracts';
import type {OperationalAnalysis} from '@/modules/analytics/contracts';
import type {ChatCompletionVO,ChatMessage} from '@/platform/ai/client';
import type {AgentActor,AgentRepository,StoredAgentRun,AgentRunDTO,AgentSessionVO,AgentMessageVO,AgentRunVO} from '@/modules/agent/contracts';
import {agentRunInputSchema} from '@/modules/agent/contracts';
import {AgentApplicationService} from '@/modules/agent/services/service';
import {createAgentToolRegistry} from '@/modules/agent/services/tools';
import {buildAnswer,inspectAnswerFormat} from '@/modules/agent/domain/answer';
import {AgentError} from '@/modules/agent/domain/errors';
import {createLearningToolRegistry} from '@/modules/agent/services/learning-tools';
import type {LearningAnalysis} from '@/modules/analytics/contracts';

const org=randomUUID(),user=randomUUID(),dataset=randomUUID(),proposalId=randomUUID(),token=randomUUID();
const actor:AgentActor={userId:user,organizationId:org,role:'operator'};
const scope:AuthorizedScope={organizationId:org,authorizedCampusIds:[],startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[],dataCutoff:'2026-08-31T15:59:59.999Z'};
const evidence:EvidenceReference={id:dataset,kind:'metric',sourceId:dataset,version:'v1',summary:'已完成批次',scope,updatedAt:scope.dataCutoff!};
const input=():AgentRunDTO=>({message:'分析出勤情况',requestKey:randomUUID(),datasetId:dataset,scope:{startDate:scope.startDate,endDate:scope.endDate,campusIds:[],courseIds:[],channelIds:[]}});
const call=(id:string,name:string,args:unknown={}):ChatCompletionVO=>({message:{content:null,tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(args)}}]}});
const final=(factIds:string[]=[]):ChatCompletionVO=>({message:{content:JSON.stringify({summary:'依据所选范围完成分析',factIds,hypotheses:['具体原因尚未验证'],recommendations:['核查签到记录'],limitations:['仅针对当前数据范围']})}});
const clone=<T>(value:T):T=>structuredClone(value);
function memoryRepository(deadlineMs=120000){
  const records=new Map<string,{stored:StoredAgentRun;hash:string;key:string;owner:string}>(),messages:AgentMessageVO[]=[],sessions=new Map<string,AgentSessionVO>();
  const owner=(a:AgentActor)=>a.organizationId+':'+a.userId;
  const find=(a:AgentActor,id:string)=>{const r=records.get(id);if(!r||r.owner!==owner(a))throw new AgentError('NOT_FOUND','无权访问',404);return r;};
  const repository:AgentRepository={
    prepare:vi.fn(async(a,data,hash,resolved)=>{
      const old=[...records.values()].find(r=>r.key===data.requestKey&&r.owner===owner(a));
      if(old){if(old.hash!==hash)throw new AgentError('REQUEST_KEY_CONFLICT','请求编号冲突',409);return {execution:clone(old.stored),reused:true};}
      const now=new Date().toISOString(),id=randomUUID();
      const session=data.sessionId?sessions.get(data.sessionId)!:{id:randomUUID(),title:data.message,datasetId:data.datasetId!,scope:resolved!,createdBy:a.userId,editable:true,createdAt:now,updatedAt:now};
      if(!session)throw new AgentError('NOT_FOUND','会话不存在',404);
      sessions.set(session.id,session);
      const stored:StoredAgentRun={session,run:{id,sessionId:session.id,status:'running',steps:[],proposals:[],evidence:[],answer:null,errorCode:null,errorMessage:null,startedAt:now,completedAt:null},message:data.message,deadlineAt:new Date(Date.now()+deadlineMs).toISOString()};
      records.set(id,{stored:clone(stored),hash,key:data.requestKey,owner:owner(a)});
      messages.push({id:randomUUID(),sessionId:session.id,runId:id,role:'user',content:data.message,createdAt:now});return {execution:stored,reused:false};
    }),
    save:vi.fn(async(a,run)=>{find(a,run.id).stored.run=clone(run);}),
    finish:vi.fn(async(a,run,expected=['running'])=>{const record=find(a,run.id);if(!expected.includes(record.stored.run.status))return false;record.stored.run=clone(run);return true;}),
    getRun:vi.fn(async(a,id)=>clone(find(a,id).stored)),
    listSessions:vi.fn(async()=>[...sessions.values()]),
    getSession:vi.fn(async(a,id)=>({session:sessions.get(id)!,messages:messages.filter(m=>m.sessionId===id),runs:[...records.values()].filter(r=>r.owner===owner(a)&&r.stored.session.id===id).map(r=>clone(r.stored.run))})),
    history:vi.fn(async(_,id)=>messages.filter(m=>m.sessionId===id)),
  };
  return {repository,records,messages};
}
function harness(responses:ChatCompletionVO[],options:{configured?:boolean;deadlineMs?:number}={}){
  const memory=memoryRepository(options.deadlineMs),captured:ChatMessage[][]=[];
  let current:RiskProposalVO={id:proposalId,datasetId:dataset,name:'出勤风险',scope,rule:{type:'absence_count',minimumAbsences:2,minimumDue:3},version:1,status:'draft',preview:null,publishedTagId:null,createdAt:'',updatedAt:''};
  const preview={token,fingerprint:'a'.repeat(64),memberCount:2,evidence:[evidence],observedCount:5,unknownStudentCount:1,scope,members:[{displayName:'SECRET_STUDENT'}]} as unknown as RiskPreviewVO;
  const metrics=vi.fn(async()=>({dataset:{id:dataset,name:'测试数据',origin:'simulated'},scope,metrics:[{code:'attendance_rate',value:80,numerator:8,denominator:10,scope,evidence:[evidence],status:'ready',reason:'测试',unknownCount:0,details:{}}],trend:[],breakdown:[],riskStudents:[{studentId:'private',displayName:'SECRET_STUDENT',absent:2,leave:0,unknown:0}],batches:[]} as OperationalAnalysis));
  const tags={list:vi.fn(async()=>[current]),get:vi.fn(async()=>clone(current)),create:vi.fn(async()=>clone(current)),preview:vi.fn(async()=>{current={...current,status:'awaiting_confirmation',preview};return clone(current);})};
  const registry=createAgentToolRegistry({metrics:{query:metrics},tags,profiles:{list:vi.fn(async()=>[]),query:vi.fn()},knowledge:{search:vi.fn(async()=>({status:'ready' as const,message:'已查询',data:{query:'口径',hits:[{id:'hit',title:'口径',kind:'definition',text:'仅使用逐课签到计算',similarity:0.9,evidence:{...evidence,kind:'knowledge' as const}}]}}))}});
  const chat=vi.fn(async(messages:ChatMessage[],_tools:unknown[]=[])=>{captured.push(clone(messages));const response=responses.shift();if(!response)throw Error('mock responses exhausted');return response;});
  const confirmTag=vi.fn(async()=>{current={...current,status:'published',publishedTagId:randomUUID()};return clone(current);});
  const service=new AgentApplicationService({repository:memory.repository,registry,model:{chat},configured:()=>options.configured??true,datasetScope:vi.fn(async()=>scope),confirmTag,getTag:tags.get});
  return {service,chat,metrics,tags,registry,captured,confirmTag,...memory};
}

describe('公开学习Agent范围与工具边界',()=>{
 const learningScope={organizationId:org,courseKeys:['AAA:2013J'],relativeDayStart:-20,relativeDayEnd:100};
 const learningInput=()=>({message:'分析学习情况',requestKey:randomUUID(),datasetId:dataset,learningScope:{courseKeys:['AAA:2013J'],relativeDayStart:-20,relativeDayEnd:100}});
 const setup=(responses:ChatCompletionVO[])=>{
  const h=harness(responses),query=vi.fn(async()=>({dataset:{id:dataset,name:'公开数据',origin:'public'},scope:learningScope,metrics:[{code:'activity_count',label:'学习活动记录数',value:100,unit:'条',status:'ready'}],trend:[],courses:[],resources:[],scores:[],outcomes:[],completeness:[],evidence:[{...evidence,scope:undefined,learningScope}],batches:[],relativeDayBounds:{min:-20,max:100}} as LearningAnalysis));
  const learningRegistry=createLearningToolRegistry({learning:{query},knowledge:{search:vi.fn(async()=>({status:'ready' as const,message:'没有知识命中',data:{query:'学习口径',hits:[]}}))}});
  const service=new AgentApplicationService({repository:h.repository,registry:h.registry,learningRegistry,model:{chat:h.chat},configured:()=>true,datasetScope:async()=>scope,learningDatasetScope:async()=>learningScope,confirmTag:h.confirmTag,getTag:h.tags.get});return {...h,service,query};
 };
 it('新请求范围互斥，已有学习会话不能扩展范围',()=>{expect(agentRunInputSchema.safeParse({...learningInput(),scope:input().scope}).success).toBe(false);expect(agentRunInputSchema.safeParse({...learningInput(),sessionId:randomUUID()}).success).toBe(false);expect(agentRunInputSchema.safeParse(learningInput()).success).toBe(true);});
 it('只将学习查询和知识检索交给模型，事实数值由业务工具返回',async()=>{const h=setup([call('learn','query_learning_metrics'),call('rag','search_knowledge',{query:'学习口径'}),final(['learn:activity_count'])]),result=await h.service.run(learningInput(),actor);expect(result.data?.status).toBe('completed');expect(result.data?.answer?.facts[0].value).toBe(100);expect(h.query).toHaveBeenCalledWith(dataset,learningScope);expect(h.metrics).not.toHaveBeenCalled();expect(h.tags.create).not.toHaveBeenCalled();expect(h.chat.mock.calls[0][1].map((t:any)=>t.function.name)).toEqual(['query_learning_metrics','search_knowledge']);expect(h.chat.mock.calls.at(-1)?.[1]).toEqual([]);const lastPrompt=h.captured.at(-1)!.at(-1)!.content!;expect(lastPrompt).toContain('["learn:activity_count"]');expect(lastPrompt).toContain('知识检索的hit.id、evidence.id、sourceId');});
 it('即使模型请求经营写入或查询工具也拒绝执行',async()=>{for(const name of ['propose_tag','preview_tag_rule','query_metrics','publish_tag']){const h=setup([call('attack',name,{})]);expect((await h.service.run(learningInput(),actor)).data?.errorCode).toBe('UNKNOWN_TOOL');expect(h.tags.create).not.toHaveBeenCalled();expect(h.metrics).not.toHaveBeenCalled();}});
 it('不能通过学习工具参数扩大机构、数据集、课程或提交SQL',async()=>{for(const args of [{organizationId:'forged'},{datasetId:randomUUID()},{courseKeys:[]},{sql:'SELECT *'}]){const h=setup([call('attack','query_learning_metrics',args)]);expect((await h.service.run(learningInput(),actor)).data?.errorCode).toBe('INVALID_ARGUMENTS');expect(h.query).not.toHaveBeenCalled();}});
 it('仅检索知识不能冒充已核对学习数字',async()=>{const h=setup([call('rag','search_knowledge',{query:'学习口径'}),final()]);expect((await h.service.run(learningInput(),actor)).data?.errorCode).toBe('NO_EVIDENCE');expect(h.query).not.toHaveBeenCalled();});
 it('已有学习会话保留固定相对日且重复请求复用结果',async()=>{const h=setup([call('learn','query_learning_metrics'),final(['learn:activity_count']),call('next','query_learning_metrics'),final(['next:activity_count'])]),firstInput=learningInput(),first=(await h.service.run(firstInput,actor)).data!;expect((await h.service.run(firstInput,actor)).data?.id).toBe(first.id);const next=await h.service.run({message:'继续分析',requestKey:randomUUID(),sessionId:first.sessionId},actor);expect(next.data?.status).toBe('completed');expect(h.query).toHaveBeenCalledTimes(2);expect(h.query.mock.calls[1][1]).toEqual(learningScope);});
});

describe('受控Agent执行',()=>{
  it('格式修正说明明确字段类型与条目上限，仅传安全路径且不重执行工具',async()=>{
    const invalid={message:{content:JSON.stringify({summary:'依据查询解释',factIds:['metric:attendance_rate'],hypotheses:Array(9).fill('原因尚未验证'),recommendations:[{action:'SECRET_PAYLOAD'}],limitations:[]})}};
    const h=harness([call('metric','query_metrics'),invalid,final(['metric:attendance_rate'])]),result=await h.service.run(input(),actor);
    expect(result.data?.status).toBe('completed');expect(h.metrics).toHaveBeenCalledTimes(1);
    const repair=h.captured.at(-1)!.findLast(message=>message.role==='user')!.content!;
    expect(repair).toContain('hypotheses');expect(repair).toContain('too_big');expect(repair).toContain('recommendations.0');expect(repair).toContain('invalid_type');expect(repair).toContain('最多8项');expect(repair).toContain('最多80项');expect(repair).not.toContain('SECRET_PAYLOAD');expect(h.chat.mock.calls.at(-1)?.[1]).toEqual([]);
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
    expect(run.steps.map(s=>s.facts![0].evidenceIds)).toEqual([[dataset+'@v1'],[dataset+'@v2'],[dataset+'@v2']]);
    expect(run.answer!.facts.map(f=>({value:f.value,evidenceIds:f.evidenceIds}))).toEqual([{value:80,evidenceIds:[dataset+'@v1']},{value:60,evidenceIds:[dataset+'@v2']},{value:60,evidenceIds:[dataset+'@v2']}]);
    const toolMessages=h.captured.at(-1)!.filter(m=>m.role==='tool');
    expect(toolMessages.map(m=>{const payload=JSON.parse(m.content!);return {id:payload.evidence[0].id,metricId:payload.result.metrics[0].evidence[0].id,factId:payload.facts[0].evidenceIds[0]};})).toEqual([
      {id:dataset+'@v1',metricId:dataset+'@v1',factId:dataset+'@v1'},
      {id:dataset+'@v2',metricId:dataset+'@v2',factId:dataset+'@v2'},
      {id:dataset+'@v2',metricId:dataset+'@v2',factId:dataset+'@v2'},
    ]);
    expect(original.metrics[0].evidence[0].id).toBe(dataset);
  });
  it('固定会话范围，拒绝模型伪造机构、数据集和任意SQL',async()=>{
    for(const args of [{organizationId:'forged'},{datasetId:randomUUID()},{sql:'SELECT *'}]){
      const h=harness([call('malicious','query_metrics',args)]),result=await h.service.run(input(),actor);
      expect(result.data?.status).toBe('failed');expect(result.data?.errorCode).toBe('INVALID_ARGUMENTS');expect(h.metrics).not.toHaveBeenCalled();expect(result.data?.steps[0].input).toBeUndefined();
    }
  });
  it('未知或发布工具不会执行',async()=>{
    const h=harness([call('publish','publish_tag')]),result=await h.service.run(input(),actor);
    expect(result.data?.errorCode).toBe('UNKNOWN_TOOL');expect(h.confirmTag).not.toHaveBeenCalled();expect(h.tags.create).not.toHaveBeenCalled();
  });
  it('viewer不能创建执行，缺模型配置不保存伪任务',async()=>{
    const h=harness([]);await expect(h.service.run(input(),{...actor,role:'viewer'})).rejects.toMatchObject({status:403});expect(h.repository.prepare).not.toHaveBeenCalled();
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
    const h=harness([call('draft','propose_tag',{name:'出勤风险',rule:{type:'absence_count',minimumAbsences:2,minimumDue:3}}),call('preview','preview_tag_rule',{proposalId,version:1}),final(['preview:coverage'])]);
    const result=await h.service.run(input(),actor),run=result.data!;
    expect(run.status).toBe('awaiting_confirmation');expect(run.proposals[0]).toMatchObject({previewToken:token,estimatedCount:2});expect(h.confirmTag).not.toHaveBeenCalled();
    expect(run.proposals[0].evidence[0]).toMatchObject({id:dataset+'@v1',sourceId:dataset,version:'v1'});
    expect(run.steps[1].facts![0].evidenceIds).toEqual([dataset+'@v1']);
    expect(h.tags.create.mock.calls[0][3]).toBe(run.id+':draft');expect(JSON.stringify(h.captured)).not.toContain(token);expect(JSON.stringify(h.captured)).not.toContain('SECRET_STUDENT');
    await expect(h.service.confirm({runId:run.id,proposalId,version:2,previewToken:token},actor)).rejects.toMatchObject({code:'STALE_CONFIRMATION'});
    await expect(h.service.confirm({runId:run.id,proposalId,version:1,previewToken:token},{...actor,role:'viewer'})).rejects.toMatchObject({status:403});
    expect(h.confirmTag).not.toHaveBeenCalled();
    const confirmed=await h.service.confirm({runId:run.id,proposalId,version:1,previewToken:token},actor);
    expect(confirmed.status).toBe('completed');expect(h.confirmTag).toHaveBeenCalledWith(org,user,proposalId,1,token);
    expect(confirmed.proposals[0].evidence[0].id).toBe(run.evidence[0].id);
  });
  it('不能预览其他执行的草稿',async()=>{
    const h=harness([call('unlinked','preview_tag_rule',{proposalId,version:1})]),result=await h.service.run(input(),actor);
    expect(result.data?.errorCode).toBe('UNLINKED_PROPOSAL');expect(h.tags.preview).not.toHaveBeenCalled();
  });
  it('写工具失败不自动重试，也不输出供应商原始错误',async()=>{
    const h=harness([call('write','propose_tag',{name:'风险',rule:{type:'absence_count',minimumAbsences:2,minimumDue:3}})]);
    h.tags.create.mockRejectedValueOnce(Error('SECRET_TOKEN provider payload'));
    const result=await h.service.run(input(),actor);expect(result.data?.status).toBe('failed');expect(h.tags.create).toHaveBeenCalledTimes(1);expect(JSON.stringify(result)).not.toContain('SECRET_TOKEN');
  });
  it('工具服务未配置不能被记为成功',async()=>{
    const h=harness([call('search','search_knowledge',{query:'口径'})]);
    h.registry.register({name:'unavailable',description:'未接入',mode:'read',status:'ready'},async()=>({status:'unconfigured',message:'向量模型尚未配置',data:null}));
    h.chat.mockResolvedValueOnce(call('missing','unavailable'));
    const result=await h.service.run(input(),actor);expect(result.data?.errorCode).toBe('TOOL_UNAVAILABLE');expect(result.data?.steps[0].status).toBe('failed');
  });
  it('最多六轮和八次工具调用，不重复执行同一调用编号',async()=>{
    const rounds=harness(Array.from({length:6},(_,i)=>call('round-'+i,'query_profile')));
    expect((await rounds.service.run(input(),actor)).data?.errorCode).toBe('ROUND_LIMIT');expect(rounds.chat).toHaveBeenCalledTimes(6);
    const many=harness([{message:{content:null,tool_calls:Array.from({length:8},(_,i)=>call('tool-'+i,'query_profile').message.tool_calls![0])}},call('ninth','query_profile')]);
    const limit=await many.service.run(input(),actor);expect(limit.data?.errorCode).toBe('TOOL_LIMIT');expect(limit.data?.steps).toHaveLength(8);
    const repeated=harness([call('same','query_metrics'),call('same','query_metrics')]);expect((await repeated.service.run(input(),actor)).data?.errorCode).toBe('DUPLICATE_TOOL_CALL');expect(repeated.metrics).toHaveBeenCalledTimes(1);
  });
  it('超时和中断执行保存明确失败状态',async()=>{
    const h=harness([],{deadlineMs:10});h.chat.mockImplementationOnce(()=>new Promise(()=>{}));
    const result=await h.service.run(input(),actor);expect(result.data?.errorCode).toBe('EXECUTION_TIMEOUT');expect(h.repository.finish).toHaveBeenCalled();
    const stored=[...h.records.values()][0].stored;stored.run.status='running';stored.deadlineAt=new Date(Date.now()-1).toISOString();
    expect((await h.service.getRun(actor,stored.run.id)).errorCode).toBe('EXECUTION_EXPIRED');
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
  it('新会话必选范围，已有会话不能悄悄改范围',()=>{
    expect(agentRunInputSchema.safeParse({message:'问题',requestKey:randomUUID()}).success).toBe(false);
    expect(agentRunInputSchema.safeParse({...input(),sessionId:randomUUID()}).success).toBe(false);
    expect(agentRunInputSchema.safeParse({...input(),organizationId:'forged'}).success).toBe(false);
  });
});
