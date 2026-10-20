// 仅独立验收使用的本机兼容模型服务；生产代码没有模拟开关。
import http from 'node:http';
const port=Number(process.env.FIXTURE_PORT??3391);
if(![3391,3392].includes(port))throw Error('固定模型验收服务仅允许3391/3392本机端口');
const state={chatDelayMs:0,failNextEmbedding:0,failNextChat:0,chatRequests:0,embeddingRequests:0,requestedTools:[],sentMemberDetails:false};
const vectors=text=>{
 const groups=[['出勤','签到','请假','缺勤'],['满班','容量','班级'],['课耗','课时','消耗'],['字段','字典','数据来源'],['制度','跟进','家长','沟通']];
 const vector=groups.map(words=>0.05+words.reduce((n,w)=>n+text.split(w).length-1,0));
 const norm=Math.sqrt(vector.reduce((n,x)=>n+x*x,0));return vector.map(x=>x/norm);
};
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
const complete=message=>({id:'fixture-completion',choices:[{index:0,message:{role:'assistant',...message},finish_reason:message.tool_calls?'tool_calls':'stop'}]});
const tool=(name,args)=>complete({content:null,tool_calls:[{id:'fixture-'+name,type:'function',function:{name,arguments:JSON.stringify(args)}}]});
function answer(messages){
 const current=messages.findLastIndex(m=>m.role==='user'),turn=messages.slice(current+1),user=String(messages[current]?.content??'');
 const calls=new Map(messages.filter(m=>m.role==='assistant').flatMap(m=>m.tool_calls??[]).map(c=>[c.id,c.function.name]));
 const results=turn.filter(m=>m.role==='tool').map(m=>{let body;try{body=JSON.parse(m.content);}catch{body={};}return {name:calls.get(m.tool_call_id),body};});
 state.sentMemberDetails ||= results.some(r=>/"members"|"displayName"|"studentId"/.test(JSON.stringify(r.body)));
 if(messages.some(m=>m.role==='system'&&String(m.content).includes('冻结，不能扩大范围'))){
  if(!results.some(r=>r.name==='query_report_facts'))return tool('query_report_facts',{});
  if(!results.some(r=>r.name==='search_report_knowledge'))return tool('search_report_knowledge',{query:'出勤 满班 续费 招生 留存 客诉 退款 指标口径'});
  const facts=results.flatMap(r=>r.body.facts??[]);
  return complete({content:JSON.stringify({summary:'已核对本期与对比期冻结指标。模拟结果用于演示，完整报告保留来源和批次。',factIds:facts.map(f=>f.id),hypotheses:['出勤变化可能与排课安排有关，需核对实际反馈。'],recommendations:['运营主管核对课程出勤记录及排课变更，联系相关班级负责人并记录反馈，下期复核同一范围的指标。'],limitations:['原因尚未验证，模拟数据不能证明实际经营改善。']})});
 }
 if(user.includes('测试未知工具'))return tool('publish_tag',{});
 if(user.includes('测试恶意参数'))return tool('query_metrics',{organizationId:'forged'});
 if(user.includes('测试循环上限'))return tool('query_metrics',{});
 // 明确的页面代办验收分支；只给出工具调用，数据与对象均由真实测试业务服务处理。
 if(user.includes('__agent_plan_e2e__:')){
  const marker=user.match(/__agent_plan_e2e__:(attendance|combination):(\d+)/),combination=marker?.[1]==='combination',suffix=marker?.[2]??'fixture';
  if(!results.some(result=>result.name==='query_metrics'))return tool('query_metrics',{});
  if(!results.some(result=>result.name==='search_knowledge'))return tool('search_knowledge',{query:'出勤率、未知签到及运营跟进制度',limit:5});
  const draft=results.find(result=>result.name==='propose_tag');
  if(!draft){const leaf={type:'attendance_below',thresholdPercent:80,minimumDue:4};return tool('propose_tag',{name:(combination?'真实页面组合关注-':'真实页面出勤关注-')+suffix,rule:combination?{type:'all',conditions:[leaf,{type:'renewal_due',withinDays:30}]}:leaf});}
  const proposal=draft.body.result?.proposal;
  if(proposal&&!results.some(result=>result.name==='preview_tag_rule'))return tool('preview_tag_rule',{proposalId:proposal.id,version:proposal.version});
  if(proposal&&!results.some(result=>result.name==='prepare_action_plan'))return tool('prepare_action_plan',{proposalId:proposal.id,version:proposal.version,segmentName:(combination?'页面组合跟进人群-':'页面出勤跟进人群-')+suffix,task:{action:'核查签到完整性并记录受影响学员的沟通情况',priority:'normal',dueDate:'2026-11-15',reviewMethod:'核对跟进记录与后续同范围的出勤观察',recommendationIndex:0}});
  const facts=results.flatMap(result=>result.body.facts??[]),seen=new Set(),factIds=facts.filter(fact=>{if(seen.has(fact.id))return false;seen.add(fact.id);return true;}).slice(0,80).map(fact=>fact.id);
  return complete({content:JSON.stringify({kind:'action',summary:'已查询经营数据并准备标签、人群和跟进任务。请核对规则、覆盖范围及执行安排后确认。',factIds,hypotheses:['原因尚未验证，应先核查签到及服务记录。'],recommendations:['核查未知签到并记录受影响学员的沟通情况，复核后续出勤。'],limitations:['模拟数据仅用于操作验证，不代表真实机构执行效果。']})});
 }
 if(messages.some(m=>m.role==='system'&&/集团年度财务分析助手|当前为集团年度公开财务/.test(String(m.content)))){
  if(user.includes('测试财务越权'))return tool('propose_tag',{name:'不应创建',rule:{type:'attendance_below',thresholdPercent:80,minimumDue:4}});
  if(!results.some(r=>r.name==='query_financial_metrics'))return tool('query_financial_metrics',{});
  if(!results.some(r=>r.name==='search_knowledge'))return tool('search_knowledge',{query:'财务毛利费用率年报口径',limit:5});
  const facts=results.flatMap(r=>r.body.facts??[]);
  return complete({content:JSON.stringify({summary:'已核对年度集团收入、成本和费用事实，原始出处可追溯。',factIds:facts.map(f=>f.id),hypotheses:['费用变化可能与业务安排有关，需核查预算与费用明细。'],recommendations:['由费用负责人复核年度预算与费用明细，核对费用归属和合同，记录偏差原因并在后续披露时复查。'],limitations:['集团年度案例不能推断校区利润、月度流水或模拟学员经营。']})});
 }
 if(messages.some(m=>m.role==='system'&&String(m.content).includes('研究对照的直接模型方案')))return complete({content:'直接模型对照：核查冻结事实，缺少业务原因，建议补齐反馈后复核。'});
 if(messages.some(m=>m.role==='system'&&/公开学习数据分析助手|当前为匿名公开学习数据/.test(String(m.content)))){
  if(user.includes('测试学习越权'))return tool('propose_tag',{name:'不应创建',rule:{type:'absence_count',minimumAbsences:2,minimumDue:3}});
  if(!results.some(r=>r.name==='query_learning_metrics'))return tool('query_learning_metrics',{});
  if(!results.some(r=>r.name==='search_knowledge'))return tool('search_knowledge',{query:'OULAD学习活动、点击、平均活跃天数、测评和相对日期口径',limit:5});
  const facts=results.flatMap(r=>r.body.facts??[]);
  return complete({content:JSON.stringify({summary:'已核对公开学习数据的聚合指标和来源。课程批次与相对日期用于观察学习行为，不能等同于机构经营。',factIds:facts.map(f=>f.id),hypotheses:['活动差异可能与课程资源安排有关，需结合教学过程进一步核实。'],recommendations:['对活跃变化较明显的课程批次核对资源安排与测评反馈，安排学习支持并记录后续观察。'],limitations:['最终课程结果只描述最终状态，学习点击不能替代签到。']})});
 }
 if(!results.some(r=>r.name==='query_metrics'))return tool('query_metrics',{});
 if(!results.some(r=>r.name==='search_knowledge'))return tool('search_knowledge',{query:'出勤率的定义，未知签到及风险跟进制度',limit:5});
 if(/草稿|创建.*风险|创建.*标签/.test(user)){
  const draft=results.find(r=>r.name==='propose_tag');
  if(!draft){let rule={type:'attendance_below',thresholdPercent:80,minimumDue:4},name='出勤风险跟进';if(/组合|且.*到期/.test(user)){rule={type:'all',conditions:[rule,{type:'renewal_due',withinDays:30}]};name='同课程出勤与到期跟进';}else if(/课耗将尽|课时余额/.test(user)){rule={type:'hours_remaining',maximumHours:8};name='课耗将尽跟进';}else if(/近期客诉|近期发生客诉/.test(user)){rule={type:'recent_complaint',lookbackDays:30,minimumCount:1};name='近期客诉跟进';}else if(/到期/.test(user)){rule={type:'renewal_due',withinDays:30};name='到期续费待跟进';}return tool('propose_tag',{name,rule});}
  const p=draft.body.result?.proposal;
  if(p&&!results.some(r=>r.name==='preview_tag_rule'))return tool('preview_tag_rule',{proposalId:p.id,version:p.version});
 }
 const facts=results.flatMap(r=>r.body.facts??[]),seen=new Set(),factIds=facts.filter(f=>{if(seen.has(f.id))return false;seen.add(f.id);return true;}).map(f=>f.id);
 return complete({content:JSON.stringify({summary:'已核对所选范围的经营指标，并结合知识来源整理说明。模拟数据仅用于流程演示。',factIds,hypotheses:['出勤变化可能与排课或服务跟进有关，目前尚未验证原因。'],recommendations:['先核查未知签到，再由运营人员确认风险规则与覆盖范围。','对确认的人群开展沟通，并记录后续反馈。'],limitations:['建议依据所选数据范围，不能直接证明学员流失原因。']})});
}
const server=http.createServer(async(req,res)=>{
 try{
  let body='';for await(const part of req){body+=part;if(body.length>2000000){send(res,413,{error:'too large'});return;}}
  const input=body?JSON.parse(body):{};
  if(req.url==='/control'&&req.method==='POST'){Object.assign(state,{chatDelayMs:Math.max(0,Math.min(5000,Number(input.chatDelayMs??0))),failNextEmbedding:Number(input.failNextEmbedding??0),failNextChat:Number(input.failNextChat??0)});send(res,200,{ok:true});return;}
  if(req.url==='/state'){send(res,200,state);return;}
  if(req.url==='/v1/embeddings'){
   state.embeddingRequests++;if(state.failNextEmbedding>0){state.failNextEmbedding--;send(res,503,{error:'fixture embedding unavailable'});return;}
   const list=Array.isArray(input.input)?input.input:[input.input];send(res,200,{data:list.map((t,index)=>({object:'embedding',index,embedding:vectors(String(t))})).reverse(),model:'fixture-embedding'});return;
  }
  if(req.url==='/v1/chat/completions'){
   if(state.chatDelayMs)await new Promise(resolve=>setTimeout(resolve,state.chatDelayMs));
   state.chatRequests++;state.requestedTools=[...new Set([...state.requestedTools,...(input.tools??[]).map(t=>t.function.name)])];
   if(state.failNextChat>0){state.failNextChat--;send(res,503,{error:'fixture chat unavailable'});return;}
   send(res,200,answer(input.messages??[]));return;
  }
  send(res,404,{error:'fixture route not found'});
 }catch{send(res,400,{error:'fixture request invalid'});}
});
server.listen(port,'127.0.0.1',()=>console.log('固定响应验收服务已启动，仅监听本机。'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
