import type {AgentRunStatus,AgentRunVO} from '../contracts';

type PresentableRun=Pick<AgentRunVO,'status'|'answer'|'recoveryEligibility'>;
export const runStatusLabels:Record<AgentRunStatus,string>={queued:'等待执行',running:'分析中',awaiting_confirmation:'待人工确认',completed:'已完成',failed:'执行失败'};

/** 只改变展示标签；运行仍为failed，不能把已有事实当作完整任务成功。 */
export function isFactsOnlyPartial(run:PresentableRun):boolean {
 return run.status==='failed'&&run.answer?.partial?.kind==='facts_only';
}
export function runStatusLabel(run:PresentableRun):string {
 return isFactsOnlyPartial(run)?'部分完成':runStatusLabels[run.status];
}
export function runStatusColor(run:PresentableRun):'orange'|'red'|undefined {
 return isFactsOnlyPartial(run)?'orange':run.status==='failed'?'red':run.status==='awaiting_confirmation'?'orange':undefined;
}
export function hasMissingAnalysisTools(run:PresentableRun):boolean {
 return isFactsOnlyPartial(run)&&(run.answer?.partial?.reasonCode==='INCOMPLETE_ANALYSIS'||!!run.answer?.partial?.missingTools?.length);
}
export function canRetryInterpretation(run:PresentableRun):boolean {
 return run.status==='failed'&&run.recoveryEligibility?.eligible===true&&!hasMissingAnalysisTools(run);
}

export const partialAnalysisTitle='数据已查到，分析尚未完整';
export const partialAnalysisSummary='已保留查询得到的数据与图表，尚未完成的智能解读不作为分析结论。';
export function runAnswerSummary(run:PresentableRun):string|undefined {
 return isFactsOnlyPartial(run)?partialAnalysisSummary:run.answer?.summary;
}
