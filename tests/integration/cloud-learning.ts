// 实际DeepSeek＋阿里云验收。仅在显式--connect后执行，所有写入固定*_test库。
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import type {LearningMetric} from '../../src/modules/analytics/contracts/learning';
import type {AgentFactVO} from '../../src/modules/agent/contracts';

const testDatabase='postgresql://postgres:test_password@127.0.0.1:25432/education_cleanup_test';
const defaultOutput='tests/artifacts/full-public-learning-qa';
function check(condition:unknown,code:string):asserts condition {if(!condition)throw Error(code);}
function guard(){
 const url=new URL(process.env.DATABASE_URL??'');
 check(url.protocol==='postgresql:'&&url.hostname==='127.0.0.1'&&url.port==='25432'&&url.pathname==='/education_cleanup_test'&&url.pathname.endsWith('_test'),'TEST_DATABASE_GUARD');
 check(process.env.CLICKHOUSE_HOST==='127.0.0.1'&&process.env.CLICKHOUSE_PORT==='28123'&&process.env.CLICKHOUSE_DATABASE==='education_cleanup_test','TEST_CLICKHOUSE_GUARD');
}
function safeCode(error:unknown){const candidate=(error as {code?:unknown;message?:unknown})?.code??(error as {message?:unknown})?.message;return typeof candidate==='string'&&/^[A-Z0-9_]{2,80}$/.test(candidate)?candidate:'VERIFICATION_FAILED';}
interface Verification {
 status:'not_executed'|'failed'|'passed';stage:string;errorCode?:string|null;errorMessage?:string|null;errorType?:string;errorProperty?:string;errorModule?:string;
 embeddingDimensions?:number;indexedKnowledge?:boolean;tools?:string[];steps?:{tool:string;status:string;errorCode?:string}[];
 metricFacts?:number;answerFacts?:number;evidenceCount?:number;knowledgeEvidenceCount?:number;factsConsistent?:boolean;answerFactsConsistent?:boolean;scopeLocked?:boolean;writeToolsExposed?:boolean;proposals?:number;
 averageActiveDays?:number|null;activityCompleteness?:string;knownMetrics?:{code:string;value:number|null;unit:string;status:string}[];runId?:string;durationSeconds?:number;
 answerFormats?:{fields:{name:string;type:string;length?:number}[];issues:{path:string;code:string}[]}[];
}
async function main(){
 if(!process.argv.includes('--connect')){console.log(JSON.stringify({status:'not_executed',configurationLoaded:false,networkRequests:0,databaseWrites:0}));return;}
 const result:Verification={status:'failed',stage:'configuration'},started=performance.now();
 let db:(typeof import('../../src/platform/database'))['db']|undefined;
 try{
  // dotenv只填临时对象，仅复制模型变量；真实数据库配置不会进入连接池。
  const {config:loadEnv}=await import('dotenv'),modelEnvironment:Record<string,string>={};
  loadEnv({path:'.env.local',quiet:true,processEnv:modelEnvironment});loadEnv({quiet:true,processEnv:modelEnvironment});
  for(const key of ['CHAT_API_BASE_URL','CHAT_API_KEY','CHAT_MODEL','EMBEDDING_API_BASE_URL','EMBEDDING_API_KEY','EMBEDDING_MODEL'])if(modelEnvironment[key])process.env[key]=modelEnvironment[key];
  Object.assign(process.env,{DATABASE_URL:testDatabase,CLICKHOUSE_HOST:'127.0.0.1',CLICKHOUSE_PORT:'28123',CLICKHOUSE_USER:'default',CLICKHOUSE_PASSWORD:'test_password',CLICKHOUSE_DATABASE:'education_cleanup_test',CLICKHOUSE_CLUSTER:'',CLICKHOUSE_REPLICATED_DB:'false',JWT_SECRET:'public_learning_cloud_test_only_secret_long_enough',REDIS_URL:''});
  guard();
  check(['CHAT_API_BASE_URL','CHAT_API_KEY','CHAT_MODEL','EMBEDDING_API_BASE_URL','EMBEDDING_API_KEY','EMBEDDING_MODEL'].every(key=>Boolean(process.env[key])),'MODEL_CONFIGURATION_INCOMPLETE');
  result.stage='endpoint_guard';
  const chat=new URL(process.env.CHAT_API_BASE_URL??''),embedding=new URL(process.env.EMBEDDING_API_BASE_URL??'');
  check(chat.protocol==='https:'&&chat.hostname==='api.deepseek.com'&&!chat.username&&!chat.password&&!chat.search&&!chat.hash,'CLOUD_CHAT_ENDPOINT_GUARD');
  check(embedding.protocol==='https:'&&!embedding.username&&!embedding.password&&!embedding.search&&!embedding.hash&&(['dashscope.aliyuncs.com','dashscope-intl.aliyuncs.com'].includes(embedding.hostname)||/^[a-z0-9-]+\.[a-z0-9-]+\.maas\.aliyuncs\.com$/.test(embedding.hostname)),'CLOUD_EMBEDDING_ENDPOINT_GUARD');
  result.stage='database_guard';const database=await import('../../src/platform/database');db=database.db;
  check((await db.query<{name:string}>('SELECT current_database() AS name')).rows[0].name==='education_cleanup_test','TEST_DATABASE_GUARD');
  result.stage='clickhouse_guard';const {EducationEventsClient}=await import('../../src/platform/database/education-events');
  check((await new EducationEventsClient().queryRows<{name:string}>('SELECT currentDatabase() AS name'))[0].name==='education_cleanup_test','TEST_CLICKHOUSE_GUARD');
  result.stage='services';const {educationData}=await import('../../src/modules/education/composition'),{learningAnalytics}=await import('../../src/modules/analytics/composition'),{knowledgeService}=await import('../../src/modules/knowledge/composition');
  const {AgentApplicationService}=await import('../../src/modules/agent/services/service'),{DatabaseAgentRepository}=await import('../../src/modules/agent/repositories/repository'),{createLearningToolRegistry}=await import('../../src/modules/agent/services/learning-tools'),{ToolRegistry}=await import('../../src/modules/agent/services/registry'),{CloudModelClient,modelConfiguration}=await import('../../src/platform/ai/client');
  const {inspectAnswerFormat}=await import('../../src/modules/agent/domain/answer');
  const denyBusiness=async():Promise<never>=>{throw Error('BUSINESS_OPERATION_FORBIDDEN');};
  const learningRegistry=createLearningToolRegistry({learning:learningAnalytics,knowledge:knowledgeService});
  check(learningRegistry.list().length===2&&learningRegistry.list().every(tool=>tool.mode==='read'),'LEARNING_TOOL_EXPOSURE_INVALID');
  const cloudModel=new CloudModelClient({baseUrl:process.env.CHAT_API_BASE_URL!,apiKey:process.env.CHAT_API_KEY!,model:process.env.CHAT_MODEL!});
  const model:{chat:typeof cloudModel.chat}={chat:async(messages,tools,options)=>{const response=await cloudModel.chat(messages,tools,options);if(!response.message.tool_calls?.length&&response.message.content)(result.answerFormats??=[]).push(inspectAnswerFormat(response.message.content));return response;}};
  const agentService=new AgentApplicationService({repository:new DatabaseAgentRepository(),registry:new ToolRegistry(),learningRegistry,learningDatasetScope:(org,id,scope)=>learningAnalytics.resolveScope(id,{...scope,organizationId:org}),model,configured:()=>modelConfiguration().chatConfigured,datasetScope:denyBusiness,confirmTag:denyBusiness,getTag:denyBusiness});
  const {hashPassword}=await import('../../src/modules/identity/domain/password');
  const organizationId='6f40f555-5f1b-4d1f-807c-b209e817bfdd',actor={organizationId,userId:randomUUID(),role:'admin'};
  result.stage='dataset';
  const dataset=(await educationData.listDatasets(organizationId)).find(item=>item.key==='oulad-v1-sample-20000');check(dataset?.origin==='public','PUBLIC_SAMPLE_MISSING');
  const scope={organizationId,courseKeys:['AAA:2013J'],relativeDayStart:-25,relativeDayEnd:50},baseline=await learningAnalytics.query(dataset.id,scope);
  result.averageActiveDays=baseline.metrics.find(metric=>metric.code==='average_active_days')!.value;result.activityCompleteness=baseline.completeness.find(item=>item.kind==='oulad_activity')!.status;
  check(result.activityCompleteness==='partial'&&result.averageActiveDays===null,'SAMPLE_COMPLETENESS_INVALID');
  result.stage='account';
  await db.query('INSERT INTO local_user (id,username,password_hash,real_name,role,organization_id,enabled,updated_at) VALUES ($1::uuid,$2,$3,$4,$5,$6::uuid,true,NOW())',[actor.userId,'cloud_learning_'+randomUUID().slice(0,12),await hashPassword(randomUUID()),'公开学习云模型验收','admin',organizationId]);
  result.stage='knowledge';
  const source=await knowledgeService.create({title:'OULAD公开学习指标与相对日期云模型验收 '+new Date().toISOString(),kind:'definition',content:'OULAD是匿名公开教育学习数据，采用CC BY许可，不能描述为教培机构真实经营流水。课程批次由课程代号与开课批次组成，原始日期是相对开课日的天数，负值表示开课前，不能伪造实际开课日期。学习活动记录是原始文件的每日学习资源记录，sum_click表示学习点击次数，不能替代逐课签到或用于计算出勤率。匿名学员去重统计，学员课程记录按学员与课程批次组合统计。平均活跃天数需要完整课程名册和完整活动导入，部分采样时必须留空，不能外推全体学习行为。测评均分只包括评分已知且非免修的提交，缺失分数与免修单列。退出记录根据相对退出日期统计，不等同于教培经营流失。最终学习结果是课程结束时状态，不属于历史时点预测。当前验收数据的学习活动是采样，其余关联文件已完整导入。Agent仅允许只读学习查询与知识检索，不能建立经营标签、人群或经营报告。',evidence:[]},organizationId,actor.userId);
  const indexed=await knowledgeService.approveAndIndex(source.id,organizationId,actor.userId,{expectedVersion:1,expectedContentHash:source.contentHash});result.indexedKnowledge=indexed.status==='ready'&&Boolean(indexed.data?.isCurrent);result.embeddingDimensions=indexed.data?.embeddingDimensions??0;
  check(result.indexedKnowledge&&result.embeddingDimensions===1024,'KNOWLEDGE_INDEX_NOT_READY');
  result.stage='agent';
  const response=await agentService.run({message:'请查询固定范围中的全部公开学习指标并检索OULAD的点击、退出、相对日期及部分导入口径。请引用全部工具事实卡，保留无法计算指标的空值，用纯文字解释已知事实、待验证原因和建议，说明采样限制。不得将点击解释为出勤或将退出解释为经营流失，不创建经营标签、人群或报告。所有数值只通过事实卡展示。',datasetId:dataset.id,learningScope:{courseKeys:scope.courseKeys,relativeDayStart:scope.relativeDayStart,relativeDayEnd:scope.relativeDayEnd},requestKey:randomUUID()},actor);
  const run=response.data;result.runId=run?.id;result.errorCode=run?.errorCode;result.errorMessage=run?.errorMessage;result.tools=run?.steps.map(step=>step.tool);result.steps=run?.steps.map(step=>({tool:step.tool,status:step.status,...(step.errorCode?{errorCode:step.errorCode}:{})}));result.proposals=run?.proposals.length;result.evidenceCount=run?.evidence.length;result.answerFacts=run?.answer?.facts.length;
  check(run,'AGENT_RUN_MISSING');
  result.writeToolsExposed=run.steps.some(step=>!['query_learning_metrics','search_knowledge'].includes(step.tool));
  check(!result.writeToolsExposed&&run.steps.every(step=>step.status==='completed')&&run.proposals.length===0,'READ_ONLY_BOUNDARY_FAILED');
  check(run.steps.some(step=>step.tool==='query_learning_metrics')&&run.steps.some(step=>step.tool==='search_knowledge'),'MISSING_REQUIRED_TOOL');
  const queried=run.steps.filter(step=>step.tool==='query_learning_metrics').flatMap(step=>step.facts??[]);result.metricFacts=queried.length;
  const byCode=new Map<string,LearningMetric>(baseline.metrics.map(metric=>[metric.code,metric]));
  const equal=(fact:AgentFactVO)=>{const metric=byCode.get(fact.id.slice(fact.id.lastIndexOf(':')+1));return Boolean(metric&&metric.value===fact.value&&metric.unit===fact.unit&&metric.status===fact.status&&metric.label===fact.label&&fact.evidenceIds.length&&fact.evidenceIds.every(id=>run.evidence.some(evidence=>evidence.id===id)));};
  result.factsConsistent=queried.length===baseline.metrics.length&&queried.every(equal);check(result.factsConsistent,'FACT_VALUE_OR_EVIDENCE_MISMATCH');
  if(run.answer){result.answerFactsConsistent=run.answer.facts.length>0&&run.answer.facts.every(equal);check(result.answerFactsConsistent,'ANSWER_FACT_MISMATCH');}
  const knowledgeEvidence=run.evidence.filter(evidence=>evidence.kind==='knowledge');result.knowledgeEvidenceCount=knowledgeEvidence.length;check(knowledgeEvidence.some(evidence=>evidence.sourceId===source.id&&evidence.version==='1'),'REVIEWED_SOURCE_NOT_REFERENCED');
  const saved=await agentService.getSession(actor,run.sessionId);result.scopeLocked='courseKeys' in saved.session.scope&&JSON.stringify(saved.session.scope.courseKeys)===JSON.stringify(scope.courseKeys)&&saved.session.scope.relativeDayStart===scope.relativeDayStart&&saved.session.scope.relativeDayEnd===scope.relativeDayEnd;check(result.scopeLocked,'SESSION_SCOPE_MISMATCH');
  result.knownMetrics=baseline.metrics.map(metric=>({code:metric.code,value:metric.value,unit:metric.unit,status:metric.status}));
  check(response.status==='ready'&&run.status==='completed'&&run.answer,'AGENT_NOT_COMPLETE');result.status='passed';result.stage='complete';
 }catch(error){result.errorCode??=safeCode(error);const name=(error as {name?:unknown})?.name;if(typeof name==='string'&&/^[A-Za-z]{1,40}$/.test(name))result.errorType=name;if(error instanceof TypeError){result.errorProperty=error.message.match(/reading '([A-Za-z_$][A-Za-z_$0-9]*)'/)?.[1];result.errorModule=error.stack?.match(/src[\\/]([A-Za-z0-9_\\/.-]+\.ts):([0-9]+):/)?.slice(1).join(':');}process.exitCode=1;}finally{
  if(db)await db.end();result.durationSeconds=Math.round((performance.now()-started)/1000);
  const output=path.resolve(process.env.TEST_ARTIFACT_DIR??defaultOutput);await mkdir(output,{recursive:true});await writeFile(path.join(output,'cloud-learning.json'),JSON.stringify({...result,testedAt:new Date().toISOString(),database:'education_cleanup_test',payload:'匿名公开学习聚合事实和通用口径；不含成员明细',scope:{courseKeys:['AAA:2013J'],relativeDayStart:-25,relativeDayEnd:50}},null,2)+'\n');console.log(JSON.stringify(result,null,2));
 }
}
main().catch(error=>{console.error(JSON.stringify({status:'precondition_failed',stage:'initialization',errorCode:safeCode(error)}));process.exitCode=1;});
