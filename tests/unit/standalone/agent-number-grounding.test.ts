import {describe,expect,it} from 'vitest';
import type {AgentFactVO,AgentTurnContext} from '@/modules/agent/contracts';
import {buildConversationalAnswer,conversationalBindingPrompt,conversationalValidationFields,ConversationalNumberError,conversationalRepairPrompt} from '@/modules/agent/domain/conversation';
import {AgentError} from '@/modules/agent/domain/errors';

const context:AgentTurnContext={datasetId:'fixture-dataset',scope:{organizationId:'fixture-org',authorizedCampusIds:[],startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:[],channelIds:[],dataCutoff:'2026-08-31T15:59:59.999Z'}};
const fact=(id:string,label='出勤率',value:number|null=75,patch:Partial<AgentFactVO>={}):AgentFactVO=>({id,label,value,unit:'%',status:'ready',evidenceIds:['fixture-evidence'],...patch});
const period=(patch:Partial<AgentFactVO>={})=>fact('query:comparison:period','对比期',null,{unit:'',displayValue:'2026-07-01 至 2026-07-31',...patch});
type AnswerPatch={factIds?:string[];hypotheses?:string[];recommendations?:string[];limitations?:string[];questions?:{id:string;prompt:string;options?:{label:string;value:string}[]}[]};
const answer=(summary:string,patch:AnswerPatch={})=>JSON.stringify({kind:'analysis',summary,factIds:[],hypotheses:[],recommendations:[],limitations:[],...patch});
function rejected(summary:string,facts:AgentFactVO[]=[],patch:AnswerPatch={},selectedContext=context){expect(()=>buildConversationalAnswer(answer(summary,patch),facts,selectedContext)).toThrow(ConversationalNumberError);}

describe('有明确来源的统计周期',()=>{
 it('用户实际场景：本期8月、对比7月及建议做一次到场提醒可以正常解读',()=>{
  const facts=[fact('query:attendance_rate'),fact('query:previous:attendance_rate','对比期 出勤率',82),period()];
  const result=buildConversationalAnswer(answer('8月出勤低于7月，请先核对签到完整性。',{factIds:facts.map(item=>item.id),recommendations:['做一次到场提醒，之后核对签到记录是否完整。']}),facts,context);
  expect(result.summary).toBe('8月出勤低于7月，请先核对签到完整性。');
  expect(result.recommendations).toEqual(['做一次到场提醒，之后核对签到记录是否完整。']);
  expect(result.facts.map(item=>item.id)).toEqual(facts.map(item=>item.id));
 });
 it('当前scope的明确年份、月份及边界日期可正常描述，不必当作经营数值',()=>{
  expect(buildConversationalAnswer(answer('2026年8月的统计范围为2026-08-01至2026-08-31。'),[],context).summary).toBe('2026年8月的统计范围为2026-08-01至2026-08-31。');
 });
 it('没有完成的对比期事实时不允许声称7月属于已知统计范围',()=>{
  rejected('8月与7月的结果需要继续核查。',[fact('query:attendance_rate')]);
  rejected('当前与2026年7月相比有所不同。',[]);
 });
 it('对比期须ready且有证据，历史残留displayValue不能提供月份依据',()=>{
  for(const comparison of [period({status:'insufficient_data'}),period({evidenceIds:[]}),period({id:'query:unverified-period-caption'})])rejected('需要核对7月的情况。',[comparison]);
 });
 it('已完成趋势事实的YYYY-MM可提供该月份，缺失或未完成趋势不行',()=>{
  const july=fact('query:period:2026-07','2026-07出勤率',82);
  expect(buildConversationalAnswer(answer('7月与8月的出勤情况需要一起核对。',{factIds:[july.id]}),[july],context).summary).toContain('7月与8月');
  rejected('需要核对7月。',[{...july,status:'insufficient_data',value:null}]);
  rejected('需要核对7月。',[{...july,evidenceIds:[]}]);
 });
 it('未知月份、无依据年份和周期之外日期仍然拒绝',()=>{
  for(const summary of ['9月情况已经明确。','2024年8月情况已经明确。','统计范围到2026-09-01。'])rejected(summary,[period()]);
 });
 it('跨年存在同一个月份时，裸月份有歧义，必须写明已知年份',()=>{
  const prior=period({displayValue:'2025-08-01 至 2025-08-31'});
  rejected('8月的数据需要核对。',[prior]);
  expect(buildConversationalAnswer(answer('2026年8月与2025年8月来自不同年度。',{factIds:[prior.id]}),[prior],context).summary).toBe('2026年8月与2025年8月来自不同年度。');
 });
 it('数据集日期编号、课程编号和知识制度数字不会因已知周期而获豁免',()=>{
  for(const summary of ['当前数据集20261009已经查到。','课程7的情况需要核对。','本机构制度规定30天观察。','知识口径规定出勤80%为标准。'])rejected(summary,[period(),fact('query:attendance_rate')]);
 });
});

describe('短事实引用保持对象和值的一致性',()=>{
 it('f1与label1分别取本轮同一事实的值和名称，自动附上事实引用',()=>{
  const source=fact('actual-call:course:1:attendance_rate','2026秋季课程1 出勤率',75);
  const result=buildConversationalAnswer(answer('{{label1}}为{{f1}}，请核对原始签到。'),[source],context);
  expect(result.summary).toBe('2026秋季课程1 出勤率为75%，请核对原始签到。');expect(result.facts).toEqual([source]);
 });
 it('旧full引用与短引用可混用，相同事实不会重复列卡',()=>{
  const source=fact('call:attendance_rate'),result=buildConversationalAnswer(answer('本期{{f1}}，原引用{{fact:call:attendance_rate}}。',{factIds:[source.id]}),[source],context);
  expect(result.summary).toBe('本期75%，原引用75%。');expect(result.facts).toEqual([source]);
 });
 it('短别名只按去重后的事实顺序分配，不按模型factIds选择顺序重新编号',()=>{
  const first=fact('first','课程甲 出勤率',75),second=fact('second','课程乙 出勤率',82),third=fact('third','续费率',60),facts=[first,second,first];
  const result=buildConversationalAnswer(answer('{{label1}}为{{f1}}，{{label2}}为{{f2}}。',{factIds:[second.id,first.id]}),facts,context);
  expect(result.summary).toBe('课程甲 出勤率为75%，课程乙 出勤率为82%。');
  expect(buildConversationalAnswer(answer('{{label1}}为{{f1}}。'),[...facts,third],context).summary).toBe('课程甲 出勤率为75%。');
  expect(()=>buildConversationalAnswer(answer('{{f3}}'),facts,context)).toThrow('不存在');
 });
 it('factIds短编号规范到完整ID并保留模型选择次序，名称别名不能充当事实选择',()=>{
  const facts=[fact('actual:first:attendance_rate','课程甲 出勤率',75),fact('actual:second:attendance_rate','课程乙 出勤率',82)];
  const result=buildConversationalAnswer(answer('请核对这些课程的签到。',{factIds:['f2','f1']}),facts,context);
  expect(result.facts.map(item=>item.id)).toEqual(['actual:second:attendance_rate','actual:first:attendance_rate']);
  expect(result.facts).toEqual([facts[1],facts[0]]);
  expect(()=>buildConversationalAnswer(answer('请核对课程名称。',{factIds:['label1']}),facts,context)).toThrow('未查询');
 });
 it('绑定提示提供短值、短名称及旧ID映射，防止模型自己猜索引',()=>{
  const prompt=conversationalBindingPrompt([fact('original:attendance_rate','课程1 出勤率')],context,[]);
  expect(prompt).toContain('{{f1}}');expect(prompt).toContain('{{label1}}');expect(prompt).toContain('{{fact:original:attendance_rate}}');
  expect(prompt).toContain('75%');expect(prompt).toContain('课程1 出勤率');
 });
 it('未就绪事实即使残留数值和displayValue也统一为未知，不带旧单位',()=>{
  const source=fact('stale','旧出勤率',80,{status:'insufficient_data',displayValue:'80%',unit:'%'});
  const result=buildConversationalAnswer(answer('本期{{f1}}，原引用{{fact:stale}}。'),[source],context);
  expect(result.summary).toBe('本期未知，原引用未知。');expect(result.summary).not.toContain('80');expect(result.summary).not.toContain('%');
 });
 it('有效零值与非空文本保持原样，不与未知混同',()=>{
  const zero=fact('zero','续费率',0),text=fact('text','拟定周期',null,{unit:'',displayValue:'2026-07-01 至 2026-07-31'});
  expect(buildConversationalAnswer(answer('已查到{{f1}}；{{f2}}。'),[zero,text],context).summary).toBe('已查到0%；2026-07-01 至 2026-07-31。');
 });
 it('未知索引、模型捏造别名和其他对象ID不能变成有效引用',()=>{
  for(const placeholder of ['{{f0}}','{{f99}}','{{label99}}','{{fact:other-company:attendance_rate}}'])expect(()=>buildConversationalAnswer(answer(placeholder),[fact('actual')],context)).toThrow('不存在');
 });
 it('事实编号和数值均未被解析过程改写',()=>{
  const facts=[fact('course-a','课程甲 出勤率',75),fact('course-b','课程乙 出勤率',75)],before=JSON.stringify(facts);
  const result=buildConversationalAnswer(answer('{{label2}}为{{f2}}。'),facts,context);
  expect(result.facts.map(item=>item.id)).toEqual(['course-b']);expect(JSON.stringify(facts)).toBe(before);
 });
});

describe('经营数值仍需明确引用',()=>{
 it('修正提示明确指出九成等汉字数量，不只报告路径或悄悄放行近似值',()=>{
  let error:unknown;try{buildConversationalAnswer(answer('其余课程约九成。'),[fact('actual')],context);}catch(failure){error=failure;}
  expect(error).toBeInstanceOf(ConversationalNumberError);expect((error as ConversationalNumberError).quantities).toEqual([{field:'summary',tokens:['九成']}]);
  const prompt=conversationalRepairPrompt(error as AgentError,[fact('actual')],context);expect(prompt).toMatch(/^回答校验未通过，错误代码：/);expect(prompt).toContain('九成');expect(prompt).toContain('summary');expect(prompt).toContain('不能自行');
 });
 it('短引用的明确语法变体仍只解析同一真实事实，越界引用继续拒绝',()=>{
  const source=fact('call:attendance_rate'),result=buildConversationalAnswer(answer('已查到{{fact:F1}}。',{factIds:['{{f1}}','F1']}),[source],context);
  expect(result.summary).toBe('已查到75%。');expect(result.facts).toEqual([source]);expect(()=>buildConversationalAnswer(answer('{{fact:F2}}'),[source],context)).toThrow('不存在');
 });
 it('即使factIds引用了完全相同的比例，正文裸75%仍须拒绝',()=>{
  const source=fact('actual');rejected('当前出勤率为75%。',[source],{factIds:[source.id]});
 });
 it('错误比例、金额、人数和知识制度数值不能借同值或已选引用通过',()=>{
  const sources=[fact('attendance','出勤率',75),fact('refund','完成退款金额',100,{unit:'元'})];
  for(const summary of ['出勤率99%。','退款75元。','涉及75人。','规则规定75%为合格。','退款一百元。'])rejected(summary,sources,{factIds:sources.map(item=>item.id)});
 });
 it('同值不同对象不会自动绑定或推断指标含义',()=>{
  const source=fact('course-a','课程甲 出勤率',75);
  rejected('课程乙出勤率为75%。',[source],{factIds:[source.id]});
  rejected('本期退款75元。',[source],{factIds:[source.id]});
 });
 it('百分点变化只使用程序返回的符号、单位和值，不让模型手算',()=>{
  const change=fact('query:change:attendance_rate','出勤率周期变化',-7,{unit:'个百分点'});
  expect(buildConversationalAnswer(answer('本期变化{{f1}}，原因待核查。'),[change],context).summary).toBe('本期变化-7个百分点，原因待核查。');
  rejected('出勤下降7个百分点。',[change],{factIds:[change.id]});
 });
});

describe('建议中的一次操作与已发生事实分开',()=>{
 it('下一步候选里的再对比一次是未来查询意图，不是当前经营统计次数',()=>{
  const questions=[{id:'next',prompt:'希望继续哪项查询？',options:[{label:'按课程整体再对比一次',value:'帮我再确认一次各课程出勤率的对比'}]}];
  expect(buildConversationalAnswer(answer('已查询当前范围。',{questions}),[],context).questions).toEqual(questions);
 });
 it('候选动作仍不允许过去次数、经营人数或退款金额',()=>{
  for(const value of ['已再确认一次实际记录','查看80人的名单','再查询一次并退款75元','安排一次退款'])rejected('请选择下一步。',[],{questions:[{id:'next',prompt:'继续哪一步？',options:[{label:'继续核对',value}]}]});
 });
 it('建议数组内明确的单次提醒、回访和核查可以正常安排',()=>{
  for(const recommendation of ['做一次到场提醒。','安排1次到场提醒。','开展一次回访。','组织一次核查。','进行1次回访。','发起一次到场提醒，之后核对签到完整性。','对少儿编程家长做一次出勤沟通回访，了解缺勤原因。','开展一次针对性出勤排查。','对客诉较多的课程分别做一次客诉归因复盘，确认是否与课程安排相关。','进行一次退款原因核查。','已核对材料，建议安排一次回访。']){
   expect(buildConversationalAnswer(answer('请先核实签到完整性。',{recommendations:[recommendation]}),[],context).recommendations).toEqual([recommendation]);
  }
 });
 it('一次或1次的已发生动作仍是事实，不能套用建议豁免',()=>{
  for(const recommendation of ['已做一次到场提醒。','实际安排1次到场提醒。','曾开展一次回访。','已经进行一次核查。'])rejected('需要复核实际执行记录。',[],{recommendations:[recommendation]});
 });
 it('仅建议数组放行命令，不给摘要、原因或限制开放相同数字',()=>{
  rejected('做一次到场提醒。');
  rejected('请核查。',[],{hypotheses:['做一次到场提醒。']});
  rejected('请核查。',[],{limitations:['做一次到场提醒。']});
 });
 it('重复次数、经营金额和经营事件不属于单次提醒建议的豁免',()=>{
  for(const recommendation of ['做2次到场提醒。','安排一次退款。','安排一次退款后回访。','进行一次扣费后核查。','做一次到场提醒并返还75元。','安排1次到场提醒，已覆盖80人。'])rejected('请先核查。',[],{recommendations:[recommendation]});
 });
});

describe('运行记录仅保存安全的校验诊断',()=>{
 it('数字和结构校验只返回字段路径，不携带原文本、未知字段名称或原数值',()=>{
  const capture=(content:string)=>{try{buildConversationalAnswer(content,[],context);}catch(error){expect(error).toBeInstanceOf(AgentError);return conversationalValidationFields(error as AgentError);}throw new Error('应产生校验失败');};
  const numberFields=capture(answer('SECRET_7531 未核实金额7531元。',{recommendations:['请核对SECRET_9342涉及9342人的名单。']}));
  expect(numberFields).toEqual(['summary','recommendations.0']);
  const formatFields=capture(JSON.stringify({kind:'analysis',summary:'普通说明',factIds:[],hypotheses:[],recommendations:[{action:'SECRET_6428'}],limitations:[],SECRET_FIELD_9573:'私密内容'}));
  expect(formatFields).toEqual(expect.arrayContaining(['recommendations.0','$']));
  expect(JSON.stringify({numberFields,formatFields})).not.toMatch(/SECRET|7531|9342|6428|9573|私密|未核实|名单/);
  expect(conversationalValidationFields(new AgentError('MODEL_NETWORK','SECRET_OTHER_8532',502))).toEqual([]);
 });
});
