import {execute} from '@/platform/database';
import {config} from '@/platform/config/index';
import {tagOne,tagRows,ownershipSql} from './sql';
import type {MaterializedViewConfig} from './row-types';
import type {IMaterializedViewConfigRepository,MaterializedViewConfigData} from '../domain/ports/IMaterializedViewConfigRepository';
import {type TenantFilterOptions,createOwnershipError} from '@/platform/get-current-tenant';
export class DatabaseMaterializedViewConfigRepository implements IMaterializedViewConfigRepository {
  private data(r:MaterializedViewConfig):MaterializedViewConfigData{return {...r,updateTime:r.updateTime??undefined};}
  async create(d:MaterializedViewConfigData){const row=await tagOne<MaterializedViewConfig>('INSERT INTO materialized_view_config(id,tag_id,version_id,mv_name,mv_result_table,refresh_interval,step_order,is_cascade,owned_by,create_time,update_time) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',[d.id,d.tagId,d.versionId,d.mvName,d.mvResultTable,d.refreshInterval,d.stepOrder,d.isCascade,d.ownedBy??config.system.userId,d.createTime??new Date(),d.updateTime??null]);return this.data(row!);}
  private async one(where:string,params:unknown[],tenant?:TenantFilterOptions){const row=await tagOne<MaterializedViewConfig>('SELECT * FROM materialized_view_config WHERE '+where+' AND delete_time IS NULL'+ownershipSql(params,tenant)+' LIMIT 1',params);return row?this.data(row):null;}
  private async many(where:string,params:unknown[],tenant?:TenantFilterOptions){return(await tagRows<MaterializedViewConfig>('SELECT * FROM materialized_view_config WHERE '+where+' AND delete_time IS NULL'+ownershipSql(params,tenant)+' ORDER BY step_order ASC',params)).map(r=>this.data(r));}
  findById(id:string,tenant?:TenantFilterOptions){return this.one('id=$1',[id],tenant);}
  findByTagId(id:string,tenant?:TenantFilterOptions){return this.many('tag_id=$1',[id],tenant);}
  findByTagIdAndVersionId(id:string,version:string,tenant?:TenantFilterOptions){return this.many('tag_id=$1 AND version_id=$2',[id,version],tenant);}
  findByMvName(name:string,tenant?:TenantFilterOptions){return this.one('mv_name=$1',[name],tenant);}
  async update(d:MaterializedViewConfigData,tenant?:TenantFilterOptions){const params:unknown[]=[d.id,d.mvName,d.mvResultTable,d.refreshInterval,d.stepOrder,d.isCascade,d.updateTime??new Date()];const row=await tagOne<MaterializedViewConfig>('UPDATE materialized_view_config SET mv_name=$2,mv_result_table=$3,refresh_interval=$4,step_order=$5,is_cascade=$6,update_time=$7 WHERE id=$1 AND delete_time IS NULL'+ownershipSql(params,tenant)+' RETURNING *',params);if(!row)throw createOwnershipError('MaterializedViewConfig',d.id);return this.data(row);}
  async delete(id:string,tenant?:TenantFilterOptions){const params:unknown[]=[id];if(!await execute('UPDATE materialized_view_config SET delete_time=NOW() WHERE id=$1 AND delete_time IS NULL'+ownershipSql(params,tenant),params))throw createOwnershipError('MaterializedViewConfig',id);}
  async deleteByTagId(id:string,tenant?:TenantFilterOptions){const params:unknown[]=[id];await execute('UPDATE materialized_view_config SET delete_time=NOW() WHERE tag_id=$1 AND delete_time IS NULL'+ownershipSql(params,tenant),params);}
  async findAllWithTagName(tenant?:TenantFilterOptions){const params:unknown[]=[];return(await tagRows<MaterializedViewConfig&{tagName:string}>('SELECT mvc.*,t.name AS "tagName" FROM materialized_view_config mvc JOIN tag t ON t.id=mvc.tag_id WHERE mvc.delete_time IS NULL AND t.is_deleted=FALSE'+ownershipSql(params,tenant,'mvc.')+' ORDER BY mvc.create_time DESC',params)).map(r=>({...this.data(r),tagName:r.tagName}));}
}
const repository=new DatabaseMaterializedViewConfigRepository();
export const getDatabaseMaterializedViewConfigRepository=():IMaterializedViewConfigRepository=>repository;
