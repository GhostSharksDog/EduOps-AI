import type {AgentFactVO,AgentQuestionVO,AgentRunVO,AgentTurnContext} from '../contracts';
import type {AnalysisScope,AuthorizedAnalysisScope,FinanceScope,LearningScope} from '@/shared/contracts/analysis';

export type AgentAnalysisMode='operations'|'learning'|'finance';
export type AgentScopeStatus='current'|'different'|'unknown';
export interface ClientAgentContext {datasetId:string;scope:AnalysisScope|LearningScope|FinanceScope|AuthorizedAnalysisScope;}
/** Public filter identity only. This is a UI comparison, never an authorization or evidence fingerprint. */
export function clientContextKey(context:ClientAgentContext):string {
 const scope=context.scope;
 if('years' in scope)return JSON.stringify({datasetId:context.datasetId,mode:'finance',years:[...scope.years].sort((a,b)=>a-b)});
 if('courseKeys' in scope)return JSON.stringify({datasetId:context.datasetId,mode:'learning',courseKeys:[...scope.courseKeys].sort(),relativeDayStart:scope.relativeDayStart??null,relativeDayEnd:scope.relativeDayEnd??null});
 return JSON.stringify({datasetId:context.datasetId,mode:'operations',startDate:scope.startDate,endDate:scope.endDate,campusIds:[...scope.campusIds].sort(),courseIds:[...scope.courseIds].sort(),channelIds:[...scope.channelIds].sort(),dataCutoff:scope.dataCutoff??null});
}
export function contextScopeStatus(current:ClientAgentContext|null|undefined,selected:ClientAgentContext|null|undefined):AgentScopeStatus {
 return !current||!selected?'unknown':clientContextKey(current)===clientContextKey(selected)?'current':'different';
}
interface ContextActionBase {id:string;label:string;description?:string;}
/** These actions navigate or prepare a conversation; none executes a business write. */
export type AgentContextAction=
 | (ContextActionBase&{kind:'message';message:string;runId:string;sendImmediately?:boolean})
 | (ContextActionBase&{kind:'continue_scope';context:AgentTurnContext;runId:string})
 | (ContextActionBase&{kind:'open_operations'|'open_evidence';runId:string})
 | (ContextActionBase&{kind:'open_saved_result';runId:string;href:string})
 | (ContextActionBase&{kind:'retry_interpretation';runId:string});
export interface AgentContextActionsInput {
 run:AgentRunVO;question?:string;mode:AgentAnalysisMode;writable:boolean;canContinue:boolean;
 /** Compare the selected answer's frozen source/range with the next turn, not the session's original scope. */
 scopeStatus:AgentScopeStatus;now?:number;
}

export function safeAgentResultHref(value:string):string|null {
 // Links originate in saved business results. Reject protocol-relative, encoded and traversal paths as well.
 if(!value.startsWith('/dashboard/')||/[\\\u0000-\u0020]/.test(value))return null;
 try {const path=decodeURIComponent(value.split(/[?#]/)[0]);if(path.includes('..')||/[\\\u0000-\u0020]/.test(path)||path.startsWith('//'))return null;return value;}catch{return null;}
}
function hasEvidence(run:AgentRunVO){return run.evidence.length>0||run.answer?.facts.length||run.steps.some(step=>step.evidence.length||step.facts?.length);}
function isPlanExpired(run:AgentRunVO,now:number){
 const plan=run.actionPlan;if(!plan||plan.status==='completed')return false;
 const created=Date.parse(plan.createdAt),explicit=plan.expiresAt?Date.parse(plan.expiresAt):Infinity;
 const expiry=Math.min(created+30*60*1000,explicit);
 const previewExpiry=plan.preview?Date.parse(plan.preview.expiresAt):Infinity;
 return !Number.isFinite(expiry)||now>=expiry||!!plan.preview&&plan.steps.some(step=>step.kind==='publish_tag'&&step.status!=='completed')&&(!Number.isFinite(previewExpiry)||now>=previewExpiry);
}
const evidenceAction=(runId:string):AgentContextAction=>({id:'evidence',kind:'open_evidence',runId,label:'查看数据依据'});
const operationsAction=(runId:string,label='核对操作计划'):AgentContextAction=>({id:'operations',kind:'open_operations',runId,label});

/** Derive at most two actions from actual returned state; never infer that a suggestion has been executed. */
export function getContextActions(input:AgentContextActionsInput):AgentContextAction[] {
 const {run,mode,writable,canContinue,scopeStatus}=input,now=input.now??Date.now();
 if(run.status==='running'||run.status==='queued')return [];
 const operations=!!run.actionPlan||run.proposals.length>0,evidence=!!hasEvidence(run);
 if(scopeStatus!=='current'){
  const result:AgentContextAction[]=[];
  if(canContinue&&run.context)result.push({id:'continue-scope',kind:'continue_scope',runId:run.id,context:run.context,label:'按该回答范围继续',description:'先切回这条回答的数据来源和统计范围，再继续提问。'});
  if(operations)result.push(operationsAction(run.id,'查看原操作计划'));else if(evidence)result.push(evidenceAction(run.id));
  return result.slice(0,2);
 }
 if(run.status==='failed'){
  const result:AgentContextAction[]=[];
  if(canContinue&&run.recoveryEligibility?.eligible)result.push({id:'retry-interpretation',kind:'retry_interpretation',runId:run.id,label:'仅重试解读',description:'复用原冻结依据，不重复查询或创建对象。'});
  if(operations)result.push(operationsAction(run.id,'查看保留的操作'));else if(evidence)result.push(evidenceAction(run.id));
  return result.slice(0,2);
 }
 if(run.answer?.questions?.length)return [];
 if(run.actionPlan){
  const plan=run.actionPlan;
  if(plan.status==='completed')return plan.steps.filter(step=>step.status==='completed'&&step.result&&safeAgentResultHref(step.result.url)).map(step=>({id:'result-'+step.id,kind:'open_saved_result' as const,runId:run.id,label:step.kind==='save_segment'?'查看已保存人群':step.kind==='create_decision_task'?'查看跟进任务':step.kind==='generate_report'?'阅读报告':'查看已发布标签',href:step.result!.url})).sort((a,b)=>Number(b.label==='查看已保存人群')-Number(a.label==='查看已保存人群')).slice(0,2);
  const expired=isPlanExpired(run,now),result:AgentContextAction[]=[operationsAction(run.id,expired||plan.status==='invalid'?'查看需重新准备的计划':plan.status==='partially_failed'?'查看待恢复步骤':plan.status==='executing'?'查看执行进度':'核对操作计划')];
  if(canContinue&&writable&&(expired||plan.status==='invalid'))result.push({id:'prepare-again',kind:'message',runId:run.id,label:'重新准备计划',message:'请根据本轮操作计划重新核对规则和当前数据，重新准备必要的草稿及覆盖预览，再给我新的操作计划核对。保留已完成对象，不重复创建；正式操作仍等待页面确认。'});
  return result;
 }
 if(mode==='operations'&&run.proposals.length){
  const proposal=run.proposals.find(p=>p.status!=='published')??run.proposals[run.proposals.length-1];
  if(proposal.status==='draft'&&canContinue&&writable)return [{id:'preview-proposal',kind:'message',runId:run.id,label:'预览这条规则的名单',message:'请预览本轮标签草稿“'+proposal.name+'”（版本 '+proposal.version+'）的覆盖名单，说明命中和未知人数；只做预览，不发布或保存人群。'},operationsAction(run.id,'查看规则草稿')];
  return [operationsAction(run.id,proposal.status==='published'?'查看标签与人群入口':'核对规则与覆盖范围'),...(evidence?[evidenceAction(run.id)]:[])].slice(0,2);
 }
 if(!canContinue)return evidence?[evidenceAction(run.id)]:[];
 const completed=new Set(run.steps.filter(step=>step.status==='completed').map(step=>step.tool));
 const question=input.question??'',hasExplicitTopic=metricTopics.some(([topic])=>topic.test(question));
 const labels=hasExplicitTopic?question:selectKeyFacts([...(run.answer?.facts??[]),...run.steps.flatMap(step=>step.facts??[])],question,1).map(fact=>fact.label+' '+fact.id).join(' ');
 const makeMessage=(id:string,label:string,message:string):AgentContextAction=>({id,kind:'message',runId:run.id,label,message});
 let next:AgentContextAction|undefined;
 if(mode==='learning'&&completed.has('query_learning_metrics'))next=makeMessage('learning-detail','查看低活跃课程批次','请根据本轮已查询的学习结果，说明哪些课程批次活跃度较低，列出数据依据和未知情况；不把学习点击解释为出勤签到。');
 else if(mode==='finance'&&completed.has('query_financial_metrics'))next=writable?makeMessage('finance-review','准备费用核查事项','请根据本轮年度财务结果准备费用核查任务，缺少负责人、期限或复核方法时先向我询问，再给操作计划核对，不直接建立任务。'):evidenceAction(run.id);
 else if(mode==='operations'&&evidence){
  if(/出勤|缺勤|签到|attendance/i.test(labels)){
   const courseBreakdown=run.steps.some(step=>step.status==='completed'&&step.tool==='query_metric_breakdown'&&step.input?.dimension==='course');
   next=courseBreakdown&&writable?makeMessage('attendance-proposal','预览需关注的学员','请根据本轮课程出勤分析准备运营标签草稿，并预览覆盖和未知人数；缺少规则参数时先向我确认，不发布或保存人群。'):makeMessage('attendance-breakdown','比较课程出勤','请按课程拆解本轮出勤情况，列出有数据依据的现状及样本规模；若有完整对比期再比较变化，没有对比依据时不判断下降，原因仅列为待验证事项。');
  }else if(/招生|转化|线索|admission|conversion/i.test(labels))next=makeMessage('admission-channel','查看招生渠道差异','请按渠道拆解本轮招生转化，保留同一线索获取批次和完整观察窗口，未知来源及待观察数量单独说明。');
  else if(/续费|到期|renewal/i.test(labels))next=makeMessage('renewal-course','比较课程续费','请按课程拆解本轮续费情况，区分已完成观察和待观察对象，说明样本规模及待核查事项。');
  else if(/客诉|投诉|退款|退费|complaint|refund/i.test(labels))next=makeMessage('service-course','查看客诉退款分布','请按课程拆解本轮客诉和已完成退款的分布，分别保留数量与金额口径，不推断尚未记录的处理原因。');
 }
 const result:AgentContextAction[]=[];
 if(next)result.push(next);if(evidence&&next?.kind!=='open_evidence')result.push(evidenceAction(run.id));
 return result.slice(0,2);
}

/** Match question language to returned metric codes; no values are computed or rewritten here. */
const metricTopics:[RegExp,RegExp][]=[
 [/出勤|缺勤|签到|attendance/i,/attendance|出勤|缺勤|签到/i],
 [/招生|转化|线索|admission|conversion/i,/admission_conversion|招生|转化/i],
 [/续费|到期|renewal/i,/renewal_rate|续费/i],
 [/留存|流失|retention/i,/retention_rate|留存/i],
 [/满班|班额|class_fill/i,/class_fill_rate|满班|席位贡献/i],
 [/课耗|课时|hours/i,/hours_progress|课耗|课时/i],
 [/客诉|投诉|complaint/i,/complaint_count|客诉/i],
 [/退款|退费|refund/i,/refund_amount|退款/i],
 [/收入|营收|revenue/i,/(?:^|:)revenue(?:$|:)|营业收入/i],
 [/成本|cost/i,/(?:^|:)cost(?:$|:)|营业成本/i],
 [/毛利|gross/i,/grossProfit|grossMargin|毛利/i],
 [/销售费用|selling/i,/selling|销售费用/i],
 [/管理费用|administrative/i,/administrative|管理费用/i],
 [/活跃|点击|学习活动|active|click/i,/active|click|activity|活跃|点击|学习活动/i],
 [/测评|得分|分数|score/i,/assessment|score|测评|分数/i],
 [/退出|unregister|withdraw/i,/unregister|withdraw|退出/i],
 [/人数|学员|student/i,/student|members|学员人数/i],
];
export function selectKeyFacts(facts:readonly AgentFactVO[],question='',maximum=3):AgentFactVO[] {
 const limit=Math.max(0,Math.min(3,Math.trunc(maximum)));if(!limit)return [];
 const unique=[...new Map(facts.map(fact=>[fact.id,fact])).values()];
 const annualYears=unique.map(fact=>Number(fact.id.match(/(?:^|:)(20\d{2})(?=:)/)?.[1])).filter(Number.isFinite),latestAnnualYear=annualYears.length?Math.max(...annualYears):undefined;
 const relevant=metricTopics.filter(([topic])=>topic.test(question)).map(([,matcher])=>matcher);
 const comparisons=/变化|下降|上升|增加|减少|对比|比较|同比|环比|趋势/.test(question);
 const ranked=unique.map((fact,index)=>{
  const text=fact.id+' '+fact.label,denominator=/(?:^|:)(?:numerator|denominator)$|已识别分子|统计分母/.test(text),period=/:comparison:period$/.test(fact.id),previous=/:previous:|对比期 /.test(text),change=/:change:|周期变化|同比变化/.test(text),trend=/:period:/.test(fact.id),technical=/:version$|:steps$|:pending_steps$|计划步骤数|计划版本/.test(text);
  let score=40+(fact.status==='ready'?8:4);
  if(relevant.length)score+=relevant.some(pattern=>pattern.test(text))?100:-80;
  if(denominator)score-=160;if(period)score-=140;if(technical)score-=120;
  if(!previous&&!change&&!trend)score+=22;
  const annualYear=Number(fact.id.match(/(?:^|:)(20\d{2})(?=:)/)?.[1]);
  if(latestAnnualYear!==undefined&&Number.isFinite(annualYear))score+=annualYear===latestAnnualYear?24:annualYear===latestAnnualYear-1?-8:-24;
  if(previous)score+=comparisons?5:-22;if(change)score+=comparisons?10:-15;if(trend)score-=35;
  return {fact,index,score,auxiliary:denominator||period||technical};
 }).filter(item=>!item.auxiliary).sort((a,b)=>b.score-a.score||a.index-b.index);
 return ranked.slice(0,limit).map(item=>item.fact);
}

export interface ClarificationSelection {questionId:string;value:string;}
/** Conservative UI convenience only; actual permissions and confirmation remain enforced server-side. */
export function canSendClarificationImmediately(value:string):boolean {
 return !!value.trim()&&!/发布|保存|创建|新建|建立|生成|删除|清空|执行|确认|同意|批准|授权|导入|重试|审核|索引/.test(value);
}
/** A choice is user intent to clarify, never a metric or a confirmation credential. */
export function buildClarificationReply(questions:readonly AgentQuestionVO[],selections:readonly ClarificationSelection[]):string|null {
 if(!questions.length||questions.length>3||new Set(questions.map(question=>question.id)).size!==questions.length)return null;
 const selected=new Map(selections.map(selection=>[selection.questionId,selection.value]));
 if(selected.size!==selections.length||selected.size!==questions.length)return null;
 const parts:string[]=[];
 for(const question of questions){
  const value=selected.get(question.id)?.trim();if(!value||value.length>1000)return null;
  if(question.options?.length&&!question.options.some(option=>option.value===value))return null;
  parts.push(question.prompt+'：'+value);
 }
 return '补充本轮问题的信息：\n'+parts.join('\n');
}
