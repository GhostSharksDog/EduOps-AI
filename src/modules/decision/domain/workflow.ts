import type {DecisionState,DecisionUpdate} from '../contracts';
import {WorkflowError} from '@/shared/errors/workflow-error';
const transitions:Record<DecisionState,DecisionState[]>={accepted:['executing','deferred','rejected'],deferred:['accepted','rejected'],rejected:[],executing:['review_pending'],review_pending:['executing','completed'],completed:[]};
export function nextDecisionState(current:DecisionState,input:DecisionUpdate){
 const next=input.state??current;
 if(next!==current&&!transitions[current].includes(next))throw new WorkflowError('当前状态不能执行此操作，请刷新任务',409);
 if((next==='executing'||next==='review_pending'||input.kind==='execution')&&input.kind!=='execution')throw new WorkflowError('执行操作必须填写执行记录',400);
 if(input.kind==='execution'&&!['accepted','executing','review_pending'].includes(current))throw new WorkflowError('建议尚未采纳或已经结束，不能记录执行',409);
 if(input.kind==='review'&&current!=='review_pending')throw new WorkflowError('任务尚未提交复核',409);
 if(next==='completed'&&!input.reviewResult)throw new WorkflowError('请填写复核结果',400);
 if(input.kind==='adoption'&&!['accepted','deferred','rejected'].includes(next))throw new WorkflowError('此状态不能修改采纳决定',409);
 if(current==='completed'||current==='rejected')throw new WorkflowError('此任务已经结束',409);
 return next;
}
