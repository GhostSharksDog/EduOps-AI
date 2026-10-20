// 单次真实云图表验收。只使用隔离_test模拟数据；不保存模型内部输入或任何连接配置。
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import type {AgentActor,AgentRunVO} from '../../src/modules/agent/contracts';

const check=(value:unknown,code:string):void=>{if(!value)throw Error(code);};
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)])):value;
const fingerprint=(value:unknown)=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const containsKey=(value:unknown,keys:ReadonlySet<string>):boolean=>!!value&&typeof value==='object'&&(Array.isArray(value)?value.some(item=>containsKey(item,keys)):Object.entries(value).some(([key,item])=>keys.has(key)||containsKey(item,keys)));
async function main(){
 if(!process.argv.includes('--connect')){console.log(JSON.stringify({status:'not_executed',networkRequests:0,databaseWrites:0}));return;}
 const {config:loadEnvironment}=await import('dotenv'),models:Record<string,string>={};
 loadEnvironment({path:'.env.local',quiet:true,processEnv:models});loadEnvironment({quiet:true,processEnv:models});
 for(const name of ['CHAT_API_BASE_URL','CHAT_API_KEY','CHAT_MODEL','EMBEDDING_API_BASE_URL','EMBEDDING_API_KEY','EMBEDDING_MODEL'])if(models[name])process.env[name]=models[name];
 const chat=new URL(process.env.CHAT_API_BASE_URL??''),embedding=new URL(process.env.EMBEDDING_API_BASE_URL??'');
 check(chat.protocol==='https:'&&chat.hostname==='api.deepseek.com'&&!chat.username&&!chat.password&&!chat.search&&!chat.hash,'CLOUD_CHAT_ENDPOINT_GUARD');
 check(embedding.protocol==='https:'&&['dashscope.aliyuncs.com','dashscope-intl.aliyuncs.com'].includes(embedding.hostname)&&!embedding.username&&!embedding.password&&!embedding.search&&!embedding.hash,'CLOUD_EMBEDDING_ENDPOINT_GUARD');
 Object.assign(process.env,{DATABASE_URL:'postgresql://postgres:test_password@127.0.0.1:25432/education_cleanup_test',CLICKHOUSE_HOST:'127.0.0.1',CLICKHOUSE_PORT:'28123',CLICKHOUSE_USER:'default',CLICKHOUSE_PASSWORD:'test_password',CLICKHOUSE_DATABASE:'education_cleanup_test',CLICKHOUSE_CLUSTER:'',CLICKHOUSE_REPLICATED_DB:'false',COMPANY_REGISTRY_JSON:'',DEFAULT_COMPANY_CODE:'main',SYSTEM_USER_ID:'6f40f555-5f1b-4d1f-807c-b209e817bfdd',JWT_SECRET:'agent_assistance_cloud_test_secret_at_least_32_characters',REDIS_URL:''});
 const {runStandaloneTestCompany}=await import('../helpers/standalone-company');
 return runStandaloneTestCompany(async()=>{
  const {db,queryOne,execute}=await import('../../src/platform/database'),{educationData}=await import('../../src/modules/education/server'),{agentService,safeAgentError}=await import('../../src/modules/agent/server'),{DatabaseAgentRepository}=await import('../../src/modules/agent/repositories/repository'),{hashPassword}=await import('../../src/modules/identity/domain/password'),{CloudModelClient}=await import('../../src/platform/ai/client'),{agentVisualizationSchema}=await import('../../src/modules/agent/contracts/visualization'),{clientContextKey}=await import('../../src/modules/agent/domain/context-actions');
  const verifyExisting=process.argv.find(value=>value.startsWith('--verify-existing='))?.slice('--verify-existing='.length);
  if(verifyExisting){
   check(/^[0-9TZ-]+-[a-f0-9]{8}$/.test(verifyExisting),'EXISTING_ATTEMPT_GUARD');
   const output=path.resolve('tests/artifacts/agent-assistance-qa/cloud'),prior=JSON.parse(await readFile(path.join(output,'verification-'+verifyExisting+'.json'),'utf8'));
   check(prior.attemptId===verifyExisting&&prior.database==='education_cleanup_test'&&prior.run?.id&&prior.actorId,'EXISTING_METADATA_GUARD');
   const actor:AgentActor={organizationId:process.env.SYSTEM_USER_ID!,userId:prior.actorId,role:'admin'};
   try{
    check((await queryOne<{name:string}>('SELECT current_database() AS name'))?.name==='education_cleanup_test','TEST_DATABASE_GUARD');
    const saved=await new DatabaseAgentRepository().getRun(actor,prior.run.id),run=saved.run,steps=run.steps.filter(step=>step.status==='completed'),charts=steps.flatMap(step=>step.visualizations??[]),evidence=new Set(run.evidence.map(item=>item.id)),raw=await queryOne<{steps:AgentRunVO['steps']}>('SELECT steps FROM agent_execution WHERE id=$1 AND "organizationId"=$2 AND "createdBy"=$3',[run.id,actor.organizationId,actor.userId]);
    check(raw,'EXISTING_OWNERSHIP_GUARD');
    const shape=charts.map(chart=>({title:chart.title,kind:chart.kind,unit:chart.unit,categories:chart.categories.length,series:chart.series.length,points:chart.series.reduce((sum,series)=>sum+series.points.length,0),nullPoints:chart.series.reduce((sum,series)=>sum+series.points.filter(point=>point.value===null).length,0),zeroPoints:chart.series.reduce((sum,series)=>sum+series.points.filter(point=>point.value===0).length,0)}));
    const factsMatch=steps.every(step=>(step.visualizations??[]).every(chart=>chart.series.every(series=>series.points.every((point,index)=>{
     const facts=step.facts??[],code=chart.metricCodes.length===chart.categories.length?chart.metricCodes[index]:chart.metricCodes[0],category=chart.categories[index];
     const fact=chart.kind==='line'?facts.find(item=>item.id===step.id+':period:'+category):series.name==='本期'?facts.find(item=>item.id===step.id+':'+code):series.name==='对比期'?facts.find(item=>item.id===step.id+':previous:'+code):facts.find(item=>item.id.startsWith(step.id+':')&&item.id.endsWith(':'+code)&&item.label.startsWith(category+' '));
     return !!fact&&point.value===(fact.status==='ready'?fact.value:null)&&point.status===(fact.status==='ready'&&fact.value!==null?'ready':fact.status==='not_applicable'?'not_applicable':fact.status==='insufficient_data'?'insufficient_data':'unknown');
    }))));
    const checks={...prior.checks,repositoryRoundTrip:fingerprint(charts)===fingerprint(raw!.steps.filter(step=>step.status==='completed').flatMap(step=>step.visualizations??[])),originalChartSummaryUnchanged:fingerprint(shape)===fingerprint(prior.run.charts),chartValuesMatchFrozenFacts:factsMatch,visualizationSchema:charts.every(chart=>agentVisualizationSchema.safeParse(chart).success),scopeAndSource:!!run.context&&charts.every(chart=>chart.source.origin==='simulated'&&chart.source.analysisType==='operations'&&clientContextKey({datasetId:chart.source.datasetId,scope:chart.source.scope})===clientContextKey(run.context!)),evidenceReferences:charts.every(chart=>chart.evidenceIds.every(id=>evidence.has(id)))};
    const actual=await queryOne<{tags:number;segments:number;tasks:number;reports:number}>(`SELECT (SELECT count(*)::int FROM tag WHERE owned_by=$1 AND created_by=$2) tags,(SELECT count(*)::int FROM education_segment_snapshot WHERE "organizationId"=$1 AND "createdBy"=$2) segments,(SELECT count(*)::int FROM decision_task WHERE "organizationId"=$1 AND "createdBy"=$2) tasks,(SELECT count(*)::int FROM operational_report WHERE "organizationId"=$1 AND "createdBy"=$2) reports`,[actor.organizationId,actor.userId]);
    checks.noFormalObjectsCreated=fingerprint(actual)===fingerprint(prior.beforeObjects);
    const passed=run.status==='completed'&&!!run.answer&&Object.values(checks).every(Boolean),result={...prior,status:passed?'passed':'failed',errorCode:passed?null:'EXISTING_VERIFICATION_FAILED',errorMessage:passed?null:prior.errorMessage,checks,afterObjects:actual,recheck:{checkedAt:new Date().toISOString(),cloudRequests:0,originalVerificationStatus:prior.status,originalVerificationError:prior.errorCode,method:'同一已完成运行：数据库JSONB按对象键排序后与仓储输出对比；同时核对首次内存图形摘要及每个点对应的冻结事实。原始失败文件保持完整。'}};
    await writeFile(path.join(output,'verification-'+verifyExisting+'-recheck.json'),JSON.stringify(result,null,2)+'\n');await writeFile(path.join(output,'verification.json'),JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify({status:result.status,attemptId:verifyExisting,recheckOnly:true,newCloudCalls:0,originalCloudCalls:prior.modelAttempts.length,visualizations:charts.length,checks}));if(!passed)process.exitCode=1;
   }finally{await db.end();}
   return;
  }
  const output=path.resolve('tests/artifacts/agent-assistance-qa/cloud'),attemptId=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8),actor:AgentActor={organizationId:process.env.SYSTEM_USER_ID!,userId:randomUUID(),role:'admin'};
  const repository=new DatabaseAgentRepository(),originalChat=CloudModelClient.prototype.chat;
  type ModelAttempt={call:number;status:'running'|'completed'|'failed';durationMs:number;offeredTools:string[];returnedTools?:string[];json:boolean;formatCorrection:boolean;toolMessagesChecked:number;errorCode?:string;httpStatus?:number};
  const record={attemptId,status:'running',startedAt:new Date().toISOString(),completedAt:null as string|null,database:'education_cleanup_test',source:'第三版教培模拟数据',actorId:actor.userId,models:{chat:process.env.CHAT_MODEL??'',embedding:process.env.EMBEDDING_MODEL??''},durationMs:0,run:null as null|{id:string;sessionId:string;status:string;errorCode:string|null;completedTools:string[];failedTools:{tool:string;errorCode?:string}[];factCount:number;evidenceCount:number;visualizationCount:number;charts:{title:string;kind:string;unit:string;categories:number;series:number;points:number;nullPoints:number;zeroPoints:number}[]},modelAttempts:[] as ModelAttempt[],beforeObjects:null as unknown,afterObjects:null as unknown,checks:{strictTestDatabase:false,simulationReady:false,actualBusinessToolCompleted:false,visualizationsReturned:false,visualizationSchema:false,scopeAndSource:false,evidenceReferences:false,unknownValuesRemainNull:false,repositoryRoundTrip:false,noVisualizationsInModelToolMessages:true,noMemberDetailsInModelToolMessages:true,noFormalObjectsCreated:false,atMostOneFormatCorrection:false},errorCode:null as string|null,errorMessage:null as string|null,notes:['仅一次普通自然语言经营分析，真实云响应失败原样保留，不替换模板，不自动重新发起整轮。','只插入专用测试账号、会话与分析记录，不发布标签，不建立人群、任务或报告。','所有图表来自业务服务的实际计算，不由模型编造；内部模型消息仅在内存核验，不写入验收产物。']};
  await mkdir(output,{recursive:true});
  const save=async()=>{const text=JSON.stringify(record,null,2)+'\n';await writeFile(path.join(output,'verification-'+attemptId+'.json'),text);await writeFile(path.join(output,'verification.json'),text);};
  const counts=()=>queryOne<{tags:number;segments:number;tasks:number;reports:number}>(`SELECT (SELECT count(*)::int FROM tag WHERE owned_by=$1 AND created_by=$2) tags,(SELECT count(*)::int FROM education_segment_snapshot WHERE "organizationId"=$1 AND "createdBy"=$2) segments,(SELECT count(*)::int FROM decision_task WHERE "organizationId"=$1 AND "createdBy"=$2) tasks,(SELECT count(*)::int FROM operational_report WHERE "organizationId"=$1 AND "createdBy"=$2) reports`,[actor.organizationId,actor.userId]);
  CloudModelClient.prototype.chat=async function(...args){
   const started=performance.now(),messages=args[0],lastUser=messages.findLast(message=>message.role==='user'),attempt:ModelAttempt={call:record.modelAttempts.length+1,status:'running',durationMs:0,offeredTools:(args[1]??[]).map(tool=>tool.function.name),json:args[2]?.json===true,formatCorrection:!!lastUser?.content?.startsWith('回答校验未通过，错误代码：'),toolMessagesChecked:0};
   record.modelAttempts.push(attempt);
   try{
    for(const message of messages)if(message.role==='tool'){
     const payload=JSON.parse(message.content);attempt.toolMessagesChecked++;
     const noVisualizations=!containsKey(payload,new Set(['visualizations'])),noMembers=!containsKey(payload,new Set(['studentId','student_id','studentName','student_name','phone','mobile','memberDetails','members']));
     record.checks.noVisualizationsInModelToolMessages&&=noVisualizations;record.checks.noMemberDetailsInModelToolMessages&&=noMembers;
     check(noVisualizations,'MODEL_INPUT_CONTAINS_CHART_PAYLOAD');check(noMembers,'MODEL_INPUT_CONTAINS_MEMBER_DETAILS');
    }
    check(record.modelAttempts.filter(item=>item.formatCorrection).length<=1,'FORMAT_CORRECTION_BUDGET_EXCEEDED');
    const response=await originalChat.apply(this,args);attempt.status='completed';attempt.returnedTools=response.message.tool_calls?.map(call=>call.function.name)??[];return response;
   }catch(error){attempt.status='failed';const safe=error as {code?:string;diagnostics?:{httpStatus?:number}};attempt.errorCode=typeof safe.code==='string'?safe.code:'MODEL_OR_AUDIT_FAILED';attempt.httpStatus=safe.diagnostics?.httpStatus;throw error;}
   finally{attempt.durationMs=Math.round(performance.now()-started);await save();}
  };
  const started=performance.now();let responseRun:AgentRunVO|undefined;
  try{
   check((await queryOne<{name:string}>('SELECT current_database() AS name'))?.name==='education_cleanup_test','TEST_DATABASE_GUARD');record.checks.strictTestDatabase=true;
   const dataset=(await educationData.listDatasets(actor.organizationId)).find(item=>item.key==='training-sim-20261009-v3'&&item.origin==='simulated');check(dataset,'SIMULATION_V3_MISSING');
   const inspected=await educationData.inspect(actor.organizationId,dataset!.id);check(inspected.batches.some(batch=>batch.status==='completed')&&!inspected.batches.some(batch=>['running','validating'].includes(batch.status)),'SIMULATION_IMPORT_NOT_READY');record.checks.simulationReady=true;
   await execute('INSERT INTO local_user(id,username,password_hash,real_name,role,organization_id) VALUES($1,$2,$3,$4,\'admin\',$5)',[actor.userId,'agent_assistance_'+actor.userId,await hashPassword('ephemeral-'+randomUUID()),'图表真实云验收（模拟）',actor.organizationId]);
   record.beforeObjects=await counts();await save();
   const response=await agentService.run({datasetId:dataset!.id,scope:{startDate:'2026-08-01',endDate:'2026-08-31',campusIds:[],courseIds:['sim:course:1'],channelIds:[],dataCutoff:dataset!.dataCutoff},requestKey:randomUUID(),message:'帮我查看当前课程出勤，与同范围上期比较并按课程拆解。'},actor),run=response.data;check(run,'AGENT_RUN_MISSING');responseRun=run!;
   const completed=run!.steps.filter(step=>step.status==='completed'),charts=completed.flatMap(step=>step.visualizations??[]),evidence=new Set(run!.evidence.map(item=>item.id));
   record.run={id:run!.id,sessionId:run!.sessionId,status:run!.status,errorCode:run!.errorCode,completedTools:completed.map(step=>step.tool),failedTools:run!.steps.filter(step=>step.status==='failed').map(step=>({tool:step.tool,errorCode:step.errorCode})),factCount:completed.reduce((sum,step)=>sum+(step.facts?.length??0),0),evidenceCount:evidence.size,visualizationCount:charts.length,charts:charts.map(chart=>({title:chart.title,kind:chart.kind,unit:chart.unit,categories:chart.categories.length,series:chart.series.length,points:chart.series.reduce((sum,series)=>sum+series.points.length,0),nullPoints:chart.series.reduce((sum,series)=>sum+series.points.filter(point=>point.value===null).length,0),zeroPoints:chart.series.reduce((sum,series)=>sum+series.points.filter(point=>point.value===0).length,0)}))};
   record.checks.actualBusinessToolCompleted=completed.some(step=>['query_metrics','query_metric_breakdown'].includes(step.tool));record.checks.visualizationsReturned=charts.length>0;
   record.checks.visualizationSchema=charts.every(chart=>agentVisualizationSchema.safeParse(chart).success);
   record.checks.scopeAndSource=!!run!.context&&charts.every(chart=>chart.source.origin==='simulated'&&chart.source.analysisType==='operations'&&clientContextKey({datasetId:chart.source.datasetId,scope:chart.source.scope})===clientContextKey(run!.context!));
   record.checks.evidenceReferences=charts.every(chart=>chart.evidenceIds.length>0&&chart.evidenceIds.every(id=>evidence.has(id)));
   record.checks.unknownValuesRemainNull=charts.every(chart=>chart.series.every(series=>series.points.every(point=>point.status==='ready'||point.value===null)));
   const restored=await repository.getRun(actor,run!.id);record.checks.repositoryRoundTrip=fingerprint(charts)===fingerprint(restored.run.steps.filter(step=>step.status==='completed').flatMap(step=>step.visualizations??[]));
   record.checks.atMostOneFormatCorrection=record.modelAttempts.filter(item=>item.formatCorrection).length<=1;
   record.afterObjects=await counts();record.checks.noFormalObjectsCreated=fingerprint(record.beforeObjects)===fingerprint(record.afterObjects);
   check(record.checks.actualBusinessToolCompleted,'ACTUAL_BUSINESS_QUERY_MISSING');check(record.checks.visualizationsReturned,'REAL_VISUALIZATIONS_MISSING');
   for(const [name,passed]of Object.entries(record.checks))check(passed,'CHECK_'+name.replace(/[A-Z]/g,letter=>'_'+letter).toUpperCase());
   check(response.status==='ready'&&run!.status==='completed'&&!!run!.answer,run!.errorCode??'AGENT_ANALYSIS_FAILED');
   record.status='passed';
  }catch(error){const safe=safeAgentError(error);record.status='failed';record.errorCode=error instanceof Error&&/^[A-Z0-9_]{2,140}$/.test(error.message)?error.message:safe.code;record.errorMessage=safe.message;process.exitCode=1;}
  finally{
   CloudModelClient.prototype.chat=originalChat;record.durationMs=Math.round(performance.now()-started);record.completedAt=new Date().toISOString();
   try{record.afterObjects=await counts();if(record.beforeObjects!==null){record.checks.noFormalObjectsCreated=fingerprint(record.beforeObjects)===fingerprint(record.afterObjects);if(!record.checks.noFormalObjectsCreated){record.status='failed';record.errorCode='FORMAL_OBJECT_COUNTS_CHANGED';process.exitCode=1;}}}catch{record.status='failed';record.errorCode??='FINAL_OBJECT_CHECK_FAILED';process.exitCode=1;}
   if(responseRun&&!record.run)record.run={id:responseRun.id,sessionId:responseRun.sessionId,status:responseRun.status,errorCode:responseRun.errorCode,completedTools:responseRun.steps.filter(step=>step.status==='completed').map(step=>step.tool),failedTools:[],factCount:0,evidenceCount:0,visualizationCount:0,charts:[]};
   await save();await db.end();console.log(JSON.stringify({attemptId,status:record.status,errorCode:record.errorCode,cloudCalls:record.modelAttempts.length,durationMs:record.durationMs,visualizations:record.run?.visualizationCount??0,output}));
  }
 });
}
main().catch(error=>{const raw=(error as {message?:string})?.message;console.error(JSON.stringify({status:'precondition_failed',code:raw&&/^[A-Z0-9_]{2,140}$/.test(raw)?raw:'CLOUD_PRECONDITION_FAILED'}));process.exitCode=1;});
