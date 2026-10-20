import {createHash} from 'node:crypto';
import type {AgentTurnContext} from '../contracts';
import {taskStateSchema,type AgentTaskState,type TaskMemoryInput,type AgentTaskStatePatch} from '../contracts/task-state';

function normalized(value:unknown,includeObservation=false):unknown{
 if(Array.isArray(value))return value.every(v=>typeof v==='string'||typeof v==='number')?[...value].sort():value.map(item=>normalized(item,includeObservation));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['organizationId','authorizedCampusIds',...(includeObservation?[]:['observationCutoff'])].includes(key)).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>[key,normalized(v,includeObservation)]));
 return value;
}
/** Identity is enforced independently; object scope is stable across harmless filter ordering. */
export function taskScopeKey(context:AgentTurnContext):string{return createHash('sha256').update(JSON.stringify(normalized(context))).digest('hex');}
/** Observation windows affect cohort metrics, even when an object uses the same public range. */
export function evidenceScopeKey(context:AgentTurnContext):string{return createHash('sha256').update(JSON.stringify(normalized(context,true))).digest('hex');}
export function emptyTaskState(context:AgentTurnContext,now=new Date().toISOString(),revision=0):AgentTaskState{return {revision,goal:null,userConditions:[],selectedObjects:[],pendingQuestions:[],datasetId:context.datasetId,scopeKey:taskScopeKey(context),needsReview:false,updatedAt:now};}
export function readTaskState(raw:unknown,context:AgentTurnContext,now=new Date().toISOString()):AgentTaskState{
 const parsed=taskStateSchema.safeParse(raw);if(parsed.success)return parsed.data;
 const revision=raw&&typeof raw==='object'?'revision'in raw?raw.revision:undefined:undefined;
 return emptyTaskState(context,now,typeof revision==='number'&&Number.isInteger(revision)&&revision>=0&&revision<=1000000000?revision:0);
}
export function prepareTaskState(current:AgentTaskState,context:AgentTurnContext,input:TaskMemoryInput|undefined,now=new Date().toISOString()):AgentTaskState{
 const state=structuredClone(current),key=taskScopeKey(context),datasetChanged=state.datasetId!==context.datasetId,scopeChanged=state.scopeKey!==key;
 if(datasetChanged){state.selectedObjects=[];state.pendingQuestions=[];}
 if(datasetChanged||scopeChanged)state.needsReview=!!state.goal||state.userConditions.length>0||state.selectedObjects.length>0;
 state.datasetId=context.datasetId;state.scopeKey=key;
 if(input?.goal!==undefined)state.goal=input.goal;
 if(input?.userConditions!==undefined)state.userConditions=input.userConditions;
 if(input&&(input.goal!==undefined||input.userConditions!==undefined)&&state.selectedObjects.length)state.needsReview=true;
 const changed=JSON.stringify({...state,revision:0,updatedAt:''})!==JSON.stringify({...current,revision:0,updatedAt:''});
 if(changed){state.revision=current.revision+1;state.updatedAt=now;}
 return taskStateSchema.parse(state);
}
export function patchTaskState(current:AgentTaskState,input:AgentTaskStatePatch,context:AgentTurnContext,now=new Date().toISOString()):AgentTaskState{
 if(input.action==='clear')return emptyTaskState(context,now,current.revision+1);
 const state=prepareTaskState(current,context,{...(input.goal!==undefined?{goal:input.goal}:{}),...(input.userConditions!==undefined?{userConditions:input.userConditions}:{})},now);
 // Every explicit successful save advances the version, including a no-op save.
 return {...state,revision:current.revision+1,updatedAt:now};
}
/** Call only with the current authenticated user's own message, never model/tool/knowledge text. */
export function taskMemoryInput(message:string,state?:AgentTaskState|null):TaskMemoryInput|undefined{
 const text=message.trim();if(!text||text.length>4000)return;
 const goalMatch=text.match(/^(?:新的?任务|另一个任务|新目标|修改目标|更改目标|把目标改为|我的目标是|本次目标是)[：:\s]*([\s\S]+)$/);
 const conditionMatch=text.match(/^(?:条件(?:改为|修改为|是)?|新增条件|增加条件|补充条件|筛选条件(?:改为|是)?)[：:\s]*([\s\S]+)$/);
 if(conditionMatch&&text.length<=200){const replace=/^(?:筛选)?条件(?:改为|修改为|是)[：:\s]*/.test(text),conditions=[...new Set([...(replace?[]:state?.userConditions??[]),text])];return {userConditions:conditions.slice(-8)};}
 if(goalMatch&&goalMatch[1].trim().length<=500)return {goal:goalMatch[1].trim()};
 if(!state?.goal&&text.length<=500&&!/^(?:你好|您好|嗨|哈喽|hello|hi|谢谢|好的|好|嗯|确认|继续)[！!。.,，\s]*$/i.test(text)&&!/(?:怎么|如何|在哪|哪里|用法|帮助|使用说明)/.test(text))return {goal:text};
 return;
}
