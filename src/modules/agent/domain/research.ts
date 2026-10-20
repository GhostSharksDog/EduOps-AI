import type {AgentRunVO,StoredAgentRun,TaskRunComparison,AgentTaskComparison,AgentRuntimeVO} from '../contracts';
const canonical=(value:unknown):string=>JSON.stringify(normalize(value));
function normalize(value:unknown):unknown {
 if(Array.isArray(value))return value.every(v=>typeof v==='string'||typeof v==='number')?[...value].sort():value.map(normalize);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,normalize(v)]));
 return value;
}
const distinct=(values:string[])=>[...new Set(values)].sort();
export function identifyAgentVersion(run:AgentRunVO){
 const runtime=run.steps.find(s=>s.runtime)?.runtime;
 if(runtime?.engineVersion==='business-agent-v3')return {engine:'v3' as const,engineLabel:'第三版 · 任务协作Agent',versionSource:'explicit' as const,runtime};
 if(runtime?.engineVersion==='business-agent-v2')return {engine:'v2' as const,engineLabel:'新版 · 业务协作Agent',versionSource:'explicit' as const,runtime};
 if(runtime?.engineVersion==='business-agent-v1')return {engine:'v1' as const,engineLabel:'旧版 · 已记录版本',versionSource:'explicit' as const,runtime};
 if(run.steps.some(s=>s.id==='legacy-context'))return {engine:'v1' as const,engineLabel:'旧版 · 历史记录',versionSource:'compatible' as const,runtime:undefined};
 if(run.steps.some(s=>s.id==='context'&&s.tool==='resolve_context')&&run.answer?.kind)return {engine:'v2' as const,engineLabel:'新版 · 历史兼容识别',versionSource:'compatible' as const,runtime:undefined};
 if(!run.steps.some(s=>s.context)&&!run.answer?.kind)return {engine:'v1' as const,engineLabel:'旧版 · 历史结构',versionSource:'compatible' as const,runtime:undefined};
 return {engine:'unknown' as const,engineLabel:'版本未记录',versionSource:'missing' as const,runtime:undefined};
}
function hasInputs(runtime:AgentRuntimeVO|undefined){
 const input=runtime?.input;
 return input?.version==='agent-input-v1'&&input.rounds.length>0&&input.rounds.every((round,index)=>{
  if(!Array.isArray(round.messages))return false;
  if(runtime?.engineVersion==='business-agent-v3'&&(!Array.isArray(round.toolNames)||round.toolNames.some(name=>typeof name!=='string'||!name)||new Set(round.toolNames).size!==round.toolNames.length||(!round.usesTools&&round.toolNames.length>0)))return false;
  if(round.retryOfRound===undefined)return round.messages.length>0;
  const previous=input.rounds[index-1];
  return round.messages.length===0&&index>0&&round.round===index&&round.retryOfRound===index-1&&previous?.round===index-1&&round.usesTools===previous.usesTools&&round.json===previous.json&&(runtime?.engineVersion!=='business-agent-v3'||canonical(round.toolNames)===canonical(previous.toolNames));
 });
}
export function describeAgentTask(saved:StoredAgentRun,interactions:number|null):TaskRunComparison {
 const {run}=saved,version=identifyAgentVersion(run),context=run.context??null;
 const scoped=run.steps.filter(s=>!s.context||!context||canonical(s.context)===canonical(context));
 const tools=run.steps.filter(s=>!['resolve_context','restore_frozen_facts','select_task_tools'].includes(s.tool)),facts=scoped.flatMap(s=>s.facts??[]),byId=new Map(facts.map(f=>[f.id,f]));
 const evidence=[...scoped.flatMap(s=>s.evidence),...run.evidence.filter(e=>facts.some(f=>f.evidenceIds.includes(e.id)))];
 const evidenceIds=new Set(evidence.map(e=>e.id)),answerFacts=run.answer?.facts??[];
 const invalidFacts=answerFacts.filter(f=>{const actual=byId.get(f.id);return !actual||['value','unit','status','displayValue','numerator','denominator'].some(k=>canonical(f[k as keyof typeof f])!==canonical(actual[k as keyof typeof actual]));}).map(f=>f.id);
 const invalidEvidence=distinct([...facts,...answerFacts].flatMap(f=>f.evidenceIds.filter(id=>!evidenceIds.has(id))));
 const versions=(kind:'metric'|'knowledge')=>distinct(evidence.filter(e=>e.kind===kind&&e.sourceId&&e.version&&(kind==='knowledge'||e.sourceId===context?.datasetId)).map(e=>e.sourceId+'@'+e.version));
 const actionSteps=run.actionPlan?.steps??[],runtime=version.runtime,inputsRecorded=!!hasInputs(runtime),limitations:string[]=[],recovery=runtime?.recoveryOf?.kind==='interpretation';
 if(!context)limitations.push('缺少执行自身的冻结范围。');
 if(run.steps.some(s=>s.id==='legacy-context'))limitations.push('旧记录范围由历史会话补录，不等同于原始执行输入。');
 if(version.versionSource!=='explicit')limitations.push('版本按历史结构兼容识别，未记录显式引擎版本。');
 if(!runtime?.model)limitations.push('历史模型名称未记录，不从当前模型配置推测。');
 if(!inputsRecorded)limitations.push('实际模型输入未完整记录，不能纳入严格对照。');
 if(runtime?.engineVersion==='business-agent-v3'&&runtime.input?.rounds.some(round=>!Array.isArray(round.toolNames)))limitations.push('缺少逐轮实际工具清单，不能确认任务切组后的模型输入。');
 if(recovery)limitations.push('本次仅恢复冻结事实的模型解读，不重新执行业务工具，不能计作完整业务任务完成。');
 if(!facts.length)limitations.push('没有程序事实，数字一致性不适用。');
 if(!versions('metric').length)limitations.push('冻结数据批次或版本缺失。');
 if(scoped.some(s=>s.tool==='search_knowledge'&&s.status==='completed')&&!versions('knowledge').length)limitations.push('知识检索未保留来源版本，不能核对知识输入。');
 if(interactions===null)limitations.push('会话用户消息记录缺失，交互轮次未知。');
 if(!actionSteps.length)limitations.push('未准备正式业务操作计划；交流完成不能计为业务任务完成。');
 if(actionSteps.some(s=>s.status==='completed'&&!s.result?.id))limitations.push('部分已完成步骤缺少正式结果编号，不能认定操作闭环完成。');
 return {id:run.id,sessionId:run.sessionId,question:saved.message,startedAt:run.startedAt,status:run.status,engine:version.engine,engineLabel:version.engineLabel,versionSource:version.versionSource,executionKind:recovery?'interpretation_recovery':'task',toolSelectionCalls:run.steps.filter(s=>s.tool==='select_task_tools').length,
  context,contextSource:!context?'missing':run.steps.some(s=>s.id==='legacy-context')?'legacy':run.steps.some(s=>s.context)?'frozen':'missing',
  model:runtime?.model??null,promptVersion:runtime?.promptVersion??null,inputsRecorded,inputHash:runtime?.inputSummary?.sha256??null,modelCalls:inputsRecorded?runtime!.input!.rounds.length:null,interactions,
  tools:{attempted:tools.length,completed:tools.filter(s=>s.status==='completed').length,failed:tools.filter(s=>s.status==='failed').length,argumentErrors:tools.filter(s=>s.errorCode==='INVALID_ARGUMENTS').length,pending:tools.filter(s=>s.status==='pending').length},
  facts:{total:answerFacts.length,verified:answerFacts.length-invalidFacts.length,unknown:answerFacts.filter(f=>f.value===null&&f.displayValue===undefined||f.status!=='ready').length,invalidFactIds:invalidFacts,invalidEvidenceIds:invalidEvidence,consistent:answerFacts.length?invalidFacts.length===0&&invalidEvidence.length===0:null},
  dataVersions:versions('metric'),knowledgeVersions:versions('knowledge'),
  actions:{total:actionSteps.length,completed:actionSteps.filter(s=>s.status==='completed').length,failed:actionSteps.filter(s=>s.status==='failed').length,pending:actionSteps.filter(s=>!['completed','failed'].includes(s.status)).length,state:run.actionPlan?.status??null,formallyCompleted:recovery?null:actionSteps.length?run.actionPlan?.status==='completed'&&actionSteps.every(s=>s.status==='completed'&&!!s.result?.id):null},limitations,manualTaskCompletion:'pending'} as TaskRunComparison;
}
export function compareAgentTasks(old:TaskRunComparison,next:TaskRunComparison):AgentTaskComparison {
 const limitations:string[]=[];
 if(old.executionKind==='interpretation_recovery'||next.executionKind==='interpretation_recovery')limitations.push('解读恢复运行不是完整业务任务，不能与端到端任务作严格效率或完成率对照。');
 if(old.question.trim().replace(/\s+/g,' ')!==next.question.trim().replace(/\s+/g,' '))limitations.push('用户问题不同，只能比较各自执行表现。');
 if(!old.context||!next.context||canonical(old.context)!==canonical(next.context))limitations.push('数据集或冻结范围不一致或缺失。');
 if(!old.dataVersions.length||!next.dataVersions.length||canonical(old.dataVersions)!==canonical(next.dataVersions))limitations.push('冻结数据版本不一致或缺失。');
 if(canonical(old.knowledgeVersions)!==canonical(next.knowledgeVersions))limitations.push('实际检索知识来源或版本不同。');
 if(!old.inputsRecorded||!next.inputsRecorded)limitations.push('至少一份样本缺少实际模型输入。');
 if(!old.model||!next.model)limitations.push('至少一份样本缺少模型名称记录。');
 if(old.versionSource!=='explicit'||next.versionSource!=='explicit')limitations.push('至少一份样本没有显式引擎版本记录。');
 if(old.contextSource!=='frozen'||next.contextSource!=='frozen')limitations.push('至少一份样本不是原始冻结范围。');
 if(old.limitations.some(v=>v.includes('知识检索未保留'))||next.limitations.some(v=>v.includes('知识检索未保留')))limitations.push('知识输入版本不完整。');
 if(old.engine===next.engine)limitations.push('所选两次运行属于相同版本，不用于推断旧新版改进。');
 return {strict:limitations.length===0,limitations:[...limitations,'工具成功表示业务调用正常，不代表回答语义正确；人工任务完成与体验评分仍待评价。'],old,new:next,manualEvaluation:'pending'};
}
