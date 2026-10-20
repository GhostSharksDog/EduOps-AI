import type {AuthorizedScope,CapabilityResult} from '@/shared/contracts/analysis';
import type {AgentActor,ToolDefinition} from '../contracts';
import {CapabilityUnavailableError} from '@/shared/contracts/unavailable';
import type {z} from 'zod';
import type {ToolExecutionContext} from '../contracts';
import {AgentError} from '../domain/errors';
import {baseTaskToolNames,taskToolGroups,taskToolAllowedInMode} from '../domain/task-routing';
import type {AgentTaskGroup,AgentTaskMode} from '../contracts/research';
export type ToolHandler<S extends {organizationId:string}=AuthorizedScope>=(input:unknown,scope:S,context?:ToolExecutionContext)=>Promise<CapabilityResult<unknown>>;
export class ToolRegistry<S extends {organizationId:string}=AuthorizedScope> {
 private readonly entries=new Map<string,{definition:ToolDefinition;handler?:ToolHandler<S>;schema?:z.ZodType}>();
 register(definition:ToolDefinition,handler?:ToolHandler<S>,schema?:z.ZodType):void{
  if(this.entries.has(definition.name))throw new Error('工具名称重复：'+definition.name);
  if(!['read','propose'].includes(definition.mode))throw new Error('Agent工具仅支持读取和提出草稿');
  this.entries.set(definition.name,{definition,handler,schema});
 }
 list():ToolDefinition[]{return [...this.entries.values()].map(e=>({...e.definition}));}
 listFor(actor:AgentActor):ToolDefinition[]{return this.list().filter(t=>t.mode==='read'||['admin','operator'].includes(actor.role));}
 definition(name:string):ToolDefinition|undefined{return this.entries.get(name)?.definition;}
 validateInput(name:string,input:unknown):unknown{
  const entry=this.entries.get(name);if(!entry)throw new AgentError('UNKNOWN_TOOL','模型请求了未授权工具');
  return entry.schema?entry.schema.parse(input):input;
 }
 async execute(name:string,input:unknown,scope:S,context?:ToolExecutionContext):Promise<CapabilityResult<unknown>>{
  const entry=this.entries.get(name);if(!entry)throw new AgentError('UNKNOWN_TOOL','模型请求了未授权工具');
  if(!entry.handler||entry.definition.status!=='ready')throw new CapabilityUnavailableError('工具尚未接入：'+name);
  if(!context||!context.actor.userId||!['admin','operator','viewer'].includes(context.actor.role)||context.actor.organizationId!==scope.organizationId||context.signal.aborted)throw new AgentError('INVALID_CONTEXT','执行范围无效或执行已结束',403);
  if(entry.definition.mode==='propose'&&(!context||!['admin','operator'].includes(context.actor.role)))throw new AgentError('FORBIDDEN_TOOL','当前角色不能保存或预览草稿',403);
  const parsed=entry.schema?entry.schema.parse(input):input;
  return entry.handler(parsed,scope,context);
 }
}

/** Registry membership, readiness, role, task choice and data mode must all agree. */
export function allowedTaskTools(registry:Pick<ToolRegistry,'listFor'>,actor:AgentActor,groups:readonly AgentTaskGroup[],mode:AgentTaskMode):ToolDefinition[]{
 if(!['admin','operator','viewer'].includes(actor.role))return [];
 const base=new Set<string>(baseTaskToolNames),selected=new Set<string>(baseTaskToolNames);
 for(const group of groups)for(const name of taskToolGroups[group]??[])selected.add(name);
 return registry.listFor(actor).filter(tool=>tool.status==='ready'&&selected.has(tool.name)&&taskToolAllowedInMode(tool.name,mode)&&(!base.has(tool.name)||tool.mode==='read'));
}
/** A model cannot bypass the selected list by inventing a tool call by name. */
export function assertAllowedTaskTool(name:string,allowed:readonly Pick<ToolDefinition,'name'>[]):void {
 if(!allowed.some(tool=>tool.name===name))throw new AgentError('TOOL_NOT_SELECTED','此工具未在本轮任务中启用，请先选择对应任务工具',403);
}
