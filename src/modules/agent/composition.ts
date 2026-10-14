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

export const toolRegistry=createAgentToolRegistry({metrics:{query:(id,scope,codes)=>operations.query(id,scope,codes),breakdown:async(id,scope,dimension)=>{if(dimension==='channel')return channels.breakdown(id,scope);const prepared=await operations.prepare(id,scope),groups=[];for(const r of prepared.snapshot.records.filter(r=>r.kind===dimension&&(!(dimension==='campus'?scope.campusIds:scope.courseIds).length||(dimension==='campus'?scope.campusIds:scope.courseIds).includes(r.sourceId))&&(dimension!=='campus'||!scope.authorizedCampusIds.length||scope.authorizedCampusIds.includes(r.sourceId))))groups.push({id:r.sourceId,name:String(r.payload.name),analysis:await operations.queryPrepared(prepared,{...scope,...(dimension==='campus'?{campusIds:[r.sourceId]}:{courseIds:[r.sourceId]})},undefined,false)});return groups;}},tags:riskTags,profiles:{list:org=>riskProfiles.summaries(org),query:(org,id)=>riskProfiles.query(org,id,undefined,{page:1,pageSize:1}) as Promise<RiskCrowdProfileVO>},knowledge:knowledgeService});
export const agentService=new AgentApplicationService({
  repository:new DatabaseAgentRepository(),registry:toolRegistry,
  financeRegistry:createFinanceToolRegistry({finance:financeAnalytics,knowledge:knowledgeService}),
  financeDatasetScope:(org,id,scope)=>financeAnalytics.resolveScope(id,{...scope,organizationId:org}),
  learningRegistry:createLearningToolRegistry({learning:learningAnalytics,knowledge:knowledgeService}),
  learningDatasetScope:(org,id,scope)=>learningAnalytics.resolveScope(id,{...scope,organizationId:org}),
  model:{chat:(messages,tools,options)=>new CloudModelClient({baseUrl:process.env.CHAT_API_BASE_URL??'',apiKey:process.env.CHAT_API_KEY??'',model:process.env.CHAT_MODEL??''}).chat(messages,tools,options)},
  configured:()=>modelConfiguration().chatConfigured,
  datasetScope:async(org,id,scope)=>{
    const {dataset}=await educationData.inspect(org,id);
    if(datasetAnalysisType(dataset)!=='operations')throw new AgentError('WRONG_ANALYSIS_MODE','公开学习数据请使用课程批次和相对日范围',400);
    return {...scope,observationCutoff:new Date(Math.min(Date.parse(dataset.dataCutoff),scope.dataCutoff?Date.parse(scope.dataCutoff):Infinity)).toISOString(),dataCutoff:new Date(Math.min(Date.parse(dataset.dataCutoff),scope.dataCutoff?Date.parse(scope.dataCutoff):Infinity,Date.parse(scope.endDate+'T23:59:59.999+08:00'))).toISOString()};
  },
  confirmTag:(org,user,id,version,token)=>riskTags.confirm(org,user,id,version,token),
  getTag:(org,id)=>riskTags.get(org,id),
});
export const getCapability=()=>agentService.getCapability();
