import type {AuthorizedScope,CapabilityResult} from '@/shared/contracts/analysis';
import type {ToolDefinition} from '../contracts';
import {CapabilityUnavailableError} from '@/shared/contracts/unavailable';
import type {z} from 'zod';
import type {ToolExecutionContext} from '../contracts';
import {AgentError} from '../domain/errors';
export type ToolHandler<S extends {organizationId:string}=AuthorizedScope>=(input:unknown,scope:S,context?:ToolExecutionContext)=>Promise<CapabilityResult<unknown>>;
export class ToolRegistry<S extends {organizationId:string}=AuthorizedScope> {
 private readonly entries=new Map<string,{definition:ToolDefinition;handler?:ToolHandler<S>;schema?:z.ZodType}>();
 register(definition:ToolDefinition,handler?:ToolHandler<S>,schema?:z.ZodType):void{
  if(this.entries.has(definition.name))throw new Error('工具名称重复：'+definition.name);
  if(!['read','propose'].includes(definition.mode))throw new Error('Agent工具仅支持读取和提出草稿');
  this.entries.set(definition.name,{definition,handler,schema});
 }
 list():ToolDefinition[]{return [...this.entries.values()].map(e=>({...e.definition}));}
 validateInput(name:string,input:unknown):unknown{
  const entry=this.entries.get(name);if(!entry)throw new AgentError('UNKNOWN_TOOL','模型请求了未授权工具');
  return entry.schema?entry.schema.parse(input):input;
 }
 async execute(name:string,input:unknown,scope:S,context?:ToolExecutionContext):Promise<CapabilityResult<unknown>>{
  const entry=this.entries.get(name);if(!entry)throw new AgentError('UNKNOWN_TOOL','模型请求了未授权工具');
  if(!entry.handler||entry.definition.status!=='ready')throw new CapabilityUnavailableError('工具尚未接入：'+name);
  if(context&&(context.actor.organizationId!==scope.organizationId||context.signal.aborted))throw new AgentError('INVALID_CONTEXT','执行范围无效或执行已结束',403);
  if(entry.definition.mode==='propose'&&(!context||!['admin','operator'].includes(context.actor.role)))throw new AgentError('FORBIDDEN_TOOL','当前角色不能保存或预览草稿',403);
  const parsed=entry.schema?entry.schema.parse(input):input;
  return entry.handler(parsed,scope,context);
 }
}
