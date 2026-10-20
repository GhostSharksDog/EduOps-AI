import type {AgentFactVO,AgentProposalVO,AgentTurnContext} from '../contracts';

interface VerifiedBinding {text:string;factId?:string;valueReference?:boolean;}
/** Short references are local to the current frozen facts, never a cross-run lookup. */
export function verifiedNumberBindings(facts:readonly AgentFactVO[],context:AgentTurnContext,proposals:readonly AgentProposalVO[]=[]){
 const bindings=new Map<string,VerifiedBinding>();
 [...new Map(facts.map(fact=>[fact.id,fact])).values()].forEach((fact,index)=>{
  const text=fact.status!=='ready'?'未知':fact.displayValue!==undefined?fact.displayValue:fact.value===null||!Number.isFinite(fact.value)?'未知':new Intl.NumberFormat('zh-CN',{maximumFractionDigits:4}).format(fact.value)+fact.unit;
  const value={text,factId:fact.id,valueReference:true};
  bindings.set('fact:'+fact.id,value);bindings.set('f'+(index+1),value);
  const label={text:fact.label,factId:fact.id};
  bindings.set('label:'+fact.id,label);bindings.set('label'+(index+1),label);
 });
 for(const [key,value] of Object.entries(context.scope))if(['startDate','endDate','dataCutoff','relativeDayStart','relativeDayEnd','years'].includes(key)&&value!==undefined)bindings.set('scope:'+key,{text:Array.isArray(value)?value.join('、'):String(value)});
 for(const proposal of proposals){
  bindings.set('rule:'+proposal.id+':version',{text:String(proposal.version)});bindings.set('rule:'+proposal.id+':name',{text:proposal.name});
  if(!proposal.rule)continue;
  const leaves=proposal.rule.type==='all'||proposal.rule.type==='any'?proposal.rule.conditions:[proposal.rule],values=new Map<string,Set<string>>();
  for(const leaf of leaves)for(const [key,value] of Object.entries(leaf))if(typeof value==='number'){const set=values.get(key)??new Set<string>();set.add(String(value));values.set(key,set);}
  for(const [key,value] of values)if(value.size===1)bindings.set('rule:'+proposal.id+':'+key,{text:[...value][0]});
 }
 return bindings;
}

function validDate(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
/** Calendar references are checked separately from business quantities. No metric value is whitelisted. */
export function knownCalendarWording(context:AgentTurnContext,facts:readonly AgentFactVO[]){
 const dates=new Set<string>(),months=new Set<string>();
 const addDate=(value:unknown)=>{if(typeof value==='string'&&validDate(value)){dates.add(value);months.add(value.slice(0,7));}};
 const addRange=(start:unknown,end:unknown)=>{
  addDate(start);addDate(end);if(typeof start!=='string'||typeof end!=='string'||!validDate(start)||!validDate(end)||start>end)return;
  const from=Number(start.slice(0,4))*12+Number(start.slice(5,7))-1,to=Number(end.slice(0,4))*12+Number(end.slice(5,7))-1;
  if(to-from>24)return;
  for(let i=from;i<=to;i++)months.add(String(Math.floor(i/12))+'-'+String(i%12+1).padStart(2,'0'));
 };
 if('startDate' in context.scope)addRange(context.scope.startDate,context.scope.endDate);
 for(const fact of facts){
  if(fact.status!=='ready'||!fact.evidenceIds.length)continue;
  if(fact.id.endsWith(':comparison:period')&&fact.displayValue){const range=/^(\d{4}-\d{2}-\d{2}) 至 (\d{4}-\d{2}-\d{2})$/.exec(fact.displayValue);if(range)addRange(range[1],range[2]);}
  const period=/:period:(\d{4}-\d{2})$/.exec(fact.id);if(period&&validDate(period[1]+'-01'))months.add(period[1]);
 }
 const years=new Set([...months].map(month=>month.slice(0,4))),bareMonths=years.size===1?new Set([...months].map(month=>Number(month.slice(5)))):new Set<number>();
 return (text:string)=>text
  .replace(/(?<!\d)\d{4}-\d{2}-\d{2}(?![\dT]|元|[%％]|人|条|次|课时|小时|倍|笔|个)/g,value=>dates.has(value)?'已知日期':value)
  .replace(/(?<!\d)(\d{4})年\s*(\d{1,2})月/g,(whole,year:string,month:string)=>months.has(year+'-'+month.padStart(2,'0'))?'已知月份':whole)
  .replace(/(?<![\d-])(\d{4})-(\d{2})(?![-\d]|元|[%％]|人|条|次|课时|小时|倍|笔|个)/g,(whole,year:string,month:string)=>months.has(year+'-'+month)?'已知月份':whole)
  .replace(/(?<![\d年-])(\d{1,2})月/g,(whole,month:string)=>bareMonths.has(Number(month))?'已知月份':whole);
}

/** Only imperative recommendations: an action count is not a historical business observation. */
export function withoutSuggestedActionCount(text:string,field:string){
 if(!field.startsWith('recommendations.')&&!/^questions\.\d+\.options\.\d+\.(?:label|value)$/.test(field))return text;
 const observedAt=(offset:number,source=text)=>{const clause=source.slice(0,offset).split(/[。！？；\n]/).at(-1)??'',past=[...clause.matchAll(/已|曾|实际|累计|发生|记录|完成了|共计/g)].at(-1)?.index??-1,future=[...clause.matchAll(/建议|请|计划|拟|应当|需要|后续|接下来/g)].at(-1)?.index??-1;return past>=0&&future<past;};
 const actions=text.replace(/(?:做|开展|安排|组织|进行|发起)(?:一次|1次)(?=[\u4e00-\u9fff]{0,10}?(?:提醒|回访|核查|检查|复核|沟通|确认|排查|复盘|分析|评估|访谈|回顾|梳理))/g,(whole:string,offset:number)=>{
  // 限于人工服务动作；“安排一次退款/扣费后回访”不能借后面的回访词绕过。
  const action=text.slice(offset+whole.length).match(/^[\u4e00-\u9fff]{0,10}?(?:提醒|回访|核查|检查|复核|沟通|确认|排查|复盘|分析|评估|访谈|回顾|梳理)/)?.[0]??'';
  return observedAt(offset)||/(?:退款|退费|扣费|收费|付款|支付|转账|签约|报名|充值|购课|发放)(?:后|再|并|再来|之后)/.test(action)?whole:whole.replace(/一次|1次/,'');
 });
 return actions.replace(/(?:再|重新)(?:查看|查询|核对|确认|比较|对比|检索)(?:一次|1次)/g,(whole:string,offset:number)=>observedAt(offset,actions)?whole:whole.replace(/一次|1次/,''));
}
