// 只在显式 --connect 后加载模型配置；云端仅接收通用知识，不接触经营数据。
import {randomUUID} from 'node:crypto';
import type {AuthorizedScope} from '../../src/shared/contracts/analysis';
import type {KnowledgeEmbeddingPort} from '../../src/modules/knowledge/domain/ports';

const TEST_DATABASE_URL='postgresql://postgres:test_password@127.0.0.1:25432/education_phase4_test?schema=public';
const guardDatabase=()=>{
 const url=new URL(process.env.DATABASE_URL??'');
 if(url.protocol!=='postgresql:'||url.hostname!=='127.0.0.1'||url.port!=='25432'||url.pathname!=='/education_phase4_test'||!url.pathname.endsWith('_test'))throw new Error('TEST_DATABASE_GUARD');
};
function assert(condition:unknown):asserts condition {if(!condition)throw new Error('CHECK_FAILED');}

async function main(){
 if(!process.argv.includes('--connect')){
  console.log(JSON.stringify({status:'not_executed',configurationLoaded:false,networkRequests:0,databaseWrites:0},null,2));
  return;
 }
 const {config:loadEnv}=await import('dotenv');
 loadEnv({path:'.env.local',quiet:true});loadEnv({quiet:true});
 // 在导入数据库客户端或应用配置之前固定隔离库，覆盖本地真实数据库设置。
 process.env.DATABASE_URL=TEST_DATABASE_URL;
 guardDatabase();
 const organizationId=randomUUID(),otherOrganizationId=randomUUID(),actorId=randomUUID();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),180000);
 const result={status:'failed',stage:'configuration',dimensions:0,createdVersions:0,indexedVersions:0,retrievalHits:0,currentVersion:0,otherOrganizationHits:0,historyReadable:false,cleanupComplete:false};
 let db:(typeof import('../../src/platform/database'))['db']|undefined;
 let connectionVerified=false;
 try{
  const {createEmbeddingClient}=await import('../../src/platform/ai/client');
  const client=createEmbeddingClient();
  assert(client.configuration().configured);
  const endpoint=new URL(process.env.EMBEDDING_API_BASE_URL??'');
  // 只允许已确认的阿里云官方HTTPS接口，拒绝模板占位地址或其他目标。
  assert(endpoint.protocol==='https:'&&!endpoint.username&&!endpoint.password&&!endpoint.search&&!endpoint.hash);
  assert(['dashscope.aliyuncs.com','dashscope-intl.aliyuncs.com'].includes(endpoint.hostname)||/^[a-z0-9-]+\.[a-z0-9-]+\.maas\.aliyuncs\.com$/.test(endpoint.hostname));
  assert(!/[{}]|自己的|WorkspaceId|工作空间/.test(endpoint.href));
  const embeddings:KnowledgeEmbeddingPort={configuration:()=>client.configuration(),embed:(input,options)=>client.embed(input,{signal:options?.signal?AbortSignal.any([controller.signal,options.signal]):controller.signal})};
  result.stage='database';
  ({db}=await import('../../src/platform/database'));
  await db.query('SELECT 1');
  guardDatabase();
  const actual=(await db.query<{name:string}>(`SELECT current_database() AS name`)).rows;
  assert(actual.length===1&&actual[0].name==='education_phase4_test');
  await db.query(`SELECT '[1,0]'::vector <=> '[1,0]'::vector AS distance`);
  connectionVerified=true;
  const {DatabaseKnowledgeRepository}=await import('../../src/modules/knowledge/repositories/repository');
  const {KnowledgeApplicationService}=await import('../../src/modules/knowledge/services/service');
  const repository=new DatabaseKnowledgeRepository(),service=new KnowledgeApplicationService(repository,embeddings);
  const scope:AuthorizedScope={organizationId,authorizedCampusIds:[],startDate:'2026-10-01',endDate:'2026-10-31',campusIds:[],courseIds:[],channelIds:[]};
  result.stage='indexing';
  const fruit=await service.create({title:'通用测试知识：水果',kind:'definition',content:'苹果是一种水果，常被直接食用。香蕉也是水果。橙子属于柑橘类水果。此文档仅用于通用检索测试。',evidence:[]},organizationId,actorId);
  result.createdVersions++;
  const transport=await service.create({title:'通用测试知识：交通工具',kind:'definition',content:'自行车是一种交通工具，主要依靠骑行者脚踏提供动力。公交车是供公众乘坐的道路交通工具。此文档仅用于通用检索测试。',evidence:[]},organizationId,actorId);
  result.createdVersions++;
  for(const source of [fruit,transport]){
   const indexed=await service.approveAndIndex(source.id,organizationId,actorId,{expectedVersion:1,expectedContentHash:source.contentHash});
   assert(indexed.status==='ready'&&indexed.data?.isCurrent&&indexed.data.indexStatus==='ready');
   result.indexedVersions++;
   result.dimensions=indexed.data.embeddingDimensions??0;
   assert(result.dimensions>0);
  }
  result.stage='retrieval';
  const query='苹果属于什么类别？';
  const hits=await service.search(query,scope);
  assert(hits.status==='ready'&&hits.data&&hits.data.hits.length>0);
  assert(hits.data.hits[0].sourceId===fruit.id&&hits.data.hits[0].version==='1'&&hits.data.hits[0].text.includes('苹果'));
  assert(hits.data.hits[0].evidence.sourceId===fruit.id&&hits.data.hits[0].evidence.version==='1');
  result.retrievalHits=hits.data.hits.length;
  const bicycle=await service.search('哪种交通工具依靠脚踏提供动力？',scope);
  assert(bicycle.status==='ready'&&bicycle.data?.hits[0]?.sourceId===transport.id);
  result.stage='organization_isolation';
  const isolated=await service.search(query,{...scope,organizationId:otherOrganizationId});
  assert(isolated.status==='ready'&&isolated.data?.hits.length===0);
  result.otherOrganizationHits=isolated.data.hits.length;
  let blocked=false;
  try{await service.get(fruit.id,otherOrganizationId);}catch{blocked=true;}
  assert(blocked);
  result.stage='version_switch';
  const next=await service.create({title:fruit.title,kind:fruit.kind,content:'苹果是一种水果，也含有膳食纤维。香蕉也是水果。橙子属于柑橘类水果。此文档是通用检索测试的更新版本。',evidence:[],logicalSourceId:fruit.logicalSourceId,expectedVersion:1},organizationId,actorId);
  result.createdVersions++;
  const approved=await service.approveAndIndex(next.id,organizationId,actorId,{expectedVersion:2,expectedContentHash:next.contentHash});
  assert(approved.status==='ready'&&approved.data?.isCurrent&&approved.data.version==='2');
  result.indexedVersions++;
  const updated=await service.search(query,scope);
  assert(updated.status==='ready'&&updated.data?.hits[0]?.sourceId===next.id&&updated.data.hits[0].version==='2');
  assert(updated.data.hits.every(hit=>hit.sourceId!==fruit.id));
  const historical=await service.get(fruit.id,organizationId);
  assert(historical.version==='1'&&historical.status==='superseded'&&!historical.isCurrent);
  result.currentVersion=2;result.historyReadable=true;result.stage='complete';result.status='passed';
 }catch{
  // 禁止输出原始数据库或供应商异常，异常可能包含连接信息或请求内容。
  process.exitCode=1;
 }finally{
  clearTimeout(timer);
  if(db){
   try{
    if(connectionVerified){
     guardDatabase();
     // 仅清理此次随机生成机构，保留其他测试及业务记录。
     await db.query('DELETE FROM knowledge_chunk WHERE "organizationId"=$1',[organizationId]);
     await db.query('DELETE FROM knowledge_source_version WHERE "organizationId"=$1',[organizationId]);
     result.cleanupComplete=true;
    }
   }catch{result.status='failed';result.stage='cleanup';process.exitCode=1;}
   try{await db.end();}catch{result.status='failed';process.exitCode=1;}
  }
  console.log(JSON.stringify(result,null,2));
 }
}
main().catch(()=>{console.error(JSON.stringify({status:'failed',stage:'initialization'}));process.exitCode=1;});
