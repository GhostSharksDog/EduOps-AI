import type {AgentActor,AgentConfirmationDTO,AgentRepository} from '../contracts';
import {isLearningScope,isFinanceScope} from '@/shared/contracts/analysis';
import {AgentError} from '../domain/errors';
import type {ActionPlanService} from './actions';
import {stableActionKey} from './actions';
import type {ActionPlanStore} from './action-store';

export function legacyConfirmation(repository:AgentRepository,store:ActionPlanStore,actions:ActionPlanService){
 return async(actor:AgentActor,input:AgentConfirmationDTO)=>{
  const saved=await repository.getRun(actor,input.runId),run=saved.run,context=run.context??{datasetId:saved.session.datasetId,scope:saved.session.scope};
  if(isLearningScope(context.scope)||isFinanceScope(context.scope))throw new AgentError('FORBIDDEN_TOOL','当前模式不能发布经营标签',403);
  if(!['completed','awaiting_confirmation'].includes(run.status))throw new AgentError('INVALID_RUN_STATE','此执行没有可确认的草稿',409);
  const proposal=run.proposals.find(p=>p.id===input.proposalId);
  if(!proposal||proposal.version!==input.version||proposal.previewToken!==input.previewToken)throw new AgentError('STALE_CONFIRMATION','草稿版本或预览已变化，请重新预览',409);
  if(actor.role!=='admin'&&saved.session.createdBy!==actor.userId)throw new AgentError('SESSION_READ_ONLY','只能确认自己会话的操作',403);
  if(proposal.status==='published')return run;
  let plan=run.actionPlan;
  if(plan&&plan.steps.length!==1)throw new AgentError('COMBINED_PLAN_REQUIRED','此回答已有组合操作，请核对操作卡后统一确认',409);
  if(plan){const action=plan.steps[0].input;if(action.kind!=='publish_tag'||action.proposalId!==input.proposalId||action.version!==input.version||action.previewToken!==input.previewToken)throw new AgentError('PLAN_CHANGED','请使用当前操作计划的确认按钮',409);}
  else{
   plan=await actions.prepareFollowup({proposalId:input.proposalId,version:input.version},context.scope,{actor,runId:run.id,toolCallId:'legacy-confirm',datasetId:context.datasetId,turnContext:context,proposalIds:run.proposals.map(p=>p.id),signal:AbortSignal.timeout(120000)});
   if(!store.append)throw new AgentError('PLAN_STORE_UNAVAILABLE','操作计划存储未就绪',503);
   plan=await store.append(actor,run.id,plan);
  }
  const result=await actions.confirm({runId:run.id,planId:plan.id,version:plan.version,requestKey:stableActionKey(plan.id,'legacy-confirm')},actor);
  const refreshed=(await repository.getRun(actor,run.id)).run;
  if(result.status!=='completed')throw new AgentError(result.errorCode??'ACTION_FAILED',result.errorMessage??'发布尚未完成，请查看操作计划',409);
  return refreshed;
 };
}
