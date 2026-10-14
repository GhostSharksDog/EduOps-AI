import {describe,it,expect} from 'vitest';
import {annualValues,cents} from '@/modules/finance/domain/annual';
import {financeScopeSchema} from '@/shared/contracts/analysis';
import {agentRunInputSchema} from '@/modules/agent/contracts';
import {datasetAnalysisType} from '@/modules/education/contracts';
import {nextDecisionState} from '@/modules/decision/domain/workflow';
import {decisionUpdateSchema} from '@/modules/decision/contracts';
const requestKey='00000000-0000-4000-8000-000000000001';
describe('财务与决策的来源和状态边界',()=>{
 it('披露金额按分计算毛利，收入为零时费用率留空',()=>{const row={year:2025,revenue:'1372582010.40',cost:'711264727.77',selling:'273421149.55',administrative:'322363716.56',sourceUrl:'https://example.com/report.pdf',sourcePage:17,disclosedAt:'2026-04-23',sourceVersion:'2025',originalUnit:'CNY yuan',historicalSources:[]};expect(cents(row.revenue)-cents(row.cost)).toBe(66131728263n);expect(annualValues(row).grossProfit).toBe(661317282.63);expect(annualValues({...row,revenue:'0.00'}).sellingRatio).toBeNull();});
 it('任意公开来源不能被默认为OULAD',()=>{expect(datasetAnalysisType({key:'other-public',origin:'public'})).toBeNull();expect(datasetAnalysisType({key:'angli',origin:'public',analysisType:'finance'})).toBe('finance');});
 it('三种范围互斥，历史会话不能重设年度',()=>{const base={message:'查询',requestKey,datasetId:requestKey};expect(agentRunInputSchema.safeParse({...base,financeScope:{years:[2025]}}).success).toBe(true);expect(agentRunInputSchema.safeParse({...base,financeScope:{years:[2025]},learningScope:{courseKeys:[]}}).success).toBe(false);expect(agentRunInputSchema.safeParse({message:'继续',requestKey,sessionId:requestKey,financeScope:{years:[]}}).success).toBe(false);expect(financeScopeSchema.safeParse({years:[2025],organizationId:requestKey}).success).toBe(false);});
 it('未执行不能直接完成复核，复核必须有结果',()=>{const update={requestKey,expectedVersion:1,kind:'review' as const,state:'completed' as const,note:'复核',reviewResult:'模拟核查'};expect(()=>nextDecisionState('accepted',update)).toThrow();expect(nextDecisionState('review_pending',update)).toBe('completed');expect(decisionUpdateSchema.safeParse({...update,reviewResult:undefined}).success).toBe(false);});
 it('不采纳或已复核不能追加执行记录',()=>{const update={requestKey,expectedVersion:1,kind:'execution' as const,note:'模拟执行'};expect(()=>nextDecisionState('rejected',update)).toThrow();expect(()=>nextDecisionState('completed',update)).toThrow();expect(nextDecisionState('executing',update)).toBe('executing');});
});
