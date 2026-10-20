import {describe,expect,it} from 'vitest';
import type {AgentAnswerVO,AgentRunStatus,AgentRunVO} from '@/modules/agent/contracts';
import {canRetryInterpretation,hasMissingAnalysisTools,isFactsOnlyPartial,partialAnalysisSummary,partialAnalysisTitle,runAnswerSummary,runStatusColor,runStatusLabel} from '@/modules/agent/domain/run-presentation';

const answer=(partial?:AgentAnswerVO['partial']):AgentAnswerVO=>({summary:'尚未核验的89%原因文本',kind:'analysis',facts:[{id:'metric',label:'出勤率',value:72,unit:'%',status:'ready',evidenceIds:['evidence']}],hypotheses:[],recommendations:[],limitations:[],...(partial?{partial}:{})});
const record=(status:AgentRunStatus='failed',partial?:AgentAnswerVO['partial']):AgentRunVO=>({id:'run',sessionId:'session',status,answer:answer(partial),steps:[],proposals:[],evidence:[],startedAt:'2026-10-19T00:00:00Z',completedAt:'2026-10-19T00:00:01Z',errorCode:'UNVERIFIED_NUMBER',errorMessage:'未完成',recoveryEligibility:{eligible:true}});

describe('部分数据展示与真实执行状态',()=>{
 it('仅显式facts_only失败记录显示部分完成，状态和事实原样保留',()=>{
  const run=record('failed',{kind:'facts_only',reasonCode:'UNVERIFIED_NUMBER'}),before=JSON.stringify(run);
  expect(isFactsOnlyPartial(run)).toBe(true);expect(runStatusLabel(run)).toBe('部分完成');expect(runStatusColor(run)).toBe('orange');
  expect(run.status).toBe('failed');expect(JSON.stringify(run)).toBe(before);expect(run.answer!.facts[0].value).toBe(72);
 });
 it('旧失败即使已有事实仍是执行失败，不因数据存在变为部分完成或成功',()=>{
  const run=record();expect(isFactsOnlyPartial(run)).toBe(false);expect(runStatusLabel(run)).toBe('执行失败');expect(runStatusColor(run)).toBe('red');expect(runAnswerSummary(run)).toBe(run.answer!.summary);
 });
 it('显式部分记录不展示被拒绝模型摘要，也不改写其数字后当作有效结论',()=>{
  const run=record('failed',{kind:'facts_only',reasonCode:'UNVERIFIED_NUMBER'});
  expect(runAnswerSummary(run)).toBe(partialAnalysisSummary);expect(runAnswerSummary(run)).not.toContain('89%');expect(runAnswerSummary(run)).not.toContain('原因文本');
  expect(run.answer!.summary).toBe('尚未核验的89%原因文本');expect(partialAnalysisTitle).toBe('数据已查到，分析尚未完整');
 });
 it('缺少业务查询时即使服务端旧eligibility为true也不展示仅重试解读',()=>{
  const run=record('failed',{kind:'facts_only',reasonCode:'INCOMPLETE_ANALYSIS',missingTools:['query_metric_breakdown']});
  expect(hasMissingAnalysisTools(run)).toBe(true);expect(canRetryInterpretation(run)).toBe(false);expect(run.status).toBe('failed');
 });
 it('查询齐全且服务端允许时可仅重试解读，不能凭有事实自行授予恢复能力',()=>{
  const run=record('failed',{kind:'facts_only',reasonCode:'UNVERIFIED_NUMBER',missingTools:[]});expect(canRetryInterpretation(run)).toBe(true);
  run.recoveryEligibility={eligible:false,reason:'数据已变化'};expect(canRetryInterpretation(run)).toBe(false);run.recoveryEligibility=undefined;expect(canRetryInterpretation(run)).toBe(false);
 });
 it('缺步骤原因明确而旧可选missingTools没有返回时，仍要求重新查询',()=>{
  const run=record('failed',{kind:'facts_only',reasonCode:'INCOMPLETE_ANALYSIS'});expect(hasMissingAnalysisTools(run)).toBe(true);expect(canRetryInterpretation(run)).toBe(false);
 });
 it.each([['queued','等待执行'],['running','分析中'],['awaiting_confirmation','待人工确认'],['completed','已完成']] as const)('其余状态%s不受残留partial字段影响', (status,label)=>{
  const run=record(status,{kind:'facts_only',reasonCode:'UNVERIFIED_NUMBER',missingTools:['query_metrics']});expect(isFactsOnlyPartial(run)).toBe(false);expect(runStatusLabel(run)).toBe(label);expect(hasMissingAnalysisTools(run)).toBe(false);expect(canRetryInterpretation(run)).toBe(false);expect(runAnswerSummary(run)).toBe(run.answer!.summary);
 });
});
