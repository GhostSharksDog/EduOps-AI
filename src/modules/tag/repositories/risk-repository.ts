import 'server-only';
import {randomUUID} from 'node:crypto';
import {queryOne,queryRows,execute,transaction} from '@/platform/database';
import type {RiskDraftDTO,RiskProposalVO,RiskPreviewVO,PublishedRiskTagVO} from '../contracts/risk';
import type {RiskProposalRepository} from '../services/risk-service';
import type {AuthorizedScope} from '@/shared/contracts/analysis';
import {WorkflowError} from '@/shared/errors/workflow-error';
import {assertConfirmation} from '../domain/risk';
import {DatabaseTagRepository} from './DatabaseTagRepository';
import {Tag} from '../domain/entities/Tag';
import {TagVersion} from '../domain/entities/TagVersion';
import {TagStatus,TagValueType,UpdateCycle} from '@/shared/enums/index';
interface ProposalRow {id:string;organizationId:string;datasetId:string;name:string;scope:unknown;rule:unknown;version:number;status:string;preview:unknown;publishedTagId:string|null;createdBy:string;createdAt:Date;updatedAt:Date;}
const proposal=(r:ProposalRow):RiskProposalVO=>({...r,createdAt:r.createdAt.toISOString(),updatedAt:r.updatedAt.toISOString()}) as RiskProposalVO;
export class DatabaseRiskProposalRepository implements RiskProposalRepository {
  async list(org:string){return(await queryRows<ProposalRow>("SELECT * FROM education_risk_proposal WHERE \"organizationId\"=$1 ORDER BY \"createdAt\" DESC",[org])).map(proposal);}
  async get(org:string,id:string){const row=await queryOne<ProposalRow>("SELECT * FROM education_risk_proposal WHERE id=$1 AND \"organizationId\"=$2",[id,org]);if(!row)throw new WorkflowError('风险草稿不存在或无权访问',404);return proposal(row);}
  async create(org:string,user:string,input:RiskDraftDTO,scope:AuthorizedScope,operationKey?:string){
    if(operationKey&&operationKey.length>200)throw new WorkflowError('草稿操作编号过长',400);
    const row=await queryOne<ProposalRow>("INSERT INTO education_risk_proposal (id,\"organizationId\",\"createdBy\",\"datasetId\",name,scope,rule,\"agentOperationKey\") VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8) ON CONFLICT (\"organizationId\",\"agentOperationKey\") DO NOTHING RETURNING *",[randomUUID(),org,user,input.datasetId,input.name,JSON.stringify(scope),JSON.stringify(input.rule),operationKey??null]);
    const result=row??await queryOne<ProposalRow>("SELECT * FROM education_risk_proposal WHERE \"organizationId\"=$1 AND \"agentOperationKey\"=$2",[org,operationKey]);
    if(!result)throw new WorkflowError('草稿创建失败',503);
    const canonical=(v:unknown):string=>JSON.stringify(v,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);
    if(result.createdBy!==user||result.datasetId!==input.datasetId||result.name!==input.name||canonical(result.scope)!==canonical(scope)||canonical(result.rule)!==canonical(input.rule))throw new WorkflowError('重复操作的规则已变化，请新建请求',409);
    return proposal(result);
  }
  async edit(org:string,id:string,version:number,input:RiskDraftDTO,scope:AuthorizedScope){const row=await queryOne<ProposalRow>("UPDATE education_risk_proposal SET \"datasetId\"=$4,name=$5,scope=$6::jsonb,rule=$7::jsonb,version=version+1,status='draft',preview=NULL,\"updatedAt\"=NOW() WHERE id=$1 AND \"organizationId\"=$2 AND version=$3 AND status<>'published' RETURNING *",[id,org,version,input.datasetId,input.name,JSON.stringify(scope),JSON.stringify(input.rule)]);if(!row)throw new WorkflowError('草稿已变化或已发布，请刷新后操作',409,'VERSION_CONFLICT');return proposal(row);}
  async savePreview(org:string,id:string,version:number,preview:RiskPreviewVO){const row=await queryOne<ProposalRow>("UPDATE education_risk_proposal SET status='awaiting_confirmation',preview=$4::jsonb,\"updatedAt\"=NOW() WHERE id=$1 AND \"organizationId\"=$2 AND version=$3 AND status<>'published' RETURNING *",[id,org,version,JSON.stringify(preview)]);if(!row)throw new WorkflowError('草稿已变化或已发布，请刷新后重新预览',409,'VERSION_CONFLICT');return proposal(row);}
  async publish(org:string,user:string,id:string,version:number,token:string,validate:(p:RiskProposalVO)=>Promise<void>){
    const initial=await this.get(org,id);
    return transaction(async tx=>{
      await execute("SELECT pg_advisory_xact_lock(hashtext($1))",[initial.datasetId],tx);
      await execute("SELECT pg_advisory_xact_lock(hashtext($1))",[id],tx);
      const record=await queryOne<ProposalRow>("SELECT * FROM education_risk_proposal WHERE id=$1 AND \"organizationId\"=$2 FOR UPDATE",[id,org],tx);
      if(!record)throw new WorkflowError('风险草稿不存在或无权访问',404);
      const p=proposal(record);assertConfirmation(p,version,token);if(p.status==='published')return p;
      if(p.datasetId!==initial.datasetId)throw new WorkflowError('草稿数据源已变化，请重新确认');
      await validate(p);
      await execute("SELECT pg_advisory_xact_lock(hashtext($1))",[org+'-education-risk-category'],tx);
      const engine=p.preview!.calculatorVersion==='attendance-v1'?'education-attendance-v1':'education-business-rules-v1';
      let category=await queryOne<{id:string}>("SELECT id FROM tag_category WHERE owned_by=$1 AND is_deleted=FALSE AND feature->>'engine'=$2 LIMIT 1",[org,engine],tx);
      if(!category){const cid=randomUUID();category=await queryOne<{id:string}>("INSERT INTO tag_category(id,name,owned_by,path,created_by,feature) VALUES($1,$2,$3,$4,$5,$6::jsonb) RETURNING id",[cid,engine==='education-attendance-v1'?'教培出勤风险':'教培运营标签',org,cid,user,JSON.stringify({engine})],tx);}
      const now=new Date(),tagId=randomUUID(),versionId=randomUUID();
      const calculationRule=JSON.stringify({ruleType:engine==='education-attendance-v1'?'EDUCATION_ATTENDANCE':'EDUCATION_BUSINESS',ruleContent:JSON.stringify(p.rule),dataModelIds:[],scope:p.preview!.scope,sourceFingerprint:p.preview!.sourceFingerprint,proposalId:id,proposalVersion:version});
      const tagVersion=new TagVersion(versionId,tagId,org,now,user,version,'v'+version,'经确认的运营规则',false,{engine},now,undefined,undefined,undefined,true,undefined,calculationRule);
      const tag=new Tag(tagId,p.name,TagValueType.BOOLEAN,TagStatus.DRAFT,UpdateCycle.SNAPSHOT,org,category!.id,now,user,false,'运营筛选，依据冻结的数据批次',undefined,{engine,proposalId:id,memberCount:p.preview!.memberCount},undefined,versionId,tagVersion,[tagVersion]);tag.publish();
      await new DatabaseTagRepository().create(tag,tx);
      const published=await queryOne<ProposalRow>("UPDATE education_risk_proposal SET status='published',\"publishedTagId\"=$5,\"updatedAt\"=NOW() WHERE id=$1 AND \"organizationId\"=$2 AND version=$3 AND status='awaiting_confirmation' AND preview->>'token'=$4 RETURNING *",[id,org,version,token,tagId],tx);
      if(!published)throw new WorkflowError('预览已变化，请重新确认');return proposal(published);
    },{timeoutMs:30000});
  }
  async published(org:string,tagId:string):Promise<PublishedRiskTagVO>{
    const [record,tag]=await Promise.all([queryOne<ProposalRow>("SELECT * FROM education_risk_proposal WHERE \"organizationId\"=$1 AND \"publishedTagId\"=$2 AND status='published'",[org,tagId]),queryOne<{id:string}>("SELECT id FROM tag WHERE id=$1 AND owned_by=$2 AND is_deleted=FALSE AND status='ACTIVE'",[tagId,org])]);
    if(!record||!tag)throw new WorkflowError('已发布风险标签不存在或无权访问',404);const p=proposal(record);if(!p.preview)throw new WorkflowError('已发布标签缺少计算依据',409);return {tagId,name:p.name,proposalId:p.id,rule:p.rule,version:p.version,preview:p.preview};
  }
}
