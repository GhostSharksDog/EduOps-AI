import {z} from 'zod';
import {analysisScopeSchema,learningScopeSchema,financeScopeSchema} from '@/shared/contracts/analysis';
import type {AuthorizedAnalysisScope} from '@/shared/contracts/analysis';
import {ToolRegistry} from './registry';
import {AgentError} from '../domain/errors';

export function registerScopeTools<S extends AuthorizedAnalysisScope>(registry:ToolRegistry<S>,mode:'operations'|'learning'|'finance',options:(org:string,datasetId:string)=>Promise<unknown>){
  registry.register({name:'query_scope_options',description:'查询当前数据集可选择的校区、课程或课程批次、财务年度。不返回学员资料，选择条件使用查询返回的编号。',mode:'read',status:'ready',parameters:{type:'object',properties:{},additionalProperties:false}},async(_raw,scope,context)=>{
    if(!context)throw new AgentError('INVALID_CONTEXT','缺少已验证身份',403);
    const result=await options(scope.organizationId,context.datasetId);
    return {status:'ready',message:'已查询可选范围',data:{result,evidence:[],facts:[]}};
  },z.object({}).strict());
  const range=mode==='learning'?learningScopeSchema:mode==='finance'?financeScopeSchema:analysisScopeSchema;
  const input=z.object({scope:range}).strict();
  registry.register({name:'change_analysis_scope',description:'仅在用户明确指定新周期或筛选条件时，调整当前数据集的分析范围；公司和数据集不可修改。准备标签或操作计划之前调用，随后重新查询。条件不明确先询问用户。',mode:'read',status:'ready',parameters:z.toJSONSchema(input)},async(raw,_scope,context)=>{
    if(!context?.changeScope)throw new AgentError('INVALID_CONTEXT','本轮不能调整范围',409);
    const result=await context.changeScope((raw as {scope:unknown}).scope);
    return {status:'ready',message:'已调整范围，请重新查询数据',data:{result,evidence:[],facts:[]}};
  },input);
}
