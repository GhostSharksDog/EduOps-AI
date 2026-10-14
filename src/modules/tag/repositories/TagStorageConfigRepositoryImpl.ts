import {execute,type DbClient} from '@/platform/database';
import {tagOne,tagRows} from './sql';
import type {TagStorageConfig} from './row-types';
import type {ITagStorageConfigRepository,TagStorageConfigData,CreateTagStorageConfigData} from '../domain/ports/ITagStorageConfigRepository';
export class TagStorageConfigRepositoryImpl implements ITagStorageConfigRepository {
  private async one(where:string,params:unknown[],client?:DbClient){const row=await tagOne<TagStorageConfig>('SELECT * FROM tag_storage_config WHERE '+where+' LIMIT 1',params,client);return row?this.toData(row):null;}
  findByTagId(id:string){return this.one('tag_id=$1 AND delete_time IS NULL',[id]);}
  async findAllByTagId(id:string){return(await tagRows<TagStorageConfig>('SELECT * FROM tag_storage_config WHERE tag_id=$1 AND delete_time IS NULL',[id])).map(r=>this.toData(r));}
  findByBitmapIdAndBitPosition(id:string,bit:number){return this.one('bitmap_table_id=$1 AND bit_position=$2 AND delete_time IS NULL',[id,bit]);}
  findById(id:string){return this.one('id=$1 AND delete_time IS NULL',[id]);}
  findAnyByTagId(id:string){return this.one('tag_id=$1',[id]);}
  findAnyByTagIdAndEnumValue(id:string,value:string){return this.one('tag_id=$1 AND enum_value=$2',[id,value]);}
  findAnyByBitmapIdAndBitPosition(id:string,bit:number){return this.one('bitmap_table_id=$1 AND bit_position=$2',[id,bit]);}
  async create(data:CreateTagStorageConfigData,tx?:DbClient){const row=await tagOne<TagStorageConfig>('INSERT INTO tag_storage_config(id,tag_id,bitmap_table_name,bit_position,enum_value,storage_type,entity_type,bitmap_table_id,owned_by,created_by,create_time) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()) RETURNING *',[crypto.randomUUID(),data.tagId,data.bitmapTableName,data.bitPosition??null,data.enumValue??'',data.storageType,data.entityType??null,data.bitmapTableId??null,data.ownedBy,data.createdBy??null],tx);return this.toData(row!);}
  async delete(id:string,deletedBy?:string,tx?:DbClient){if(!await execute('UPDATE tag_storage_config SET delete_time=NOW(),deleted_by=$2 WHERE id=$1',[id,deletedBy??null],tx))throw new Error('标签存储配置不存在');}
  async update(id:string,data:{bitmapTableName?:string;bitPosition?:number|null;storageType?:string;entityType?:string|null;bitmapTableId?:string|null;updatedBy?:string;restore?:boolean},tx?:DbClient){
    const params:unknown[]=[id],sets=['update_time=NOW()'];
    for(const[key,col]of [['bitmapTableName','bitmap_table_name'],['bitPosition','bit_position'],['storageType','storage_type'],['entityType','entity_type'],['bitmapTableId','bitmap_table_id'],['updatedBy','updated_by']]as const)if(data[key]!==undefined){params.push(data[key]);sets.push(col+'=$'+params.length);}
    if(data.restore)sets.push('delete_time=NULL');
    const row=await tagOne<TagStorageConfig>('UPDATE tag_storage_config SET '+sets.join(',')+' WHERE id=$1 RETURNING *',params,tx);if(!row)throw new Error('标签存储配置不存在');return this.toData(row);
  }
  private toData(record: {
    id: string;
    tagId: string;
    bitmapTableName: string;
    bitPosition: number | null;
    enumValue: string;
    storageType: string;
    entityType: string | null;
    bitmapTableId: string | null;
    ownedBy: string;
    createTime: Date;
    updateTime: Date | null;
    deleteTime: Date | null;
    createdBy: string | null;
    updatedBy: string | null;
    deletedBy: string | null;
  }): TagStorageConfigData {
    return {
      id: record.id,
      tagId: record.tagId,
      bitmapTableName: record.bitmapTableName,
      bitPosition: record.bitPosition,
      enumValue: record.enumValue,
      storageType: record.storageType,
      entityType: record.entityType,
      bitmapTableId: record.bitmapTableId,
      ownedBy: record.ownedBy,
      createTime: record.createTime,
      updateTime: record.updateTime || undefined,
      deleteTime: record.deleteTime,
      createdBy: record.createdBy || undefined,
      updatedBy: record.updatedBy || undefined,
      deletedBy: record.deletedBy || undefined,
    };
  }
}
