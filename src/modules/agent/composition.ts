import 'server-only';
import {educationData} from '@/modules/education/server';
import {operations,channels,learningAnalytics} from '@/modules/analytics/server';
import {financeAnalytics} from '@/modules/finance/server';
import {datasetAnalysisType} from '@/modules/education/contracts';
import {createFinanceToolRegistry} from './services/finance-tools';
import {riskTags} from '@/modules/tag/server';
import {riskProfiles} from '@/modules/profile/server';
import {knowledgeService} from '@/modules/knowledge/server';
import type {RiskCrowdProfileVO} from '@/modules/profile/contracts';
import {CloudModelClient,modelConfiguration} from '@/platform/ai/client';
import {DatabaseAgentRepository} from './repositories/repository';
import {createAgentToolRegistry} from './services/tools';
import {createLearningToolRegistry} from './services/learning-tools';
import {AgentError} from './domain/errors';
import {AgentApplicationService} from './services/service';
import {ActionPlanService,defaultActionPorts} from './services/actions';
import {DatabaseActionPlanStore} from './services/action-store';
import {registerWorkflowTools} from './services/workflow-tools';
import {legacyConfirmation} from './services/legacy-confirmation';
import {agentEvidenceFingerprint,validateAgentKnowledge} from './services/evidence-freeze';
import {validateTaskObjects} from './services/task-objects';

export const toolRegistry=createAgentToolRegistry({metrics:{query:(id,scope,codes)=>operations.query(id,scope,codes),breakdown:async(id,scope,dimension)=>{if(dimension==='channel')return channels.breakdown(id,scope);const prepared=await operations.prepare(id,scope),groups=[];for(const r of prepared.snapshot.records.filter(r=>r.kind===dimension&&(!(dimension==='campus'?scope.campusIds:scope.courseIds).length||(dimension==='campus'?scope.campusIds:scope.courseIds).includes(r.sourceId))&&(dimension!=='campus'||!scope.authorizedCampusIds.length||scope.authorizedCampusIds.includes(r.sourceId))))groups.push({id:r.sourceId,name:String(r.payload.name),analysis:await operations.queryPrepared(prepared,{...scope,...(dimension==='campus'?{campusIds:[r.sourceId]}:{courseIds:[r.sourceId]})},undefined,false)});return groups;}},tags:riskTags,profiles:{list:org=>riskProfiles.summaries(org),query:(org,id)=>riskProfiles.query(org,id,undefined,{page:1,pageSize:1}) as Promise<RiskCrowdProfileVO>},knowledge:knowledgeService});
const repository=new DatabaseAgentRepository();
const actionStore=new DatabaseActionPlanStore();
export const agentActionService=new ActionPlanService(actionStore,defaultActionPorts);
const financeRegistry=createFinanceToolRegistry({finance:financeAnalytics,knowledge:knowledgeService});
const learningRegistry=createLearningToolRegistry({learning:learningAnalytics,knowledge:knowledgeService});
registerWorkflowTools(toolRegistry,{mode:'operations',actions:agentActionService});
registerWorkflowTools(financeRegistry,{mode:'finance',actions:agentActionService});
registerWorkflowTools(learningRegistry,{mode:'learning',actions:agentActionService});
export const agentService=new AgentApplicationService({
  repository,registry:toolRegistry,
  financeRegistry,
  financeDatasetScope:(org,id,scope)=>financeAnalytics.resolveScope(id,{...scope,organizationId:org}),
  learningRegistry,
  learningDatasetScope:(org,id,scope)=>learningAnalytics.resolveScope(id,{...scope,organizationId:org}),
  model:{chat:(messages,tools,options)=>new CloudModelClient({baseUrl:process.env.CHAT_API_BASE_URL??'',apiKey:process.env.CHAT_API_KEY??'',model:process.env.CHAT_MODEL??''}).chat(messages,tools,options)},
  configured:()=>modelConfiguration().chatConfigured,
  evidenceFingerprint:agentEvidenceFingerprint,
  validateKnowledge:validateAgentKnowledge,
  validateTaskObjects,
  scopeOptions:async(org,id)=>{const result=await educationData.inspect(org,id);return {dataset:{id:result.dataset.id,name:result.dataset.name,origin:result.dataset.origin,analysisType:datasetAnalysisType(result.dataset)},catalog:result.catalog.slice(0,100),dataCutoff:result.dataset.dataCutoff,completedBatches:result.batches.filter(b=>b.status==='completed').length};},
  datasetScope:async(org,id,scope)=>{
    const {dataset,catalog}=await educationData.inspect(org,id);
    if(datasetAnalysisType(dataset)!=='operations')throw new AgentError('WRONG_ANALYSIS_MODE','公开学习数据请使用课程批次和相对日范围',400);
    if(scope.campusIds.some(value=>!catalog.some(c=>c.kind==='campus'&&c.id===value))||scope.courseIds.some(value=>!catalog.some(c=>c.kind==='course'&&c.id===value)))throw new AgentError('INVALID_SCOPE','所选校区或课程不属于当前数据集',400);
    return {...scope,observationCutoff:new Date(Math.min(Date.parse(dataset.dataCutoff),scope.dataCutoff?Date.parse(scope.dataCutoff):Infinity)).toISOString(),dataCutoff:new Date(Math.min(Date.parse(dataset.dataCutoff),scope.dataCutoff?Date.parse(scope.dataCutoff):Infinity,Date.parse(scope.endDate+'T23:59:59.999+08:00'))).toISOString()};
  },
  confirmTag:(org,user,id,version,token)=>riskTags.confirm(org,user,id,version,token),
  getTag:(org,id)=>riskTags.get(org,id),
  confirmProposal:legacyConfirmation(repository,actionStore,agentActionService),
});
export const getCapability=()=>agentService.getCapability();
