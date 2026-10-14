import 'server-only';
import {randomUUID} from 'node:crypto';
import {execute,queryOne,queryRows,transaction,type DbClient} from '@/platform/database';
import {isLearningScope,isFinanceScope} from '@/shared/contracts/analysis';
import type {AuthorizedAnalysisScope,EvidenceReference} from '@/shared/contracts/analysis';
import {WorkflowError} from '@/shared/errors/workflow-error';
import type {CreateKnowledgeSourceDTO,KnowledgeKind,KnowledgeReviewStatus,KnowledgeIndexStatus} from '../contracts';
import type {KnowledgeIndexClaim,KnowledgeRepository,KnowledgeStoredSource} from '../domain/ports';

interface SourceRow {
 id:string;logicalSourceId:string;organizationId:string;version:number;title:string;kind:string;content:string;contentHash:string;status:string;isCurrent:boolean;indexStatus:string;
 embeddingModel:string|null;embeddingConfigFingerprint:string|null;embeddingDimensions:number|null;period:unknown;dataCutoff:Date|null;evidence:unknown;error:string|null;
 createdAt:Date;updatedAt:Date;approvedAt:Date|null;indexedAt:Date|null;indexAttemptId:string|null;
}
function stored(row:SourceRow):KnowledgeStoredSource {
 return {id:row.id,logicalSourceId:row.logicalSourceId,organizationId:row.organizationId,version:String(row.version),title:row.title,kind:row.kind as KnowledgeKind,content:row.content,contentHash:row.contentHash,status:row.status as KnowledgeReviewStatus,isCurrent:row.isCurrent,indexStatus:row.indexStatus as KnowledgeIndexStatus,embeddingModel:row.embeddingModel,embeddingConfigFingerprint:row.embeddingConfigFingerprint,embeddingDimensions:row.embeddingDimensions,
  ...(row.period?{period:row.period as {startDate:string;endDate:string}}:{}),...(row.dataCutoff?{dataCutoff:row.dataCutoff.toISOString()}:{}),evidence:row.evidence as EvidenceReference[],error:row.error,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),approvedAt:row.approvedAt?.toISOString()??null,indexedAt:row.indexedAt?.toISOString()??null,indexAttemptId:row.indexAttemptId};
}
async function familyLock(client:DbClient,organizationId:string,logicalSourceId:string){await execute('SELECT pg_advisory_xact_lock(hashtext($1))',[organizationId+':'+logicalSourceId],client);}
async function lockedVersion(client:DbClient,id:string,organizationId:string){
 return queryOne<SourceRow>('SELECT * FROM knowledge_source_version WHERE id=$1::uuid AND "organizationId"=$2::uuid FOR UPDATE',[id,organizationId],client);
}
export class DatabaseKnowledgeRepository implements KnowledgeRepository {
 async list(organizationId:string){return(await queryRows<SourceRow>('SELECT * FROM knowledge_source_version WHERE "organizationId"=$1::uuid ORDER BY "createdAt" DESC,version DESC LIMIT 300',[organizationId])).map(stored);}
 async get(id:string,organizationId:string){const row=await queryOne<SourceRow>('SELECT * FROM knowledge_source_version WHERE id=$1::uuid AND "organizationId"=$2::uuid',[id,organizationId]);return row?stored(row):null;}
 async create(input:CreateKnowledgeSourceDTO,organizationId:string,actorId:string,contentHash:string){
  const logicalSourceId=input.logicalSourceId??randomUUID();
  return transaction(async client=>{
   await familyLock(client,organizationId,logicalSourceId);let version=1;
   if(input.logicalSourceId){
    const previous=await queryOne<SourceRow>('SELECT * FROM knowledge_source_version WHERE "organizationId"=$1::uuid AND "logicalSourceId"=$2::uuid ORDER BY version DESC LIMIT 1',[organizationId,logicalSourceId],client);
    if(!previous)throw new WorkflowError('知识来源不存在或无权访问',404);
    if(previous.version!==input.expectedVersion)throw new WorkflowError('知识来源已有新版本，请刷新后重试',409);
    if(previous.kind!==input.kind)throw new WorkflowError('同一知识来源的类型不能改变',400);version=previous.version+1;
   }
   const row=await queryOne<SourceRow>(`INSERT INTO knowledge_source_version (id,"logicalSourceId","organizationId",version,title,kind,content,"contentHash",status,"isCurrent","indexStatus",period,"dataCutoff",evidence,"createdBy","createdAt","updatedAt") VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,'draft',FALSE,'pending',$9::jsonb,$10,$11::jsonb,$12::uuid,NOW(),NOW()) RETURNING *`,[randomUUID(),logicalSourceId,organizationId,version,input.title,input.kind,input.content,contentHash,JSON.stringify(input.period??null),input.dataCutoff?new Date(input.dataCutoff):null,JSON.stringify(input.evidence),actorId],client);
   return stored(row!);
  });
 }
 async revise(id:string,organizationId:string,input:{title:string;content:string;expectedContentHash:string;contentHash:string}){
  return transaction(async client=>{
   const row=await lockedVersion(client,id,organizationId);if(!row)throw new WorkflowError('知识版本不存在或无权访问',404);
   if(row.status!=='draft')throw new WorkflowError('已审核版本不能直接编辑，请创建新版本',409);if(row.contentHash!==input.expectedContentHash)throw new WorkflowError('知识正文已变化，请刷新后重试',409);
   const updated=await queryOne<SourceRow>(`UPDATE knowledge_source_version SET title=$3,content=$4,"contentHash"=$5,error=NULL,"indexStatus"='pending',"updatedAt"=NOW() WHERE id=$1::uuid AND "organizationId"=$2::uuid RETURNING *`,[id,organizationId,input.title,input.content,input.contentHash],client);return stored(updated!);
  });
 }
 async claimIndex(id:string,organizationId:string,actorId:string,expectedVersion:number,expectedContentHash:string,config:{model:string;fingerprint:string}){
  return transaction(async client=>{
   const row=await lockedVersion(client,id,organizationId);if(!row)throw new WorkflowError('知识版本不存在或无权访问',404);
   if(row.version!==expectedVersion||row.contentHash!==expectedContentHash)throw new WorkflowError('知识版本已变化，请刷新并重新审核',409);if(row.status==='superseded')throw new WorkflowError('旧版本不能重新批准',409);
   if(row.indexStatus==='indexing'&&Date.now()-row.updatedAt.getTime()<120000)throw new WorkflowError('此版本正在准备，请稍后刷新',409);
   const attemptId=randomUUID();
   const updated=await queryOne<SourceRow>(`UPDATE knowledge_source_version SET status='approved',"indexStatus"='indexing',"indexAttemptId"=$3::uuid,error=NULL,"approvedBy"=CASE WHEN "approvedAt" IS NULL THEN $4::uuid ELSE "approvedBy" END,"approvedAt"=COALESCE("approvedAt",NOW()),"embeddingModel"=$5,"embeddingConfigFingerprint"=$6,"updatedAt"=NOW() WHERE id=$1::uuid AND "organizationId"=$2::uuid RETURNING *`,[id,organizationId,attemptId,actorId,config.model,config.fingerprint],client);
   return {source:stored(updated!),attemptId};
  });
 }
 async completeIndex(claim:KnowledgeIndexClaim,chunks:string[],vectors:number[][],config:{model:string;fingerprint:string}){
  return transaction(async client=>{
   const org=claim.source.organizationId;await familyLock(client,org,claim.source.logicalSourceId);
   const row=await lockedVersion(client,claim.source.id,org);
   if(!row||row.indexAttemptId!==claim.attemptId||row.contentHash!==claim.source.contentHash||row.indexStatus!=='indexing')throw new WorkflowError('知识准备请求已失效，请刷新查看最新结果',409);
   await execute('DELETE FROM knowledge_chunk WHERE "versionId"=$1::uuid AND "organizationId"=$2::uuid',[row.id,org],client);
   for(let i=0;i<chunks.length;i++)await execute('INSERT INTO knowledge_chunk (id,"versionId","organizationId",ordinal,text,embedding,"embeddingModel","embeddingConfigFingerprint","embeddingDimensions","createdAt") VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::vector,$7,$8,$9,NOW())',[randomUUID(),row.id,org,i,chunks[i],JSON.stringify(vectors[i]),config.model,config.fingerprint,vectors[i].length],client);
   const current=await queryOne<SourceRow>('SELECT * FROM knowledge_source_version WHERE "organizationId"=$1::uuid AND "logicalSourceId"=$2::uuid AND "isCurrent"=TRUE ORDER BY version DESC LIMIT 1',[org,row.logicalSourceId],client);
   const isCurrent=!current||current.version<=row.version;
   if(isCurrent)await execute(`UPDATE knowledge_source_version SET "isCurrent"=FALSE,status='superseded',"updatedAt"=NOW() WHERE "organizationId"=$1::uuid AND "logicalSourceId"=$2::uuid AND "isCurrent"=TRUE AND id<>$3::uuid`,[org,row.logicalSourceId,row.id],client);
   const updated=await queryOne<SourceRow>(`UPDATE knowledge_source_version SET "isCurrent"=$3,status=$4,"indexStatus"='ready',"embeddingDimensions"=$5,"indexedAt"=NOW(),"indexAttemptId"=NULL,error=NULL,"updatedAt"=NOW() WHERE id=$1::uuid AND "organizationId"=$2::uuid RETURNING *`,[row.id,org,isCurrent,isCurrent?'approved':'superseded',vectors[0].length],client);
   return stored(updated!);
  },{timeoutMs:20000});
 }
 async failIndex(claim:KnowledgeIndexClaim,message:string){
  await execute(`UPDATE knowledge_source_version SET "indexStatus"='failed',"indexAttemptId"=NULL,error=$4,"updatedAt"=NOW() WHERE id=$1::uuid AND "organizationId"=$2::uuid AND "indexAttemptId"=$3::uuid AND "indexStatus"='indexing'`,[claim.source.id,claim.source.organizationId,claim.attemptId,message]);
 }
 async search(vector:number[],scope:AuthorizedAnalysisScope,config:{model:string;fingerprint:string},options:{limit:number;minSimilarity:number;includeSnapshots:boolean}){
  // 先固定检索范围与向量配置，再计算距离，避免跨机构或不同维数参与运算。
  const allowSnapshots=options.includeSnapshots&&!isLearningScope(scope)&&!isFinanceScope(scope)&&!scope.campusIds.length&&!scope.courseIds.length&&!scope.channelIds.length&&!scope.authorizedCampusIds.length;
  const parameters:unknown[]=[scope.organizationId,config.model,config.fingerprint,vector.length,JSON.stringify(vector),options.minSimilarity,options.limit];
  let snapshotFilter="AND s.kind <> 'analysis_snapshot'";
  if(allowSnapshots&&!isLearningScope(scope)&&!isFinanceScope(scope)){
   parameters.push(scope.startDate,scope.endDate);snapshotFilter=`AND (s.kind <> 'analysis_snapshot' OR ((s.period->>'startDate')=$8 AND (s.period->>'endDate')=$9 AND s."dataCutoff" IS NOT NULL`;
   if(scope.dataCutoff){parameters.push(new Date(scope.dataCutoff));snapshotFilter+=' AND s."dataCutoff"<=$10';}snapshotFilter+='))';
  }
  type HitRow={id:string;sourceId:string;logicalSourceId:string;version:number;title:string;kind:KnowledgeKind;text:string;similarity:number;updatedAt:Date;period:unknown;dataCutoff:Date|null;};
  const rows=await queryRows<HitRow>(`WITH filtered AS MATERIALIZED (SELECT c.id,s.id AS "sourceId",s."logicalSourceId",s.version,s.title,s.kind,c.text,c.embedding,s."updatedAt",s.period,s."dataCutoff" FROM knowledge_chunk c JOIN knowledge_source_version s ON s.id=c."versionId" AND s."organizationId"=c."organizationId" WHERE s."organizationId"=$1::uuid AND s.status='approved' AND s."isCurrent"=TRUE AND s."indexStatus"='ready' AND c.embedding IS NOT NULL AND c."embeddingModel"=$2 AND c."embeddingConfigFingerprint"=$3 AND c."embeddingDimensions"=$4 AND s."embeddingModel"=$2 AND s."embeddingConfigFingerprint"=$3 AND s."embeddingDimensions"=$4 ${snapshotFilter}) SELECT id,"sourceId","logicalSourceId",version,title,kind,text,(1-(embedding <=> $5::vector))::float8 AS similarity,"updatedAt",period,"dataCutoff" FROM filtered WHERE (1-(embedding <=> $5::vector))>=$6 ORDER BY embedding <=> $5::vector,id LIMIT $7`,parameters);
  return rows.map(row=>{const period=row.period as {startDate:string;endDate:string}|null;const evidence:EvidenceReference={id:row.id,kind:'knowledge',sourceId:row.sourceId,version:String(row.version),summary:row.text,updatedAt:row.updatedAt.toISOString(),...(period?{scope:{...period,campusIds:[],courseIds:[],channelIds:[],...(row.dataCutoff?{dataCutoff:row.dataCutoff.toISOString()}:{})}}:{})};return {id:row.id,sourceId:row.sourceId,logicalSourceId:row.logicalSourceId,version:String(row.version),title:row.title,kind:row.kind,text:row.text,similarity:row.similarity,evidence};});
 }
}

