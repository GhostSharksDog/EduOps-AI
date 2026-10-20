import {createHash} from 'node:crypto';
import type {AuthorizedAnalysisScope,CapabilityResult} from '@/shared/contracts/analysis';
import {WorkflowError} from '@/shared/errors/workflow-error';
import type {ApproveKnowledgeSourceDTO,CreateKnowledgeSourceDTO,KnowledgeCapabilityVO,KnowledgeSearchOptions,KnowledgeSearchResultVO,KnowledgeSource,ReviseKnowledgeSourceDTO} from '../contracts';
import {chunkKnowledgeText} from '../domain/chunking';
import type {KnowledgeEmbeddingPort,KnowledgeRepository,KnowledgeStoredSource} from '../domain/ports';

export const contentHash=(text:string)=>createHash('sha256').update(text).digest('hex');
// 审核指纹同时绑定可编辑标题，防止只改标题而复用旧审核请求。
const revisionHash=(title:string,text:string)=>contentHash(JSON.stringify({title,content:text}));
// 仅保留白名单错误码，避免把供应商响应、连接串或材料正文显示给用户。
function indexFailure(error:unknown):string {
 const item=error as {code?:unknown;diagnostics?:{httpStatus?:unknown;networkReason?:unknown}}|null;
 let reason='知识准备失败';
 if(item?.code==='MODEL_NETWORK')reason='向量模型连接失败，请检查网络';
 else if(item?.code==='MODEL_TIMEOUT')reason='向量模型调用超时';
 else if(item?.code==='MODEL_HTTP'&&typeof item.diagnostics?.httpStatus==='number')reason='向量模型调用失败（HTTP '+item.diagnostics.httpStatus+'）';
 else if(item?.code==='INVALID_EMBEDDING')reason='向量模型响应校验失败';
 else if(typeof item?.code==='string'&&/^[0-9A-Z]{5}$/.test(item.code))reason='知识存储失败（数据库状态 '+item.code+'）';
 return reason+'，请重试；已有可检索版本继续使用。';
}
export function sourceVO(source:KnowledgeStoredSource,fingerprint?:string):KnowledgeSource {
 const {embeddingConfigFingerprint:_fingerprint,indexAttemptId:_attempt,...publicSource}=source;return {...publicSource,needsReindex:!!fingerprint&&source.isCurrent&&source.status==='approved'&&source.embeddingConfigFingerprint!==fingerprint};
}
export class KnowledgeApplicationService {
 constructor(private readonly repository:KnowledgeRepository,private readonly embeddings:KnowledgeEmbeddingPort){}
 async getCapability(organizationId:string):Promise<CapabilityResult<KnowledgeCapabilityVO>>{
  const config=this.embeddings.configuration();
  try{const rows=await this.repository.list(organizationId);return {status:config.configured?'ready':'unconfigured',message:config.configured?'可管理知识来源并检索审核通过的当前版本。':'知识来源管理可用；语义检索尚未配置，请联系管理员。',data:{sourceManagement:'ready',embeddingConfigured:config.configured,currentSources:rows.filter(s=>s.isCurrent&&s.status==='approved'&&s.indexStatus==='ready').length,needsReindex:rows.filter(s=>s.isCurrent&&s.embeddingConfigFingerprint!==config.fingerprint).length}};}
  catch{return {status:'error',message:'知识来源暂不可用，请检查数据服务。',data:null};}
 }
 async list(organizationId:string):Promise<KnowledgeSource[]>{return (await this.repository.list(organizationId)).map(s=>sourceVO(s,this.embeddings.configuration().fingerprint));}
 async get(id:string,organizationId:string):Promise<KnowledgeSource>{const source=await this.repository.get(id,organizationId);if(!source)throw new WorkflowError('知识版本不存在或无权访问',404);return sourceVO(source,this.embeddings.configuration().fingerprint);}
 async create(input:CreateKnowledgeSourceDTO,organizationId:string,actorId:string,operationKey?:string):Promise<KnowledgeSource>{
  const {reportId,...material}=input;
  if(reportId){
   const {reportService}=await import('@/modules/report/server');
   const report=await reportService.getFrozen(organizationId,reportId);
   if(report.status!=='completed'||!report.answer)throw new WorkflowError('仅成功的经营报告可作为摘要来源',409,'REPORT_NOT_READY');
   material.period={startDate:report.snapshot.scope.startDate,endDate:report.snapshot.scope.endDate};material.dataCutoff=report.snapshot.scope.dataCutoff;
   material.evidence=[{id:'report/'+report.id,kind:'metric',sourceId:report.id,version:contentHash(JSON.stringify(report.snapshot)),summary:'已冻结经营报告：'+material.period.startDate+' 至 '+material.period.endDate,scope:report.snapshot.scope,updatedAt:report.completedAt??report.createdAt}];
  }
  const fingerprint=revisionHash(material.title,material.content);
  return sourceVO(await (operationKey?this.repository.create(material,organizationId,actorId,fingerprint,operationKey):this.repository.create(material,organizationId,actorId,fingerprint)));
 }
 async revise(id:string,organizationId:string,input:ReviseKnowledgeSourceDTO):Promise<KnowledgeSource>{return sourceVO(await this.repository.revise(id,organizationId,{...input,contentHash:revisionHash(input.title,input.content)}));}
 async approveAndIndex(id:string,organizationId:string,actorId:string,input:ApproveKnowledgeSourceDTO):Promise<CapabilityResult<KnowledgeSource>>{
  const source=await this.repository.get(id,organizationId);if(!source)throw new WorkflowError('知识版本不存在或无权访问',404);
  if(source.version!==String(input.expectedVersion)||source.contentHash!==input.expectedContentHash)throw new WorkflowError('知识版本已变化，请刷新并重新审核',409);
  if(source.status==='superseded')throw new WorkflowError('旧版本不能重新批准，请创建新版本',409);
  const config=this.embeddings.configuration();if(!config.configured)return {status:'unconfigured',message:'语义检索尚未配置，本次未审核或建立索引。',data:null};
  if(source.isCurrent&&source.status==='approved'&&source.indexStatus==='ready'&&source.embeddingConfigFingerprint===config.fingerprint)return {status:'ready',message:'此版本已审核并可检索。',data:sourceVO(source)};
  const chunks=chunkKnowledgeText(source.content);if(!chunks.length||chunks.length>40)throw new WorkflowError('知识正文超出首期处理范围，请拆分来源',400);
  const claim=await this.repository.claimIndex(id,organizationId,actorId,input.expectedVersion,input.expectedContentHash,config);
  try{
   const vectors=await this.embeddings.embed(chunks);
   const dimensions=vectors[0]?.length;
   if(vectors.length!==chunks.length||!dimensions||dimensions>16000||vectors.some(v=>v.length!==dimensions||v.some(n=>!Number.isFinite(n))||!v.some(n=>n!==0)))throw new Error('向量响应无效');
   const completed=await this.repository.completeIndex(claim,chunks,vectors,config);
   return {status:'ready',message:completed.isCurrent?'知识已审核并可检索。':'此版本已完成准备，已有更新版本生效。',data:sourceVO(completed)};
  }catch(error){
   const message=indexFailure(error);
   await this.repository.failIndex(claim,message);
   return {status:'error',message,data:await this.repository.get(id,organizationId).then(s=>s?sourceVO(s):null)};
  }
 }
 async search(query:string,scope:AuthorizedAnalysisScope,options:KnowledgeSearchOptions={}):Promise<CapabilityResult<KnowledgeSearchResultVO>>{
  if(!query.trim()||query.length>1000)throw new WorkflowError('检索问题须为1至1000个字符',400);
  const config=this.embeddings.configuration();if(!config.configured)return {status:'unconfigured',message:'语义检索尚未配置，请联系管理员。',data:null};
  if(options.limit!==undefined&&(!Number.isInteger(options.limit)||options.limit<1||options.limit>5))throw new WorkflowError('检索数量须为1至5',400);
  if(options.minSimilarity!==undefined&&(!Number.isFinite(options.minSimilarity)||options.minSimilarity<0||options.minSimilarity>1))throw new WorkflowError('相似度阈值无效',400);
  try{options.signal?.throwIfAborted();const vectors=await this.embeddings.embed([query.trim()],{signal:options.signal});const vector=vectors[0];if(vectors.length!==1||!vector?.length||vector.some(n=>!Number.isFinite(n))||!vector.some(n=>n!==0))throw new Error('向量响应无效');
   const hits=await this.repository.search(vector,scope,config,{limit:options.limit??5,minSimilarity:options.minSimilarity??0.35,includeSnapshots:options.includeSnapshots??false});
   options.signal?.throwIfAborted();return {status:'ready',message:hits.length?'已找到审核通过的知识依据。':'未找到符合范围的知识依据；请调整问题或审核相关来源。',data:{query:query.trim(),hits}};
  }catch{return {status:'error',message:'知识检索暂不可用，请稍后重试。',data:null};}
 }
}
