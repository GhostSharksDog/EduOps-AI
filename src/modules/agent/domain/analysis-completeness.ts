import type {AgentAnswerVO,AgentMessageVO,AgentRunVO,AgentTurnContext} from '../contracts';
import {evidenceScopeKey} from './task-state';
export interface RequiredAnalysisQuery {tool:'query_metrics'|'query_metric_breakdown';input:{metricCodes?:string[];dimension?:'campus'|'course'|'channel'};label:string;}
/** Explicit dimension requests require fresh tool evidence, not a claim in model prose. */
export function requiredAnalysisQueries(question:string,context:AgentTurnContext):RequiredAnalysisQuery[]{
 if('years' in context.scope||'courseKeys' in context.scope)return [];
 const text=question.split(/[，,。！？;；\n]/).filter(clause=>!/(?:不要|不用|无需|不必|不要求).*(?:拆解|细分|比较|对比|课程|校区|渠道)/.test(clause)).join('，');
 const dimensions=([['course','课程'],['campus','校区'],['channel','渠道']] as const).filter(([,name])=>new RegExp('(?:拆解|细分|分布|受影响|差异).{0,18}'+name+'|'+name+'.{0,10}(?:拆解|对比|比较|差异|分布)|(?:按|各|不同|哪些).{0,5}'+name).test(text));
 if(!dimensions.length)return [];
 const codes=([['attendance_rate',/出勤|缺勤|签到/],['renewal_rate',/续费/],['admission_conversion',/招生|转化|线索/],['retention_rate',/留存/],['class_fill_rate',/满班|班额/],['hours_progress',/课耗|课时/],['complaint_count',/客诉|投诉/],['refund_amount',/退款|退费/]] as const).filter(([,matcher])=>matcher.test(text)).map(([code])=>code);
 const metricCodes=codes.length?[...codes]:undefined;
 return [{tool:'query_metrics',input:{...(metricCodes?{metricCodes}:{})},label:'本轮指标查询'},...dimensions.map(([dimension,name])=>({tool:'query_metric_breakdown' as const,input:{dimension,...(metricCodes?{metricCodes}:{})},label:name+'拆解'}))];
}
export function missingAnalysisQueries(required:RequiredAnalysisQuery[],run:AgentRunVO):RequiredAnalysisQuery[]{
 const current=run.context?evidenceScopeKey(run.context):undefined;
 return required.filter(query=>!run.steps.some(step=>step.status==='completed'&&step.tool===query.tool&&(!step.context||current===evidenceScopeKey(step.context))&&(!query.input.dimension||step.input?.dimension===query.input.dimension)&&(!query.input.metricCodes?.length||!Array.isArray(step.input?.metricCodes)||query.input.metricCodes.every(code=>(step.input!.metricCodes as string[]).includes(code)))));
}
export function savedAnalysisQuestion(run:AgentRunVO):string{
 const messages=run.steps.find(step=>step.id==='context')?.runtime?.input?.rounds[0]?.messages??[];
 const user=messages.findLast((value):value is {role:'user';content:string}=>!!value&&typeof value==='object'&&(value as {role?:unknown}).role==='user'&&typeof (value as {content?:unknown}).content==='string');
 return user?.content.slice(0,4000)??'';
}
/** Preserve clarification intent without feeding historical business numbers back as current facts. */
export function groundedConversationHistory(history:AgentMessageVO[],runs:AgentRunVO[]):{role:'user'|'assistant';content:string}[]{
 const saved=new Map(runs.map(run=>[run.id,run]));
 return history.map(message=>{
  if(message.role==='user')return {role:'user' as const,content:message.content.slice(0,4000)};
  const run=message.runId?saved.get(message.runId):undefined;
  return {role:'assistant' as const,content:JSON.stringify({type:'historical_response',status:run?.status??'saved',kind:run?.answer?.kind??'unknown',questions:run?.answer?.questions??[],instruction:'历史回答已保存，仅用于理解追问。旧数字和旧结论不是本轮事实；按本轮范围重新调用工具。'})};
 });
}
const partialReasons=new Set(['INCOMPLETE_ANALYSIS','UNVERIFIED_NUMBER','INVALID_ANSWER','INVALID_EVIDENCE','NO_EVIDENCE','MODEL_NETWORK','MODEL_HTTP','MODEL_TIMEOUT','INVALID_CHAT','INVALID_JSON','EMPTY_CHAT','EXECUTION_TIMEOUT','EXECUTION_EXPIRED','ROUND_LIMIT']);
export function completedScopeFacts(run:AgentRunVO){
 if(!run.context)return [];
 const current=evidenceScopeKey(run.context),steps=run.steps.filter(step=>step.status==='completed'&&(!step.context||evidenceScopeKey(step.context)===current));
 const evidence=new Set(steps.flatMap(step=>step.evidence).map(item=>item.id));
 return [...new Map(steps.flatMap(step=>step.facts??[]).filter(fact=>fact.evidenceIds.length>0&&fact.evidenceIds.every(id=>evidence.has(id))).map(fact=>[fact.id,fact])).values()].slice(0,80);
}
/** Only program facts survive rejection; never strip digits from untrusted prose. */
export function factsOnlyAnswer(run:AgentRunVO,reasonCode:string,missingTools:string[]=[]):AgentAnswerVO|null{
 if(!partialReasons.has(reasonCode)||!run.context)return null;
 const facts=completedScopeFacts(run);
 if(!facts.length)return null;
 return {kind:'analysis',summary:'已查询的数据可在事实卡和图表中核对；本轮完整分析尚未完成。',facts,hypotheses:[],recommendations:[],limitations:[missingTools.length?'尚缺必要的维度查询，请重新查询以完成分析。':'未展示没有通过依据核对的模型结论、原因或建议。'],partial:{kind:'facts_only',reasonCode,...(missingTools.length?{missingTools}:{})}};
}
