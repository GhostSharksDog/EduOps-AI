import 'server-only';
import {riskTags} from '@/modules/tag/server';
import {riskProfiles} from '@/modules/profile/server';
import {reportService} from '@/modules/report/server';
import {decisionService} from '@/modules/decision/server';
import type {AgentActor,AgentTurnContext} from '../contracts';
import type {AgentTaskState} from '../contracts/task-state';
import {taskScopeKey} from '../domain/task-state';

/** 记忆只是引用。每轮重新检查对象归属、范围与版本，失效对象不给工具作为可用焦点。 */
export async function validateTaskObjects(actor:AgentActor,context:AgentTurnContext,input:AgentTaskState):Promise<AgentTaskState>{
 const state=structuredClone(input),valid:AgentTaskState['selectedObjects']=[];let stale=false;
 for(const item of state.selectedObjects){
  try{
   let datasetId:string,scope:AgentTurnContext['scope'],version:number|undefined,name:string;
   if(item.kind==='tag'){const p=await riskTags.get(actor.organizationId,item.id);datasetId=p.datasetId;scope=p.scope;version=p.version;name=p.name;}
   else if(item.kind==='segment'){const p=(await riskProfiles.summaries(actor.organizationId)).find(s=>s.id===item.id);if(!p)throw Error();datasetId=p.datasetId;scope=p.preview.scope;version=p.tagVersion;name=p.name;}
   else if(item.kind==='report'){const p=await reportService.getFrozen(actor.organizationId,item.id);datasetId=p.datasetId;scope=p.snapshot.scope;name=item.name;}
   else{const p=await decisionService.get(actor,item.id);datasetId=p.datasetId;scope=p.sourceSnapshot.scope;version=p.version;name=p.action;}
   if(datasetId!==context.datasetId||taskScopeKey({datasetId,scope})!==taskScopeKey(context)||item.version!==undefined&&version!==undefined&&item.version!==version){stale=true;continue;}
   valid.push({...item,name:name.slice(0,200),...(version!==undefined?{version}:{})});
  }catch{stale=true;}
 }
 state.selectedObjects=valid;
 if(stale){state.needsReview=true;state.pendingQuestions=[...new Set(['之前选择的对象或版本已变化，请重新核对。',...state.pendingQuestions])].slice(0,3);}
 return state;
}
