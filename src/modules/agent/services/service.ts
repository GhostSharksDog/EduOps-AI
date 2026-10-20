import {createHash} from 'node:crypto';
import {ZodError} from 'zod';
import {isLearningScope,isFinanceScope,analysisScopeSchema,learningScopeSchema,financeScopeSchema} from '@/shared/contracts/analysis';
import type {AuthorizedScope,AuthorizedLearningScope,AuthorizedFinanceScope,AuthorizedAnalysisScope,CapabilityResult,EvidenceReference} from '@/shared/contracts/analysis';
import type {ChatCompletionVO,ChatMessage,ChatToolDefinition} from '@/platform/ai/client';
import type {RiskProposalVO} from '@/modules/tag/contracts';
import {WorkflowError} from '@/shared/errors/workflow-error';
import {agentRunInputSchema,agentConfirmationSchema} from '../contracts';
import type {AgentActor,AgentRepository,AgentRunVO,AgentToolPayload,AgentFactVO,StoredAgentRun,AgentService,AgentTurnContext,ToolExecutionContext} from '../contracts';
import {AgentError} from '../domain/errors';
import {conversationalSystemPrompt,conversationalAnswerPrompt,conversationalRepairPrompt,conversationalBindingPrompt,conversationalFactReferencePrompt,conversationalValidationFields,buildConversationalAnswer,summarizedConversationObjects} from '../domain/conversation';
import {ToolRegistry,allowedTaskTools,assertAllowedTaskTool} from './registry';
import {routeTask,selectTaskToolsDefinition,selectTaskToolsSchema,type AgentTaskMode} from '../domain/task-routing';
import type {AgentTaskState,AgentTaskStatePatch,TaskStateUpdate} from '../contracts/task-state';
import {readTaskState,taskMemoryInput,taskScopeKey,evidenceScopeKey,prepareTaskState} from '../domain/task-state';
import type {AgentFrozenEvidence} from '../contracts/research';
import {InterpretationRecoveryService,decorateRecovery} from './interpretation-recovery';
import {boundedAgentVisualizations} from '../domain/visualization';
import {proposalVO,sameScope} from './tools';
import {registerScopeTools} from './scope-tools';
import {requiredAnalysisQueries,missingAnalysisQueries,groundedConversationHistory,factsOnlyAnswer,completedScopeFacts} from '../domain/analysis-completeness';

export interface AgentModelPort {chat(messages:ChatMessage[],tools:ChatToolDefinition[],options?:{signal?:AbortSignal;json?:boolean}):Promise<ChatCompletionVO>;}
export interface AgentServicePorts {
 repository:AgentRepository;registry:ToolRegistry;model:AgentModelPort;configured():boolean;
 learningRegistry?:ToolRegistry<AuthorizedLearningScope>;financeRegistry?:ToolRegistry<AuthorizedFinanceScope>;
 financeDatasetScope?(org:string,id:string,scope:AuthorizedFinanceScope):Promise<AuthorizedFinanceScope>;
 learningDatasetScope?(org:string,id:string,scope:AuthorizedLearningScope):Promise<AuthorizedLearningScope>;
 datasetScope(org:string,id:string,scope:AuthorizedScope):Promise<AuthorizedScope>;
 scopeOptions?(org:string,id:string):Promise<unknown>;
 evidenceFingerprint?(actor:AgentActor,context:AgentTurnContext):Promise<string>;
 validateKnowledge?(actor:AgentActor,evidence:EvidenceReference[]):Promise<void>;
 validateTaskObjects?(actor:AgentActor,context:AgentTurnContext,state:AgentTaskState):Promise<AgentTaskState>;
 confirmTag(org:string,user:string,id:string,version:number,token:string):Promise<RiskProposalVO>;
 getTag(org:string,id:string):Promise<RiskProposalVO>;
 confirmProposal?(actor:AgentActor,input:{runId:string;proposalId:string;version:number;previewToken:string}):Promise<AgentRunVO>;
}
const evidenceKey=(e:EvidenceReference)=>e.id+':'+e.version;
const uniqueEvidence=(items:EvidenceReference[])=>[...new Map(items.map(e=>[evidenceKey(e),e])).values()];
export function safeAgentError(error:unknown):AgentError {
 if(error instanceof AgentError)return error;
 if(error instanceof ZodError)return new AgentError('INVALID_ARGUMENTS','请求或工具参数不符合业务约定',400);
 if(error instanceof WorkflowError)return new AgentError(error.code??'WORKFLOW_CONFLICT',error.message,error.status);
 if(error instanceof Error&&error.name==='ModelServiceError'){
  const modelError=error as Error&{code?:string;diagnostics?:{httpStatus?:number;networkReason?:string}},code=modelError.code??'MODEL_ERROR';
  const messages:Record<string,string>={UNCONFIGURED:'对话模型尚未配置',MODEL_TIMEOUT:'模型响应超时，请稍后重试',MODEL_HTTP:'模型服务调用失败，请稍后重试',MODEL_NETWORK:'当前无法连接模型服务，请检查服务端网络后重试',INVALID_CHAT:'模型返回格式无效',INVALID_JSON:'模型返回格式无效',EMPTY_CHAT:'模型没有返回有效内容'};
  let message=messages[code]??'模型服务暂不可用';
  if(code==='MODEL_NETWORK'){
   const reason=modelError.diagnostics?.networkReason;
   if(reason==='ENOTFOUND'||reason==='EAI_AGAIN')message='无法解析模型服务地址，请检查服务端DNS和模型地址';
   else if(reason==='EPERM'||reason==='EACCES')message='服务端连接模型服务被系统拦截，请检查防火墙或运行权限';
   else if(reason==='ENETUNREACH'||reason==='EHOSTUNREACH')message='服务端无法访问模型网络，请检查网络或代理设置';
   else if(reason==='ECONNREFUSED')message='模型连接被拒绝，请检查服务地址或代理是否可用';
   else if(reason==='ECONNRESET'||reason==='UND_ERR_SOCKET')message='模型连接中断，请检查网络后重试';
   else if(reason==='ETIMEDOUT'||reason==='UND_ERR_CONNECT_TIMEOUT')message='连接模型服务超时，请检查服务端网络或代理后重试';
   else if(reason==='ERR_INVALID_URL')message='模型服务地址格式不正确，请检查服务端配置后重启应用';
   else if(['ERR_TLS_CERT_ALTNAME_INVALID','UNABLE_TO_VERIFY_LEAF_SIGNATURE','CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT'].includes(reason??''))message='模型服务证书校验失败，请检查系统时间、证书和代理设置';
  }
  if(code==='MODEL_HTTP'){
   const status=modelError.diagnostics?.httpStatus;
   if(status===401)message='模型密钥验证失败，请检查服务端密钥配置后重启应用';
   else if(status===403)message='模型访问被拒绝，请检查账号权限、模型授权或服务地域';
   else if(status===402)message='模型额度或余额不足，请检查模型平台账户后重试';
   else if(status===429)message='模型请求受限，请稍后重试，并检查调用限额或剩余额度';
   else if(status===404)message='模型或接口不存在，请检查服务端模型名称和接口地址';
   else if(typeof status==='number'&&status>=500&&status<=599)message='模型服务暂时异常，请稍后重试';
  }
  return new AgentError(code,message,code==='UNCONFIGURED'?503:502);
 }
 return new AgentError('EXECUTION_ERROR','执行失败，请检查数据服务后重试',503);
}
const assertActor=(actor:AgentActor)=>{if(!actor.userId||!actor.organizationId||!['admin','operator','viewer'].includes(actor.role))throw new AgentError('FORBIDDEN','请使用本公司有效账号登录',403);};
const assertWriter=(actor:AgentActor)=>{assertActor(actor);if(!['admin','operator'].includes(actor.role))throw new AgentError('FORBIDDEN','当前角色不能确认业务操作',403);};
const fatalToolErrors=new Set(['UNKNOWN_TOOL','TOOL_NOT_SELECTED','TOOL_GROUP_LIMIT','BATCH_CHANGED','FORBIDDEN_TOOL','FORBIDDEN','INVALID_CONTEXT','OUTSIDE_SCOPE','UNLINKED_PROPOSAL','DUPLICATE_TOOL_CALL','TOOL_LIMIT','EXECUTION_ENDED','EXECUTION_TIMEOUT']);
const transientErrors=new Set(['EXECUTION_ERROR','MODEL_NETWORK','TOOL_UNAVAILABLE']);
const pendingPlan=(run:AgentRunVO)=>!!run.actionPlan&&run.actionPlan.status!=='completed';
const modelRecoveryDelayMs=1000;
function recoverableModelStatus(error:unknown):number|undefined {
 if(!(error instanceof Error)||error.name!=='ModelServiceError')return;
 const failure=error as Error&{code?:string;diagnostics?:{httpStatus?:number}};
 const status=failure.diagnostics?.httpStatus;
 return failure.code==='MODEL_HTTP'&&status!==undefined&&[502,503,504].includes(status)?status:undefined;
}
function waitForModelRecovery(signal:AbortSignal):Promise<void>{
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(new AgentError('EXECUTION_TIMEOUT','本轮执行已取消或超过时限',504));return;}
  const cancel=()=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);reject(new AgentError('EXECUTION_TIMEOUT','本轮执行已取消或超过时限',504));};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},modelRecoveryDelayMs);
  signal.addEventListener('abort',cancel,{once:true});
 });
}
export class AgentApplicationService implements AgentService {
 constructor(private readonly ports:AgentServicePorts){
  if(ports.scopeOptions){
   registerScopeTools(ports.registry,'operations',ports.scopeOptions);
   if(ports.learningRegistry)registerScopeTools(ports.learningRegistry,'learning',ports.scopeOptions);
   if(ports.financeRegistry)registerScopeTools(ports.financeRegistry,'finance',ports.scopeOptions);
  }
 }
 findSavedRunForProposal(actor:AgentActor,id:string){return this.ports.repository.findRunForProposal?.(actor,id);}
 async updateTaskState(actor:AgentActor,id:string,input:AgentTaskStatePatch){assertActor(actor);if(!this.ports.repository.updateTaskState)throw new AgentError('TASK_STATE_UNAVAILABLE','当前会话暂不支持任务记忆',409);return this.ports.repository.updateTaskState(actor,id,input);}
 async retryInterpretation(raw:unknown,actor:AgentActor,id:string){
  assertActor(actor);return new InterpretationRecoveryService({repository:this.ports.repository,model:this.ports.model,configured:this.ports.configured,fingerprint:this.ports.evidenceFingerprint,validateKnowledge:this.ports.validateKnowledge,authorizeScope:async(a,c)=>{await this.resolveScope(a,c.datasetId,c.scope);},safeError:safeAgentError}).retry(actor,id,raw);
 }
 getSavedRun(actor:AgentActor,id:string){return this.ports.repository.getRun(actor,id);}
 getCapability(){return {status:this.ports.configured()?'ready':'unconfigured',message:this.ports.configured()?'支持连续交流、数据查询、业务草稿和操作计划；正式操作通过页面确认。':'请先配置对话模型后使用助手。',data:{tools:[...this.ports.registry.list(),...(this.ports.learningRegistry?.list().filter(t=>t.name==='query_learning_metrics')??[]),...(this.ports.financeRegistry?.list().filter(t=>t.name==='query_financial_metrics')??[])]}} as const;}
 async progress(actor:AgentActor,requestKey?:string,runId?:string){
  assertActor(actor);
  if(runId){const saved=await this.ports.repository.getRun(actor,runId);return {prepared:true,run:saved.run,deadlineAt:saved.deadlineAt,expired:saved.run.status==='running'&&Date.now()>=Date.parse(saved.deadlineAt)};}
  if(!this.ports.repository.progress)throw new AgentError('PROGRESS_UNAVAILABLE','进度查询暂不可用',503);
  return this.ports.repository.progress(actor,requestKey!);
 }
 private async resolveScope(actor:AgentActor,datasetId:string,scope:AuthorizedAnalysisScope):Promise<AuthorizedAnalysisScope>{
  if(isLearningScope(scope)){if(!this.ports.learningDatasetScope)throw new AgentError('LEARNING_UNAVAILABLE','学习分析尚不可用',503);return this.ports.learningDatasetScope(actor.organizationId,datasetId,{...learningScopeSchema.parse(scopeFields(scope)),organizationId:actor.organizationId});}
  if(isFinanceScope(scope)){if(!this.ports.financeDatasetScope)throw new AgentError('FINANCE_UNAVAILABLE','财务分析尚不可用',503);return this.ports.financeDatasetScope(actor.organizationId,datasetId,{...financeScopeSchema.parse(scopeFields(scope)),organizationId:actor.organizationId});}
  return this.ports.datasetScope(actor.organizationId,datasetId,{...analysisScopeSchema.parse(scopeFields(scope)),organizationId:actor.organizationId,authorizedCampusIds:scope.authorizedCampusIds??[]});
 }
 async run(raw:unknown,actor:AgentActor):Promise<CapabilityResult<AgentRunVO>>{
  assertActor(actor);const input=agentRunInputSchema.parse(raw);
  if(!this.ports.configured())return {status:'unconfigured',message:'对话模型尚未配置，未创建执行',data:null};
  let scope:AuthorizedAnalysisScope|undefined;
  if(input.datasetId&&input.scope)scope=await this.resolveScope(actor,input.datasetId,{...input.scope,organizationId:actor.organizationId,authorizedCampusIds:[]});
  if(input.datasetId&&input.learningScope)scope=await this.resolveScope(actor,input.datasetId,{...input.learningScope,organizationId:actor.organizationId});
  if(input.datasetId&&input.financeScope)scope=await this.resolveScope(actor,input.datasetId,{...input.financeScope,organizationId:actor.organizationId});
  if(input.sessionId&&!scope){
   const session=(await this.ports.repository.getSession(actor,input.sessionId)).session;
   if(input.datasetId&&input.datasetId!==session.datasetId)throw new AgentError('INVALID_SCOPE','切换数据集时请一并选择其分析范围',400);
   // 每轮重查数据集归属及可用范围，历史会话不会绕过当前授权。
   await this.resolveScope(actor,session.datasetId,session.scope);
  }
  const hash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const taskState=input.sessionId?await this.ports.repository.getTaskState?.(actor,input.sessionId):undefined;
  const {execution,reused}=await this.ports.repository.prepare(actor,input,hash,scope,taskMemoryInput(input.message,taskState));
  if(reused)return {status:execution.run.status==='failed'?'error':'ready',message:'已返回相同请求的执行记录',data:await this.getRun(actor,execution.run.id)};
  const {run,session}=execution;run.context??={datasetId:session.datasetId,scope:session.scope};
  if(!run.steps.some(s=>s.context))run.steps.unshift({id:'context',tool:'resolve_context',status:'completed',evidence:[],context:run.context});
  const controller=new AbortController(),remaining=Math.max(0,Date.parse(execution.deadlineAt)-Date.now());let timer:ReturnType<typeof setTimeout>|undefined;
  const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new AgentError('EXECUTION_TIMEOUT','本轮超过时限，已有事实和草稿已保留，请查看结果后重试',504));},remaining);});
  try{
   await Promise.race([this.execute(execution,actor,controller.signal),timeout]);
   return {status:'ready',message:run.status==='awaiting_confirmation'?'准备已完成，等待页面确认':'本轮已完成',data:decorateRecovery(run)};
  }catch(error){
   controller.abort();const failure=safeAgentError(error),failed=structuredClone(run);
   failed.status='failed';failed.errorCode=failure.code;failed.errorMessage=failure.message;failed.completedAt=new Date().toISOString();
   for(const step of failed.steps)if(step.runtime?.recovery?.status==='waiting')step.runtime.recovery.status='failed';
   for(const step of failed.steps)if(step.status==='pending'){step.status='failed';step.errorCode=failure.code;step.errorMessage=failure.message;}
   const missing=failed.context?missingAnalysisQueries(requiredAnalysisQueries(execution.message,failed.context),failed).map(query=>query.tool+(query.input.dimension?':'+query.input.dimension:'')):[];
   const partial=factsOnlyAnswer(failed,failure.code,missing);
   if(partial)failed.answer=partial;
   else {const safeFacts=completedScopeFacts(failed);failed.answer=safeFacts.length?{kind:'analysis',summary:'本轮未完成，仅展示当前范围已查询的数据依据。',facts:safeFacts,hypotheses:[],recommendations:[],limitations:[failure.message]}:null;}
   if(!await this.ports.repository.finish(actor,failed)){const saved=(await this.ports.repository.getRun(actor,failed.id)).run;return {status:saved.status==='failed'?'error':'ready',message:saved.errorMessage??'已返回保存记录',data:saved};}
   return {status:'error',message:failure.message,data:decorateRecovery(failed)};
  }finally{if(timer)clearTimeout(timer);}
 }
 private async execute(execution:StoredAgentRun,actor:AgentActor,signal:AbortSignal){
  const {run,session}=execution,check=()=>{if(signal.aborted||Date.now()>=Date.parse(execution.deadlineAt))throw new AgentError('EXECUTION_TIMEOUT','本轮超过时限，请查看保存记录',504);};
  const history=await this.ports.repository.history(actor,session.id),detail=await this.ports.repository.getSession(actor,session.id);check();
  const previous=detail.runs.filter(r=>r.id!==run.id).slice(-8),sourceProposals=previous.flatMap(r=>r.proposals),sourceProposalIds=new Set(sourceProposals.map(p=>p.id));
  let memory=readTaskState(run.steps.find(s=>s.id==='context')?.runtime?.taskMemory??session.taskState,run.context!);
  const memoryRevision=memory.revision;
  if(this.ports.validateTaskObjects)memory=await this.ports.validateTaskObjects(actor,run.context!,memory);
  const rememberedIds=memory.needsReview?[]:memory.selectedObjects.filter(o=>o.kind==='tag').map(o=>o.id);
  for(const id of rememberedIds)sourceProposalIds.add(id);
  const previousObjects=summarizedConversationObjects(previous,{datasetId:detail.session.datasetId,scope:detail.session.scope});
  let current=run.context!,learning=isLearningScope(current.scope),finance=isFinanceScope(current.scope);
  const registry=finance?this.ports.financeRegistry:learning?this.ports.learningRegistry:this.ports.registry;
  if(!registry)throw new AgentError('MODE_UNAVAILABLE','当前分析模式尚不可用',503);
  const modePrompt=learning?'当前为匿名公开学习数据，只能查询学习与知识；点击不是出勤，课程退出不是机构经营流失；最终结果不是历史预测。':finance?'当前为集团年度公开财务，只可查询年度事实和准备其决策任务，不能使用模拟学员、经营标签、人群或经营周月报；毛利不是净利润。':'当前为经营数据，按业务口径区分未知、缺失、待观察与真实零值。';
  const mode:AgentTaskMode=finance?'finance':learning?'learning':'operations',routing=routeTask(execution.message,memory,mode);
  let groups=routing.groups,allowed=allowedTaskTools(registry,actor,groups,mode),switches=0;
  const definitions=()=>[...allowed,selectTaskToolsDefinition];
  const modelTools=():ChatToolDefinition[]=>definitions().map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:t.parameters??{type:'object',properties:{},additionalProperties:false}}}));
  const messages:ChatMessage[]=[{role:'system',content:conversationalSystemPrompt+'\n'+modePrompt+'\n本轮范围：'+JSON.stringify(current)+'\n当前任务记忆（仅目标、用户条件和对象引用，不是经营事实；needsReview时须重新核对对象）：'+JSON.stringify(memory)+'\n本轮任务组：'+groups.join('、')+'。缺少必要工具时可调用select_task_tools选择已有组，不能扩大角色或数据模式权限。\n可定位的历史对象（最近优先；冻结结果不能当作本轮事实）：'+previousObjects},...groundedConversationHistory(history.filter(m=>m.runId!==run.id),previous),{role:'user',content:execution.message}];
  const facts:AgentFactVO[]=[],seenCalls=new Set<string>();let count=0,repairing=false,inputOffset=0,modelCalls=0,recoveryUsed=false,completionNudges=0;let offeredNames:string[]=[];
  const runtimeStep=run.steps.find(s=>s.id==='context'&&s.tool==='resolve_context');
  if(runtimeStep){runtimeStep.runtime={...runtimeStep.runtime,engineVersion:'business-agent-v3',model:process.env.CHAT_MODEL??null,promptVersion:'evidence-complete-v5',recordedAt:new Date().toISOString(),taskMemory:memory,taskRouting:{...routing,switches:0,selectedToolNames:definitions().map(t=>t.name),history:[]},input:{version:'agent-input-v1',tools:structuredClone(modelTools()),rounds:[]}};}
  const freeze=async()=>{if(!this.ports.evidenceFingerprint)return undefined;return {version:'agent-evidence-v1',datasetId:current.datasetId,scopeKey:evidenceScopeKey(current),dataFingerprint:await this.ports.evidenceFingerprint(actor,current),knowledgeVersions:run.evidence.filter(e=>e.kind==='knowledge').map(e=>({sourceId:e.sourceId,version:e.version})),frozenAt:new Date().toISOString()} satisfies AgentFrozenEvidence;};
  while(modelCalls<6){
   check();
   const round=modelCalls;
   const finalizing=round===5;
   messages.push({role:'system',content:'本轮当前范围：'+JSON.stringify(current)+'\n'+conversationalFactReferencePrompt(facts)+'\n'+conversationalBindingPrompt(facts,current,run.proposals)+(finalizing?'\n工具预算即将结束，请回答现有结果或提出澄清问题。'+conversationalAnswerPrompt:'')});
   const requestModel=async(retryOfRound?:number)=>{
    check();const actualRound=modelCalls++;
    const tools=repairing||finalizing?[]:modelTools();
    offeredNames=tools.map(t=>t.function.name);
    if(runtimeStep?.runtime?.input){runtimeStep.runtime.input.rounds.push({round:actualRound,messages:structuredClone(messages.slice(inputOffset)),usesTools:!repairing&&!finalizing,json:repairing||finalizing,toolNames:tools.map(t=>t.function.name),...(retryOfRound!==undefined?{retryOfRound}:{})});inputOffset=messages.length;await this.ports.repository.save(actor,run);check();}
    return this.ports.model.chat(messages,tools,{signal,...(repairing||finalizing?{json:true}:{})});
   };
   let response:ChatCompletionVO;
   try{response=await requestModel();}catch(error){
    const httpStatus=recoverableModelStatus(error);
    if(httpStatus===undefined||recoveryUsed||modelCalls>=5||signal.aborted||Date.parse(execution.deadlineAt)-Date.now()<=modelRecoveryDelayMs)throw error;
    recoveryUsed=true;
    if(runtimeStep?.runtime)runtimeStep.runtime.recovery={status:'waiting',httpStatus,retryAt:new Date(Date.now()+modelRecoveryDelayMs).toISOString(),round:modelCalls};
    await this.ports.repository.save(actor,run);
    try{
     await waitForModelRecovery(signal);check();
     // 仅重发尚未返回的模型请求，已完成的工具及草稿不重新执行。
     response=await requestModel(modelCalls-1);
     if(runtimeStep?.runtime?.recovery)runtimeStep.runtime.recovery.status='recovered';
     await this.ports.repository.save(actor,run);
    }catch(recoveryError){
     if(runtimeStep?.runtime?.recovery)runtimeStep.runtime.recovery.status='failed';
     if(!signal.aborted)await this.ports.repository.save(actor,run);
     throw recoveryError;
    }
   }
   check();
   const calls=response.message.tool_calls??[];
   if((repairing||finalizing)&&calls.length)throw new AgentError('INVALID_ANSWER','回答阶段不能再次调用工具',502);
   if(!calls.length){
    const required=mode==='operations'&&routing.intent!=='guidance'?requiredAnalysisQueries(execution.message,current):[];
    const missing=missingAnalysisQueries(required,run);
    if(missing.length){
     if(!repairing&&!finalizing&&modelCalls<5&&completionNudges<2){completionNudges++;messages.push({role:'assistant',content:response.message.content},{role:'user',content:'本轮必要查询尚未完成：'+JSON.stringify(missing)+'。先调用这些已授权只读工具，不要直接返回最终分析。历史回答和总指标里的文字不能代替维度查询。缺少工具时可用select_task_tools选择analysis组；不要重复已完成步骤或执行写入。'});continue;}
     throw new AgentError('INCOMPLETE_ANALYSIS','必要的指标或维度查询尚未完成，请重新查询',502);
    }
    try{
     run.answer=buildConversationalAnswer(response.message.content,facts,current,run.proposals);
     const kind=run.answer.kind??'analysis',hasWorkflowData=run.steps.some(s=>s.status==='completed'&&['query_decision_tasks','query_reports','query_alerts'].includes(s.tool)),hasData=hasWorkflowData||run.steps.some(s=>s.status==='completed'&&['query_metrics','query_metric_breakdown','query_profile','query_learning_metrics','query_financial_metrics','preview_tag_rule'].includes(s.tool));
     if(kind==='analysis'&&!hasData)throw new AgentError('NO_EVIDENCE','经营判断尚未查询数据，助手应先澄清或查询',502);
     if(finance&&kind==='analysis'&&!hasWorkflowData&&!run.steps.some(s=>s.tool==='query_financial_metrics'&&s.status==='completed'))throw new AgentError('NO_EVIDENCE','年度分析尚未查询财务依据',502);
     if(learning&&kind==='analysis'&&!run.steps.some(s=>s.tool==='query_learning_metrics'&&s.status==='completed'))throw new AgentError('NO_EVIDENCE','学习分析尚未查询数据依据',502);
     if(kind==='action'&&!run.actionPlan&&!run.proposals.length&&!run.steps.some(s=>s.tool==='save_knowledge_draft'&&s.status==='completed'))throw new AgentError('NO_ACTION','尚未准备可操作的结果',502);
    }catch(error){
     if(error instanceof AgentError&&runtimeStep?.runtime){runtimeStep.runtime.answerValidation=[...(runtimeStep.runtime.answerValidation??[]),{round:modelCalls-1,code:error.code,fields:conversationalValidationFields(error)}].slice(-2);await this.ports.repository.save(actor,run);}
     if(error instanceof AgentError&&['UNVERIFIED_NUMBER','INVALID_ANSWER','INVALID_EVIDENCE','NO_EVIDENCE','NO_ACTION'].includes(error.code)&&!repairing&&modelCalls<6){repairing=true;messages.push({role:'assistant',content:response.message.content},{role:'user',content:conversationalRepairPrompt(error,facts,current,run.proposals)});continue;}throw error;
    }
    if(run.proposals.some(p=>p.status==='draft'))run.answer.limitations.push('部分草稿尚未预览，请在标签工作台完成预览后发布。');
    run.status=run.proposals.some(p=>p.status!=='published')||pendingPlan(run)?'awaiting_confirmation':'completed';run.completedAt=new Date().toISOString();
    const updated=prepareTaskState(memory,current,undefined),selected=[...updated.selectedObjects];
    for(const p of run.proposals){const item={kind:'tag' as const,id:p.id,version:p.version,name:p.name};const at=selected.findIndex(o=>o.kind==='tag'&&o.id===p.id);if(at<0)selected.push(item);else selected[at]=item;}
    for(const s of run.actionPlan?.steps??[]){if(s.status!=='completed'||!s.result?.id)continue;const kind=s.kind==='save_segment'?'segment':s.kind==='create_decision_task'?'task':s.kind==='generate_report'?'report':null;if(kind)selected.push({kind,id:s.result.id,name:(s.result.label??s.title).slice(0,200)});}
    updated.selectedObjects=[...new Map(selected.map(o=>[o.kind+':'+o.id,o])).values()].slice(-8);updated.pendingQuestions=(run.answer.questions??[]).map(q=>q.prompt.slice(0,300)).slice(0,3);updated.revision=memoryRevision+1;updated.updatedAt=new Date().toISOString();
    if(run.proposals.some(p=>p.status==='awaiting_confirmation'||p.status==='published'))updated.needsReview=false;
    const stateUpdate:TaskStateUpdate={expectedRevision:memoryRevision,state:updated};
    if(!await this.ports.repository.finish(actor,run,['running'],stateUpdate))throw new AgentError('EXECUTION_ENDED','执行已结束，请刷新记录',409);return;
   }
   messages.push({role:'assistant',content:response.message.content,tool_calls:calls});
   for(const call of calls){
    check();if(++count>8)throw new AgentError('TOOL_LIMIT','本轮达到工具调用上限，请缩小问题范围',409);
    if(seenCalls.has(call.id))throw new AgentError('DUPLICATE_TOOL_CALL','工具调用编号重复，已停止执行',502);seenCalls.add(call.id);
    const step:AgentRunVO['steps'][number]={id:call.id,tool:call.function.name.slice(0,80),status:'pending',evidence:[],context:current};run.steps.push(step);await this.ports.repository.save(actor,run);check();
    let operationAttempted=false;
    try{
     let raw:unknown;try{if(call.function.arguments.length>20000)throw Error();raw=JSON.parse(call.function.arguments);}catch{throw new AgentError('INVALID_ARGUMENTS','模型工具参数不是有效JSON',400);}
     if(call.function.name!=='select_task_tools'){
      const definition=registry.definition(call.function.name);if(!definition)throw new AgentError('UNKNOWN_TOOL','模型请求了未授权工具',403);
      if(definition.mode==='propose'&&!['admin','operator'].includes(actor.role))throw new AgentError('FORBIDDEN_TOOL','当前角色不能准备业务操作',403);
      if(definition.status!=='ready')throw new AgentError('TOOL_UNAVAILABLE','请求的业务工具暂不可用',503);
     }
     assertAllowedTaskTool(call.function.name,offeredNames.map(name=>({name})));
     if(call.function.name==='select_task_tools'){
      const selection=selectTaskToolsSchema.parse(raw);if(++switches>2)throw new AgentError('TOOL_GROUP_LIMIT','本轮工具切换已达到上限，请明确一个任务后继续',409);
      groups=selection.groups;allowed=allowedTaskTools(registry,actor,groups,mode);step.status='completed';step.input={groups,reason:selection.reason??'按当前问题调整工具'};
      if(runtimeStep?.runtime?.taskRouting){runtimeStep.runtime.taskRouting.groups=groups;runtimeStep.runtime.taskRouting.switches=switches;runtimeStep.runtime.taskRouting.selectedToolNames=definitions().map(t=>t.name);runtimeStep.runtime.taskRouting.history?.push({round:modelCalls,groups,reason:selection.reason??'模型请求受控切换'});}
      if(runtimeStep?.runtime?.input){const schemas=new Map(runtimeStep.runtime.input.tools.map(t=>[(t as ChatToolDefinition).function.name,t]));for(const t of modelTools())schemas.set(t.function.name,t);runtimeStep.runtime.input.tools=[...schemas.values()];}
      await this.ports.repository.save(actor,run);messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify({groups,tools:allowed.map(t=>({name:t.name,description:t.description})),instruction:'后续调用只能使用服务器本轮提供的工具；正式操作仍须页面确认。'})});continue;
     }
     assertAllowedTaskTool(call.function.name,allowed);
     const input=registry.validateInput(call.function.name,raw);step.input=input as Record<string,unknown>;
     const beforeScopeKey=evidenceScopeKey(current);
     const beforeFingerprint=this.ports.evidenceFingerprint?await this.ports.evidenceFingerprint(actor,current):undefined;
     if(runtimeStep?.runtime&&beforeFingerprint){
      const frozen=runtimeStep.runtime.freeze;
      if(frozen&&facts.length&&frozen.dataFingerprint!==beforeFingerprint)throw new AgentError('BATCH_CHANGED','本轮数据依据已变化，请重新查询',409);
      if(!frozen||frozen.scopeKey!==evidenceScopeKey(current))runtimeStep.runtime.freeze={version:'agent-evidence-v1',datasetId:current.datasetId,scopeKey:evidenceScopeKey(current),dataFingerprint:beforeFingerprint,knowledgeVersions:[],frozenAt:new Date().toISOString()};
     }
     const context:ToolExecutionContext={actor,runId:run.id,toolCallId:call.id,datasetId:current.datasetId,signal,proposalIds:run.proposals.map(p=>p.id),sourceProposalIds:[...sourceProposalIds],recommendations:run.answer?.recommendations??previous.at(-1)?.answer?.recommendations,turnContext:current,changeScope:async rawScope=>{
      if(run.proposals.length||run.actionPlan)throw new AgentError('SCOPE_LOCKED','本轮已有草稿，请在下一轮调整范围',409);
      const candidate=learning?{...learningScopeSchema.parse(rawScope),organizationId:actor.organizationId}:finance?{...financeScopeSchema.parse(rawScope),organizationId:actor.organizationId}:{...analysisScopeSchema.parse(rawScope),organizationId:actor.organizationId,authorizedCampusIds:(current.scope as AuthorizedScope).authorizedCampusIds};
      const resolved=await this.resolveScope(actor,current.datasetId,candidate);
      current={datasetId:current.datasetId,scope:resolved};run.context=current;step.context=current;facts.splice(0);run.evidence=[];memory=prepareTaskState(memory,current,undefined);if(runtimeStep?.runtime)runtimeStep.runtime.freeze=await freeze();return current;
     }};
     const invoke=()=>{operationAttempted=true;return registry.execute(call.function.name,input,current.scope as never,context);};
     let result:CapabilityResult<unknown>;
     try{result=await invoke();}catch(error){const failure=safeAgentError(error);if(registry.definition(call.function.name)?.mode==='read'&&transientErrors.has(failure.code)&&!signal.aborted){check();result=await invoke();}else throw error;}check();
     if(result.status!=='ready'||!result.data)throw new AgentError('TOOL_UNAVAILABLE',result.message||'工具服务暂不可用',result.status==='not_implemented'?501:503);
     if(beforeFingerprint&&beforeScopeKey===evidenceScopeKey(current)&&this.ports.evidenceFingerprint&&await this.ports.evidenceFingerprint(actor,current)!==beforeFingerprint)throw new AgentError('BATCH_CHANGED','查询期间数据依据已变化，请重新查询',409);
     const payload=result.data as AgentToolPayload;
     if(!Array.isArray(payload.evidence)||!Array.isArray(payload.facts))throw new AgentError('INVALID_TOOL_RESULT','工具返回不符合约定',502);
     const modelFacts=payload.facts.map(({numerator:_numerator,denominator:_denominator,...fact})=>({...fact,...(fact.status!=='ready'?{value:null,displayValue:undefined}:{})}));
     const safeResult=JSON.stringify({result:payload.result,evidence:payload.evidence,facts:modelFacts});if(safeResult.length>60000)throw new AgentError('TOOL_RESULT_LIMIT','查询结果过大，请缩小统计范围',409);
     step.status='completed';step.evidence=payload.evidence;step.facts=payload.facts;facts.push(...payload.facts);run.evidence=uniqueEvidence([...run.evidence,...payload.evidence]);
     const visuals=boundedAgentVisualizations(payload.visualizations,payload.evidence).filter(visual=>visual.source.datasetId===current.datasetId&&visual.source.analysisType===mode&&taskScopeKey({datasetId:visual.source.datasetId,scope:{...visual.source.scope,organizationId:actor.organizationId,authorizedCampusIds:[]}})===taskScopeKey(current));
     if(visuals.length)step.visualizations=visuals;
     if(call.function.name==='query_tags')for(const p of ((payload.result as {proposals?:{id:string}[]}).proposals??[]))sourceProposalIds.add(p.id);
     if(payload.proposal){const index=run.proposals.findIndex(p=>p.id===payload.proposal!.id);if(index<0)run.proposals.push(payload.proposal);else run.proposals[index]=payload.proposal;}
     if(payload.actionPlan){step.actionPlan=payload.actionPlan;run.actionPlan=payload.actionPlan;}
     if(runtimeStep?.runtime?.freeze)runtimeStep.runtime.freeze.knowledgeVersions=run.evidence.filter(e=>e.kind==='knowledge').map(e=>({sourceId:e.sourceId,version:e.version}));
     await this.ports.repository.save(actor,run);check();messages.push({role:'tool',tool_call_id:call.id,content:safeResult});
    }catch(error){
     const failure=safeAgentError(error);step.status='failed';step.errorCode=failure.code;step.errorMessage=failure.message;if(!signal.aborted)await this.ports.repository.save(actor,run);
     if(fatalToolErrors.has(failure.code)||signal.aborted)throw failure;
     const mayCorrectArguments=!operationAttempted&&failure.code==='INVALID_ARGUMENTS';
     messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify({status:'error',errorCode:failure.code,message:failure.message,operationAttempted,mayCorrectArguments,retryable:registry.definition(call.function.name)?.mode==='read'||mayCorrectArguments,instruction:mayCorrectArguments?'参数校验未通过，业务操作尚未执行。可以按工具定义纠正参数并使用新的调用编号；不能声称已经保存或发布。':'请说明已有结果或询问用户；已经开始执行的写操作不得自动重试，不能声称失败操作已完成。'})});
    }
   }
  }
  throw new AgentError('ROUND_LIMIT','本轮达到执行轮数上限，请缩小问题范围',409);
 }
 async getRun(actor:AgentActor,id:string){
  assertActor(actor);const stored=await this.ports.repository.getRun(actor,id),run=stored.run;
  if(run.status==='running'&&Date.now()>=Date.parse(stored.deadlineAt)){
   run.status='failed';run.errorCode='EXECUTION_EXPIRED';run.errorMessage='执行中断或超过时限，请查看已有结果后重新提问';run.completedAt=new Date().toISOString();
   for(const step of run.steps)if(step.runtime?.recovery?.status==='waiting')step.runtime.recovery.status='failed';
   for(const step of run.steps)if(step.status==='pending'){step.status='failed';step.errorCode=run.errorCode;step.errorMessage=run.errorMessage;}
   if(!await this.ports.repository.finish(actor,run))return (await this.ports.repository.getRun(actor,id)).run;
  }return decorateRecovery(run);
 }
 listSessions(actor:AgentActor){assertActor(actor);return this.ports.repository.listSessions(actor);}
 async getSession(actor:AgentActor,id:string){assertActor(actor);const detail=await this.ports.repository.getSession(actor,id);detail.runs=await Promise.all(detail.runs.map(run=>run.status==='running'?this.getRun(actor,run.id):Promise.resolve(decorateRecovery(run))));return detail;}
 async confirm(raw:unknown,actor:AgentActor){
  assertWriter(actor);const input=agentConfirmationSchema.parse(raw);
  if(this.ports.confirmProposal)return this.ports.confirmProposal(actor,input);
  const stored=await this.ports.repository.getRun(actor,input.runId),run=stored.run,context=run.context??{datasetId:stored.session.datasetId,scope:stored.session.scope};
  if(isLearningScope(context.scope)||isFinanceScope(context.scope))throw new AgentError('FORBIDDEN_TOOL','当前分析模式不能发布经营标签',403);
  if(!['awaiting_confirmation','completed'].includes(run.status))throw new AgentError('INVALID_RUN_STATE','此执行没有可确认的草稿',409);
  const linked=run.proposals.find(p=>p.id===input.proposalId);
  if(!linked||linked.version!==input.version||linked.previewToken!==input.previewToken)throw new AgentError('STALE_CONFIRMATION','草稿版本或预览已变化，请重新预览后确认',409);
  const current=await this.ports.getTag(actor.organizationId,input.proposalId);
  if(current.datasetId!==context.datasetId||!sameScope(current.scope,context.scope))throw new AgentError('OUTSIDE_SCOPE','草稿不属于本轮冻结范围',409);
  const confirmed=await this.ports.confirmTag(actor.organizationId,actor.userId,input.proposalId,input.version,input.previewToken);
  run.proposals=run.proposals.map(p=>p.id===confirmed.id?proposalVO(confirmed):p);run.status=run.proposals.every(p=>p.status==='published')&&!pendingPlan(run)?'completed':'awaiting_confirmation';
  if(!await this.ports.repository.finish(actor,run,['awaiting_confirmation','completed']))return (await this.ports.repository.getRun(actor,run.id)).run;return run;
 }
}
function scopeFields(scope:AuthorizedAnalysisScope){
 return Object.fromEntries(Object.entries(scope).filter(([key])=>!['organizationId','authorizedCampusIds','observationCutoff'].includes(key)));
}
