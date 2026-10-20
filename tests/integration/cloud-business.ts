// 明确联网参数＋专用测试库；云端仅接收模拟聚合事实及通用口径。
import {randomUUID} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
async function main(){
 if(!process.argv.includes('--connect')){console.log('未联网；真实模型业务校验须显式--connect。');return;}
 const guard=()=>{const u=new URL(process.env.DATABASE_URL??'');if(u.hostname!=='127.0.0.1'||u.port!=='25432'||u.pathname!=='/education_cleanup_test')throw Error('TEST_DATABASE_GUARD');};guard();
 const {config}=await import('dotenv');config({path:'.env.local',quiet:true});config({quiet:true});guard();
 Object.assign(process.env,{COMPANY_REGISTRY_JSON:'',DEFAULT_COMPANY_CODE:'main',CLICKHOUSE_HOST:'127.0.0.1',CLICKHOUSE_PORT:'28123',CLICKHOUSE_USER:'default',CLICKHOUSE_PASSWORD:'test_password',CLICKHOUSE_DATABASE:'education_cleanup_test',SYSTEM_USER_ID:'6f40f555-5f1b-4d1f-807c-b209e817bfdd'});
 const {runStandaloneTestCompany}=await import('../helpers/standalone-company');
 return runStandaloneTestCompany(async()=>{
 const chat=new URL(process.env.CHAT_API_BASE_URL??''),embedding=new URL(process.env.EMBEDDING_API_BASE_URL??'');
 if(chat.protocol!=='https:'||chat.hostname!=='api.deepseek.com'||embedding.protocol!=='https:'||!['dashscope.aliyuncs.com','dashscope-intl.aliyuncs.com'].includes(embedding.hostname))throw Error('CLOUD_ENDPOINT_GUARD');
 const {db}=await import('../../src/platform/database'),{educationData}=await import('../../src/modules/education/composition'),{knowledgeService}=await import('../../src/modules/knowledge/composition');
 const {RiskTagService}=await import('../../src/modules/tag/services/risk-service'),{DatabaseRiskProposalRepository}=await import('../../src/modules/tag/repositories/risk-repository'),{OperationsService}=await import('../../src/modules/analytics/services/operations-service'),{DatabaseRiskSegmentRepository}=await import('../../src/modules/segment/repositories/risk-snapshot-repository'),{RiskProfileService}=await import('../../src/modules/profile/services/risk-profile-service');
 const riskTags=new RiskTagService(new DatabaseRiskProposalRepository(),educationData),profiles=new RiskProfileService(new DatabaseRiskSegmentRepository()),metrics=new OperationsService(educationData);
 const {AgentApplicationService}=await import('../../src/modules/agent/services/service'),{DatabaseAgentRepository}=await import('../../src/modules/agent/repositories/repository'),{createAgentToolRegistry}=await import('../../src/modules/agent/services/tools'),{CloudModelClient,modelConfiguration}=await import('../../src/platform/ai/client');
 const registry=createAgentToolRegistry({metrics,tags:riskTags,profiles:{list:org=>profiles.list(org),query:(org,id)=>profiles.query(org,id) as Promise<import('../../src/modules/profile/contracts').RiskCrowdProfileVO>},knowledge:knowledgeService});
 const agentService=new AgentApplicationService({repository:new DatabaseAgentRepository(),registry,model:new CloudModelClient({baseUrl:process.env.CHAT_API_BASE_URL!,apiKey:process.env.CHAT_API_KEY!,model:process.env.CHAT_MODEL!}),configured:()=>modelConfiguration().chatConfigured,datasetScope:async(org,id,scope)=>{const {dataset}=await educationData.inspect(org,id);return {...scope,observationCutoff:dataset.dataCutoff,dataCutoff:new Date(Math.min(Date.parse(dataset.dataCutoff),Date.parse(scope.endDate+'T23:59:59.999+08:00'))).toISOString()};},getTag:(org,id)=>riskTags.get(org,id),confirmTag:(org,user,id,version,token)=>riskTags.confirm(org,user,id,version,token)});
 const result:{status:string;stage:string;modelCalls?:string[];evidenceCount?:number;coverage?:number|null;errorCode?:string|null;approvedSource?:boolean;tagStatus?:string;runId?:string}={status:'failed',stage:'dataset'};
 try{
  if((await db.query('SELECT current_database() AS name')).rows[0].name!=='education_cleanup_test')throw Error('TEST_DATABASE_GUARD');
  const org='6f40f555-5f1b-4d1f-807c-b209e817bfdd',actor={organizationId:org,userId:randomUUID(),role:'admin'},dataset=(await educationData.listDatasets(org)).find(d=>d.key==='training-sim-20261009-v3');if(!dataset)throw Error('MISSING_SIMULATION');
  result.stage='knowledge';const source=await knowledgeService.create({title:'真实模型模拟业务校验口径 '+new Date().toISOString(),kind:'definition',content:'这是模拟教培运营的测试说明，不含真实学员信息。出勤率以实际出勤除以应出勤，未知签到不能当缺勤。到期续费待跟进按事实截止当天至未来期限，具备续费资格且尚未有效续费。组合条件必须在同一学员同校区同课程中同时满足。课时余额按有效合约累计购课减净课耗和完成退款，零余额另行核查。近期客诉按发生日期，不根据当前处理状态推断历史。所有发布必须由页面人工确认。',evidence:[]},org,actor.userId),approved=await knowledgeService.approveAndIndex(source.id,org,actor.userId,{expectedVersion:1,expectedContentHash:source.contentHash});result.approvedSource=approved.status==='ready';if(!result.approvedSource)throw Error('INDEX_FAILED');
  result.stage='agent';const response=await agentService.run({message:'请查询指标并检索出勤与续费标签口径，创建出勤率低于80%、应出勤至少4次且未来30天到期未续费的同校区同课程全部满足标签草稿，并预览人数，等待页面确认。所有具体数字放在工具事实引用中，文字只解释事实、待验证原因及建议。',datasetId:dataset.id,scope:{startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:['sim:course:1'],channelIds:[],dataCutoff:dataset.dataCutoff},requestKey:randomUUID()},actor);
  const run=response.data;result.runId=run?.id;result.errorCode=run?.errorCode;result.modelCalls=run?.steps.map(s=>s.tool);result.evidenceCount=run?.evidence.length;result.coverage=run?.proposals[0]?.estimatedCount;
  if(response.status!=='ready'||!run?.answer||run.proposals[0]?.rule?.type!=='all'||!run.proposals[0]?.previewToken)throw Error('AGENT_NOT_COMPLETE');
  const draft=await riskTags.get(org,run.proposals[0].id);result.tagStatus=draft.status;if(draft.status!=='awaiting_confirmation'||draft.publishedTagId!==null)throw Error('CONFIRMATION_BOUNDARY');result.status='passed';result.stage='complete';
 }catch{process.exitCode=1;}finally{
  await db.end();const out=process.env.TEST_ARTIFACT_DIR??'tests/artifacts/reviewer-upgrade-qa';await mkdir(out,{recursive:true});await writeFile(out+'/cloud-business.json',JSON.stringify({...result,testedAt:new Date().toISOString(),payload:'模拟聚合事实及通用口径，不含成员明细',database:'education_cleanup_test'},null,2)+'\n');console.log(JSON.stringify(result));
 }
 });
}
main().catch(error=>{console.error(JSON.stringify({status:'precondition_failed',name:error?.name,code:/^[A-Z_]+$/.test(error?.code??error?.message??'')?(error.code??error.message):'PRECONDITION_ERROR'}));process.exitCode=1;});
