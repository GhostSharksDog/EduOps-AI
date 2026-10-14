import {describe,it,expect} from 'vitest';
import {generateReport,type ReportModel} from '@/modules/report/domain/generation';
import {reportInputSchema} from '@/modules/report/contracts';
const facts=[{id:'current/attendance_rate',label:'本期出勤率',value:72,unit:'%',status:'ready',evidenceIds:['metric/test']}];
const answer=JSON.stringify({summary:'已核对冻结的指标依据。',factIds:[facts[0].id],hypotheses:['排课影响待验证。'],recommendations:['运营人员核对签到，再复核排课并记录反馈。'],limitations:['模拟数据仅用于演示。']});
const call=(name:string,args:unknown={})=>({message:{content:null,tool_calls:[{id:name,type:'function' as const,function:{name,arguments:JSON.stringify(args)}}]}});
function scripted(responses:ReturnType<typeof call>[]|{message:{content:string}}[]){let n=0;return {chat:async()=>responses[Math.min(n++,responses.length-1)]} as ReportModel;}
const retrieve=async()=>({hits:[]});
describe('报告只读工具及证据',()=>{
 it('冻结事实与检索均执行后才接纳正文',async()=>{const model=scripted([call('query_report_facts'),call('search_report_knowledge',{query:'出勤口径'}),{message:{content:answer}}] as any);const r=await generateReport(model,facts,retrieve,AbortSignal.timeout(1000));expect(r.answer.facts).toEqual(facts);expect(r.steps.map(s=>s.tool)).toEqual(['query_report_facts','search_report_knowledge']);});
 it.each(['publish_tag','propose_tag','create_segment'])('不允许 %s',async name=>{await expect(generateReport(scripted([call(name)]),facts,retrieve,AbortSignal.timeout(1000))).rejects.toThrow('未授权');});
 it('模型不能改变冻结范围',async()=>{await expect(generateReport(scripted([call('query_report_facts',{organizationId:'fake'})]),facts,retrieve,AbortSignal.timeout(1000))).rejects.toThrow('范围');});
 it('工具不足、循环或取消返回失败',async()=>{await expect(generateReport(scripted([{message:{content:answer}}]),facts,retrieve,AbortSignal.timeout(1000))).rejects.toThrow('缺少');await expect(generateReport(scripted([call('query_report_facts')]),facts,retrieve,AbortSignal.timeout(1000))).rejects.toThrow('上限');const c=new AbortController();c.abort();await expect(generateReport(scripted([call('query_report_facts')]),facts,retrieve,c.signal)).rejects.toThrow();});
 it('拒绝自编数字与无依据引用',async()=>{for(const content of [answer.replace('已核对冻结的指标依据。','出勤为99%。'),answer.replace(facts[0].id,'invented')])await expect(generateReport(scripted([call('query_report_facts'),call('search_report_knowledge',{query:'口径'}),{message:{content}}] as any),facts,retrieve,AbortSignal.timeout(1000))).rejects.toThrow();});
 it('客户端不得自报机构和角色',()=>{expect(reportInputSchema.safeParse({datasetId:crypto.randomUUID(),requestKey:crypto.randomUUID(),kind:'monthly',anchorDate:'2026-08-01',organizationId:'fake'}).success).toBe(false);});
 it('正文可在剩余轮数内两次修正，但不能重复查询工具或改动冻结事实',async()=>{let count=0;const invalid={message:{content:answer.replace('已核对冻结的指标依据。','出勤为99%。')}},responses=[call('query_report_facts'),call('search_report_knowledge',{query:'口径'}),invalid,invalid,{message:{content:answer}}];const model={chat:async()=>responses[count++]} as ReportModel;const result=await generateReport(model,facts,retrieve,AbortSignal.timeout(1000));expect(count).toBe(5);expect(result.steps).toHaveLength(2);expect(result.answer.facts).toEqual(facts);});
});
