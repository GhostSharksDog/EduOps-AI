import {transaction, execute, type DbClient} from '@/platform/database';
import {config} from '@/platform/config/index';
import type {TagRepository} from '../domain/ports/TagRepository';
import {Tag, TagCategory, TagVersion} from '../domain/entities/index';
import {TagAdapterImpl} from './TagAdapterImpl';
import {TagVersionAdapterImpl} from './TagVersionAdapterImpl';
import {TagCategoryAdapterImpl} from './TagCategoryAdapterImpl';
import type {DeleteTagCategoryCommand} from '../contracts/commands/index';
import type {Tag as TagRow, TagCategory as CategoryRow, TagVersion as VersionRow, TagStorageConfig} from './row-types';
import type {TagStorageConfigData} from '../domain/ports/ITagStorageConfigRepository';
import {tagOne, tagRows, ownershipSql, jsonParam} from './sql';
import {type TenantFilterOptions, verifyOwnership, createOwnershipError} from '@/platform/get-current-tenant';
import {NotFoundException} from '@/shared/errors/index';

type CategoryFilter = {skip?:number;take?:number;keyword?:string;tenantFilter?:TenantFilterOptions;id?:string;ownedBy?:string;parentId?:string|null;name?:string;path?:string|{startsWith?:string};isDeleted?:boolean};
export class DatabaseTagRepository implements TagRepository {
  private tagAdapter=new TagAdapterImpl();
  private tagVersionAdapter=new TagVersionAdapterImpl();
  private categoryAdapter=new TagCategoryAdapterImpl();

  private async hydrate(rows:TagRow[],client?:DbClient):Promise<Tag[]> {
    if(!rows.length)return [];
    const ids=rows.map(t=>t.id),categories=[...new Set(rows.map(t=>t.categoryId))];
    const [versions,cats,configs,targets]=await Promise.all([
      tagRows<VersionRow>('SELECT * FROM tag_version WHERE tag_id=ANY($1::uuid[])',[ids],client,'version'),
      tagRows<CategoryRow>('SELECT * FROM tag_category WHERE id=ANY($1::uuid[])',[categories],client),
      tagRows<TagStorageConfig>('SELECT * FROM tag_storage_config WHERE tag_id=ANY($1::uuid[]) AND delete_time IS NULL',[ids],client),
      tagRows<{id:string;tagId:string}>('SELECT id,tag_id FROM target_table WHERE tag_id=ANY($1::uuid[]) AND is_deleted=FALSE',[ids],client)
    ]);
    return rows.map(row=>{
      const config=configs.find(c=>c.tagId===row.id);
      const storage:TagStorageConfigData|null=config?{...config,updateTime:config.updateTime??undefined,createdBy:config.createdBy??undefined,updatedBy:config.updatedBy??undefined,deletedBy:config.deletedBy??undefined}:null;
      const tag=this.tagAdapter.fromPOToTagEntity(row,versions.filter(v=>v.tagId===row.id),cats.find(c=>c.id===row.categoryId),storage);
      tag.targetTableId=targets.find(t=>t.tagId===row.id)?.id;return tag;
    });
  }
  async create(tag:Tag,tx?:DbClient):Promise<Tag>{
    const save=async(client:DbClient)=>{
      const p=this.tagAdapter.fromTagToTagPO(tag);
      const category=await tagOne<CategoryRow>('SELECT * FROM tag_category WHERE id=$1 FOR SHARE',[p.categoryId],client);
      if(!category||category.isDeleted||!(category.ownedBy===p.ownedBy||category.ownedBy===config.system.userId))throw new NotFoundException('TAG_CATEGORY_NOT_FOUND','TagCategory',p.categoryId);
      const row=await tagOne<TagRow>(
        'INSERT INTO tag(id,name,owned_by,description,value_type,category_id,status,is_deleted,is_public,feature,update_cycle,current_version_id,create_time,update_time,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,FALSE,$8,$9::jsonb,$10,$11,$12,$13,$14,$15) RETURNING *',
        [p.id,p.name,p.ownedBy,p.description,p.valueType||'STRING',p.categoryId,p.status||'DRAFT',p.isPublic||false,jsonParam(p.feature),p.update_cycle,p.currentVersionId,p.createTime||new Date(),p.updateTime||new Date(),p.createdBy,p.updatedBy],client,'tag');
      for(const version of tag.versions)await this.insertVersion(version,p.valueType,client);
      return (await this.hydrate([row!],client))[0];
    };
    return tx?save(tx):transaction(save);
  }
  async findById(id:string,tenantFilter?:TenantFilterOptions){const params:unknown[]=[id];const row=await tagOne<TagRow>('SELECT * FROM tag WHERE id=$1 AND is_deleted=FALSE'+ownershipSql(params,tenantFilter),params,undefined,'tag');return row?(await this.hydrate([row]))[0]:null;}
  async findByName(name:string,tenantFilter?:TenantFilterOptions){const params:unknown[]=[name];const row=await tagOne<TagRow>('SELECT * FROM tag WHERE name=$1 AND is_deleted=FALSE'+ownershipSql(params,tenantFilter)+' LIMIT 1',params,undefined,'tag');return row?(await this.hydrate([row]))[0]:null;}
  async findAll(filter?:{ownedBy?:string;skip?:number;take?:number;ids?:string[];categoryId?:string;name?:string;status?:string;isPublic?:boolean;tenantFilter?:TenantFilterOptions}){
    const f=filter??{},params:unknown[]=[],where=['is_deleted=FALSE'];
    const eq=(column:string,value:unknown)=>{if(value!==undefined){params.push(value);where.push(column+'=$'+params.length);}};
    if(f.ownedBy)eq('owned_by',f.ownedBy);if(f.categoryId)eq('category_id',f.categoryId);if(f.status)eq('status',f.status);eq('is_public',f.isPublic);
    if(f.name){params.push(f.name);where.push('strpos(lower(name),lower($'+params.length+'))>0');}
    if(f.ids?.length){params.push(f.ids);where.push('id=ANY($'+params.length+'::uuid[])');}
    let sql='SELECT * FROM tag WHERE '+where.join(' AND ')+ownershipSql(params,f.tenantFilter)+' ORDER BY create_time DESC';
    if(f.take!==undefined){params.push(f.take);sql+=' LIMIT $'+params.length;}if(f.skip!==undefined){params.push(f.skip);sql+=' OFFSET $'+params.length;}
    return this.hydrate(await tagRows<TagRow>(sql,params,undefined,'tag'));
  }
  async update(tag:Tag,tenantFilter?:TenantFilterOptions):Promise<Tag>{
    return transaction(async tx=>{
      const old=await tagOne<TagRow>('SELECT * FROM tag WHERE id=$1 FOR UPDATE',[tag.id],tx,'tag');
      if(!old||!verifyOwnership(old.ownedBy,tenantFilter))throw createOwnershipError('Tag',tag.id);
      const p=this.tagAdapter.fromTagToTagPO(tag);
      const row=await tagOne<TagRow>('UPDATE tag SET name=$2,description=$3,category_id=$4,status=$5,value_type=$6,feature=$7::jsonb,update_cycle=$8,is_public=$9,current_version_id=$10,update_time=NOW(),updated_by=$11 WHERE id=$1 RETURNING *',[tag.id,p.name,p.description,p.categoryId,p.status,p.valueType||'STRING',jsonParam(p.feature),p.update_cycle,p.isPublic,p.currentVersionId,p.updatedBy],tx,'tag');
      for(const version of tag.versions??[]){const v=this.tagVersionAdapter.fromTagVersionEntityToPO(version);
        if(version.id===tag.currentVersionId)await execute('UPDATE tag_version SET is_current=$2,calculation_rule=$3::jsonb,updated_by=$4,update_time=NOW() WHERE id=$1 AND tag_id=$5',[v.id,v.isCurrent,jsonParam(v.calculationRule??{dataModelIds:[]}),v.updatedBy,tag.id],tx);
        else await execute('UPDATE tag_version SET is_current=$2,update_time=NOW() WHERE id=$1 AND tag_id=$3',[v.id,v.isCurrent,tag.id],tx);
      }
      return (await this.hydrate([row!],tx))[0];
    });
  }
  async delete(id:string,deletedBy?:string,tenantFilter?:TenantFilterOptions){const params:unknown[]=[id,deletedBy??null];const count=await execute('UPDATE tag SET is_deleted=TRUE,delete_time=NOW(),deleted_by=$2 WHERE id=$1'+ownershipSql(params,tenantFilter),params);if(!count)throw createOwnershipError('Tag',id);}
  async restore(id:string,tenantFilter?:TenantFilterOptions){const params:unknown[]=[id];const row=await tagOne<TagRow>("UPDATE tag SET is_deleted=FALSE,delete_time=NULL,deleted_by=NULL,status='INACTIVE',update_time=NOW() WHERE id=$1"+ownershipSql(params,tenantFilter)+' RETURNING *',params,undefined,'tag');if(!row)throw createOwnershipError('Tag',id);return (await this.hydrate([row]))[0];}

  private async insertVersion(version:TagVersion,valueType:string,client?:DbClient){const p=this.tagVersionAdapter.fromTagVersionEntityToPO(version);return tagOne<VersionRow>('INSERT INTO tag_version(id,name,owned_by,description,tag_id,version,value_type,calculation_rule,is_current,is_deleted,feature,enum_values,create_time,update_time,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15,$16) RETURNING *',[p.id,p.name,p.ownedBy,p.description,p.tagId,p.version,valueType||'STRING',jsonParam(p.calculationRule||{dataModelIds:[]}),p.isCurrent||false,p.isDeleted||false,jsonParam(p.feature||{}),jsonParam(p.enumValues??[]),p.createTime||new Date(),p.updateTime||new Date(),p.createdBy,p.updatedBy],client,'version');}
  async createVersion(version:TagVersion){const tag=await tagOne<TagRow>('SELECT * FROM tag WHERE id=$1',[version.tagId],undefined,'tag');const row=await this.insertVersion(version,tag?.valueType??'STRING');return this.tagVersionAdapter.fromPOToTagVersionEntity(row!);}
  async findVersionById(id:string){const row=await tagOne<VersionRow>('SELECT * FROM tag_version WHERE id=$1 AND is_deleted=FALSE',[id],undefined,'version');return row?this.tagVersionAdapter.fromPOToTagVersionEntity(row):null;}
  async findVersionsByTagId(id:string){return(await tagRows<VersionRow>('SELECT * FROM tag_version WHERE tag_id=$1 AND is_deleted=FALSE ORDER BY version DESC',[id],undefined,'version')).map(v=>this.tagVersionAdapter.fromPOToTagVersionEntity(v));}
  async updateVersion(version:TagVersion,tenantFilter?:TenantFilterOptions){const p=this.tagVersionAdapter.fromTagVersionEntityToPO(version),params:unknown[]=[p.id,p.name,p.description,jsonParam(p.calculationRule),jsonParam(p.feature),p.updatedBy,jsonParam(p.enumValues??[])];const row=await tagOne<VersionRow>('UPDATE tag_version SET name=$2,description=$3,calculation_rule=COALESCE($4::jsonb,calculation_rule),feature=COALESCE($5::jsonb,feature),updated_by=$6,enum_values=$7::jsonb,update_time=NOW() WHERE id=$1'+ownershipSql(params,tenantFilter)+' RETURNING *',params,undefined,'version');if(!row)throw createOwnershipError('TagVersion',p.id);return this.tagVersionAdapter.fromPOToTagVersionEntity(row);}
  async countVersionsByTagId(id:string){return this.count('SELECT COUNT(*)::int AS count FROM tag_version WHERE tag_id=$1 AND is_deleted=FALSE',[id]);}
  async maxVersionByTagId(id:string){return this.count('SELECT COALESCE(MAX(version),0)::int AS count FROM tag_version WHERE tag_id=$1 AND is_deleted=FALSE',[id]);}
  async deleteVersionById(id:string){await execute('DELETE FROM tag_version WHERE id=$1',[id]);}

  async createCategory(category:TagCategory){const p=this.categoryAdapter.fromTagCategoryEntityToPO(category);const row=await tagOne<CategoryRow>('INSERT INTO tag_category(id,name,owned_by,description,parent_id,path,"order",is_deleted,feature,create_time,update_time,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13) RETURNING *',[p.id,p.name,p.ownedBy,p.description,p.parentId,p.path,p.order||0,p.isDeleted||false,jsonParam(p.feature),p.createTime||new Date(),p.updateTime||new Date(),p.createdBy,p.updatedBy]);return this.categoryAdapter.fromPOToTagCategoryEntity(row!);}
  async findCategoryById(id:string,tenantFilter?:TenantFilterOptions){const params:unknown[]=[id];const row=await tagOne<CategoryRow>('SELECT * FROM tag_category WHERE id=$1 AND is_deleted=FALSE'+ownershipSql(params,tenantFilter),params);return row?this.categoryAdapter.fromPOToTagCategoryEntity(row):null;}
  private categoryWhere(f:CategoryFilter,params:unknown[]){const where=['is_deleted='+ (f.isDeleted===true?'TRUE':'FALSE')];for(const [key,column]of [['id','id'],['ownedBy','owned_by'],['parentId','parent_id'],['name','name']]as const){if(f[key]===null)where.push(column+' IS NULL');else if(f[key]!==undefined){params.push(f[key]);where.push(column+'=$'+params.length);}}
    if(f.keyword){params.push(f.keyword);where.push('strpos(lower(name),lower($'+params.length+'))>0');}
    if(typeof f.path==='string'){params.push(f.path);where.push('path=$'+params.length);}else if(f.path?.startsWith){params.push(f.path.startsWith);where.push('left(path,length($'+params.length+'))=$'+params.length);}
    return where.join(' AND ')+ownershipSql(params,f.tenantFilter);
  }
  async findAllCategories(filter?:CategoryFilter){const f=filter??{},params:unknown[]=[];let sql='SELECT * FROM tag_category WHERE '+this.categoryWhere(f,params)+' ORDER BY "order" ASC';if(f.take!==undefined){params.push(f.take);sql+=' LIMIT $'+params.length;}if(f.skip!==undefined){params.push(f.skip);sql+=' OFFSET $'+params.length;}return(await tagRows<CategoryRow>(sql,params)).map(c=>this.categoryAdapter.fromPOToTagCategoryEntity(c));}
  async updateCategory(category:TagCategory,tenantFilter?:TenantFilterOptions){const p=this.categoryAdapter.fromTagCategoryEntityToPO(category),params:unknown[]=[p.id,p.name,p.description,p.parentId,p.path,p.order||0,p.isDeleted||false,jsonParam(p.feature),p.updatedBy];const row=await tagOne<CategoryRow>('UPDATE tag_category SET name=$2,description=$3,parent_id=$4,path=$5,"order"=$6,is_deleted=$7,feature=$8::jsonb,updated_by=$9,update_time=NOW(),delete_time=CASE WHEN $7 THEN NOW() ELSE NULL END,deleted_by=CASE WHEN $7 THEN $9::uuid ELSE NULL END WHERE id=$1'+ownershipSql(params,tenantFilter)+' RETURNING *',params);if(!row)throw createOwnershipError('TagCategory',p.id);return this.categoryAdapter.fromPOToTagCategoryEntity(row);}
  async deleteCategory(command:DeleteTagCategoryCommand,tenantFilter?:TenantFilterOptions){const params:unknown[]=[command.categoryId,command.deletedBy];if(!await execute('UPDATE tag_category SET is_deleted=TRUE,deleted_by=$2,delete_time=NOW() WHERE id=$1'+ownershipSql(params,tenantFilter),params))throw createOwnershipError('TagCategory',command.categoryId);}
  private async count(sql:string,params:unknown[]){return Number((await tagOne<{count:number}>(sql,params))?.count??0);}
  async countTagsByCategoryId(id:string){return this.count('SELECT COUNT(*)::int AS count FROM tag WHERE category_id=$1 AND is_deleted=FALSE',[id]);}
  async countTagsByCategoryIds(ids:string[],tenantFilter?:TenantFilterOptions){
    const result=new Map(ids.map(id=>[id,0]));
    if(!ids.length)return result;
    const params:unknown[]=[ids];
    const sql='SELECT category_id,COUNT(*)::int AS count FROM tag WHERE category_id=ANY($1::uuid[]) AND is_deleted=FALSE'+ownershipSql(params,tenantFilter)+' GROUP BY category_id';
    for(const row of await tagRows<{categoryId:string;count:number}>(sql,params))result.set(row.categoryId,Number(row.count));
    return result;
  }
  async countChildCategories(id:string){return this.count('SELECT COUNT(*)::int AS count FROM tag_category WHERE parent_id=$1 AND is_deleted=FALSE',[id]);}
  async countCategories(filter?:CategoryFilter){const params:unknown[]=[];return this.count('SELECT COUNT(*)::int AS count FROM tag_category WHERE '+this.categoryWhere(filter??{},params),params);}
}
const repository=new DatabaseTagRepository();
export const getDatabaseTagRepository=()=>repository;
export const getDatabaseTagVersionRepository=()=>repository;
export const getDatabaseTagCategoryRepository=()=>repository;
