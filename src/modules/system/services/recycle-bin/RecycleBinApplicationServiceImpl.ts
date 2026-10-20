import {NotFoundError} from '@/platform/api-error-handler';
import {queryRows,queryOne,execute,transaction,type DbClient} from '@/platform/database';
import type {RecycleBinApplicationService} from '@/modules/system/services/recycle-bin/RecycleBinApplicationService';
import type {ListRecycleBinItemsQuery} from '@/modules/system/services/recycle-bin/queries/index';
import type {BatchPermanentlyDeleteRecycleBinItemsCommand,BatchRestoreRecycleBinItemsCommand,PermanentlyDeleteRecycleBinItemCommand,RestoreRecycleBinItemCommand} from '@/modules/system/services/recycle-bin/commands/index';
import {RecycleBinItemType} from '@/shared/enums/index';
import type {RecycleBinItemListVO} from '@/modules/system/contracts/schemas/response/recycle-bin/index';
import {getClickHouseClient} from '@/modules/tag/server';

const tables:Record<RecycleBinItemType,{table:string;name:string;description:string}>={
 TAG:{table:'tag',name:'name',description:'description'},TAG_CATEGORY:{table:'tag_category',name:'name',description:'description'},
 SEGMENT:{table:'segment',name:'name',description:'description'},DATA_SOURCE:{table:'data_sources',name:'name',description:'description'},
 DATA_MODEL:{table:'data_model',name:'name',description:'description'},TARGET_TABLE:{table:'target_table',name:'table_name',description:'entity_type'},
 MODEL_COLUMN:{table:'model_column',name:'display_name',description:'description'},BITMAP_TABLE:{table:'bitmap_table',name:'name',description:'description'}
};
function definition(type:string){const value=tables[type as RecycleBinItemType];if(!value)throw new Error('不支持的回收站类型');return value;}
function ownership(tenantId?:string){return tenantId?[tenantId]:null;}

export class RecycleBinApplicationServiceImpl implements RecycleBinApplicationService {
 async listRecycleBinItems(query:ListRecycleBinItemsQuery):Promise<RecycleBinItemListVO>{
  const page=query.page||1,pageSize=query.pageSize||10;
  const types=query.type?[query.type]:Object.keys(tables) as RecycleBinItemType[];
  const parts=types.map(type=>{const def=definition(type);return `SELECT id,'${type}' AS type,${def.name} AS name,${def.description} AS description,
    delete_time AS "deletedAt",deleted_by AS "deletedBy",owned_by,to_jsonb(t)-'password' AS "originalData" FROM public.${def.table} t WHERE is_deleted=true`;});
  const conditions=['true'],values:unknown[]=[];
  const tenant=ownership(query.tenantFilter?.tenantId);
  if(tenant){values.push(...tenant);conditions.push('owned_by=$1::uuid');}
  if(query.keyword){if(query.keyword.length>100)throw new Error('关键词过长');values.push(`%${query.keyword.replace(/[%_\\]/g,'\\$&')}%`);conditions.push(`(name ILIKE $${values.length} OR description ILIKE $${values.length})`);}
  for(const [value,op] of [[query.deletedFrom,'>='],[query.deletedTo,'<=']] as const){if(value){if(!/^\d{4}-\d{2}-\d{2}/.test(value)||!Number.isFinite(new Date(value).getTime()))throw new Error('日期格式无效');values.push(value);conditions.push(`"deletedAt"${op}$${values.length}::timestamp`);}}
  const base=`FROM (${parts.join(' UNION ALL ')}) combined WHERE ${conditions.join(' AND ')}`;
  const [items,count]=await Promise.all([queryRows(`SELECT id,type,name,description,"deletedAt","deletedBy","originalData" ${base} ORDER BY "deletedAt" DESC,id LIMIT $${values.length+1} OFFSET $${values.length+2}`,[...values,pageSize,(page-1)*pageSize]),queryOne(`SELECT COUNT(*)::int AS total ${base}`,values)]);
  const totalCount=Number(count?.total??0);
  return {items:items.map(item=>({...item,deletedAt:item.deletedAt instanceof Date?item.deletedAt.toISOString():item.deletedAt})) as RecycleBinItemListVO['items'],totalCount,page,pageSize,totalPages:Math.ceil(totalCount/pageSize)};
 }
 private async locked(id:string,type:string,tenantId:string|undefined,client:DbClient){
  const def=definition(type);
  const row=await queryOne(`SELECT *,delete_time::text AS "deletionTime" FROM public.${def.table} WHERE id=$1::uuid AND is_deleted=true FOR UPDATE`,[id],client);
  if(!row)throw new NotFoundError('回收站项目');
  const allowed=ownership(tenantId);if(allowed&&!allowed.includes(row.owned_by))throw new NotFoundError('回收站项目');
  return {def,row};
 }
 private async restore(id:string,type:string,restoredBy:string,tenantId:string|undefined,client:DbClient){
  const {def,row}=await this.locked(id,type,tenantId,client);
  await execute(`UPDATE public.${def.table} SET is_deleted=false,delete_time=NULL,deleted_by=NULL,updated_by=$2,update_time=NOW()${type==='TAG'?",status='INACTIVE'":''} WHERE id=$1`,[id,restoredBy],client);
  if(type==='SEGMENT')for(const table of ['segment_condition','segment_calculation_task','segment_member'])await execute(`UPDATE ${table} SET is_deleted=false,delete_time=NULL,deleted_by=NULL,updated_by=$2,update_time=NOW() WHERE segment_id=$1 AND is_deleted AND delete_time=$3::timestamp`,[id,restoredBy,row.deletionTime],client);
  if(type==='DATA_MODEL')await execute(`UPDATE model_column SET is_deleted=false,delete_time=NULL,deleted_by=NULL,updated_by=$2,update_time=NOW() WHERE model_id=$1 AND is_deleted AND delete_time=$3::timestamp`,[id,restoredBy,row.deletionTime],client);
 }
 async restoreRecycleBinItem(command:RestoreRecycleBinItemCommand):Promise<{success:boolean}>{
  await transaction(client=>this.restore(command.id,command.type,command.restoredBy,command.tenantFilter?.tenantId,client));return {success:true};
 }
 async batchRestoreRecycleBinItems(command:BatchRestoreRecycleBinItemsCommand):Promise<{success:boolean;restoredCount:number}>{
  const unique=new Map(command.ids.map(item=>[`${item.type}:${item.id}`,item]));
  await transaction(async client=>{for(const item of unique.values())await this.restore(item.id,item.type,command.restoredBy,command.tenantFilter?.tenantId,client);});
  return {success:true,restoredCount:unique.size};
 }
 private async remove(id:string,type:string,tenantId:string|undefined,client:DbClient){
  const {def,row}=await this.locked(id,type,tenantId,client);
  if(type==='TAG'){
   await this.cleanupTagCHObjects(id,client);
   const configs=await queryRows('SELECT bitmap_table_id,bit_position FROM tag_storage_config WHERE tag_id=$1',[id],client);
   for(const cfg of configs)await execute(`UPDATE bitmap_table SET used_bits=COALESCE((SELECT jsonb_agg(elem) FROM jsonb_array_elements(used_bits) elem WHERE elem::int!=$2),'[]'::jsonb),update_time=NOW() WHERE id=$1`,[cfg.bitmap_table_id,cfg.bit_position],client);
   for(const table of ['materialized_view_config','tag_storage_config','tag_bitmap_sync_state','tag_refresh_log','tag_version'])await execute(`DELETE FROM ${table} WHERE tag_id=$1`,[id],client);
   await execute('UPDATE target_table SET tag_id=NULL,tag_version_id=NULL,update_time=NOW() WHERE tag_id=$1',[id],client);
  }
  if(type==='DATA_MODEL')await execute('DELETE FROM model_column WHERE model_id=$1',[id],client);
  if(type==='SEGMENT'){
   for(const table of ['segment_condition','segment_member','segment_calculation_task'])await execute(`DELETE FROM ${table} WHERE segment_id=$1`,[id],client);
   await execute('DELETE FROM education_segment_snapshot WHERE "segmentId"=$1',[id],client);
  }
  if(type==='TARGET_TABLE'||type==='BITMAP_TABLE'){
   const name=type==='TARGET_TABLE'?row.table_name:row.ch_table_name;
   if(name){try{const ch=getClickHouseClient();if(await ch.checkTableExists(name))await ch.dropTable(name);}catch{/* CH 清理由原有服务重试，不回滚本地回收站操作。 */}}
  }
  await execute(`DELETE FROM public.${def.table} WHERE id=$1 AND is_deleted=true`,[id],client);
 }
 async permanentlyDeleteRecycleBinItem(command:PermanentlyDeleteRecycleBinItemCommand):Promise<{success:boolean}>{
  await transaction(client=>this.remove(command.id,command.type,command.tenantFilter?.tenantId,client));return {success:true};
 }
 async batchPermanentlyDeleteRecycleBinItems(command:BatchPermanentlyDeleteRecycleBinItemsCommand):Promise<{success:boolean;deletedCount:number}>{
  const unique=new Map(command.ids.map(item=>[`${item.type}:${item.id}`,item]));
  await transaction(async client=>{for(const item of unique.values())await this.remove(item.id,item.type,command.tenantFilter?.tenantId,client);});
  return {success:true,deletedCount:unique.size};
 }
 private async cleanupTagCHObjects(tagId:string,client:DbClient){
  try{
   const ch=getClickHouseClient();
   const mvs=await queryRows('SELECT mv_name FROM materialized_view_config WHERE tag_id=$1 ORDER BY step_order DESC',[tagId],client);
   for(const mv of mvs){try{await ch.dropMaterializedView(mv.mv_name);}catch{}}
   const versions=await queryRows('SELECT version FROM tag_version WHERE tag_id=$1',[tagId],client);
   for(const version of versions)for(const suffix of ['enum_bitmap','bitmap']){try{await ch.dropMaterializedView(`mv_tag_${tagId}_v${version.version}_${suffix}`);}catch{}}
   const configs=await queryRows(`SELECT t.bit_position,b.ch_table_name FROM tag_storage_config t LEFT JOIN bitmap_table b ON b.id=t.bitmap_table_id WHERE t.tag_id=$1`,[tagId],client);
   for(const name of new Set(configs.filter(c=>c.ch_table_name).map(c=>c.ch_table_name))){try{await ch.dropTable(`${name}_enum`);}catch{}}
   for(const cfg of configs)if(cfg.ch_table_name&&cfg.bit_position!=null){try{await ch.resetBitmapBit(cfg.ch_table_name,cfg.bit_position);}catch{}}
  }catch{/* 历史 ClickHouse 对象可能已不存在。 */}
 }
}
