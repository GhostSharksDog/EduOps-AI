import {execute} from '@/platform/database';
import {config} from '@/platform/config/index';
import {tagOne,tagRows,ownershipSql,jsonParam} from './sql';
import type {TargetTable} from './row-types';
import type {ITargetTableRepository,TargetTableData,TargetTableQueryOptions} from '../domain/ports/ITargetTableRepository';
import type {TenantFilterOptions} from '@/platform/get-current-tenant';
import type {TargetTableStatus} from '../domain/entities/TargetTable';
export class TargetTableRepositoryImpl implements ITargetTableRepository {
  private async one(where:string,params:unknown[]){const row=await tagOne<TargetTable>('SELECT * FROM target_table WHERE '+where+' LIMIT 1',params);return row?this.toData(row):null;}
  async create(d:TargetTableData){const row=await tagOne<TargetTable>('INSERT INTO target_table(id,table_name,entity_type,entity_type_id,owned_by,create_table_sql,table_type,tag_id,tag_version_id,status,row_count,last_refresh_time,create_time,update_time,dimension_columns,aggregate_config) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *',[d.id,d.tableName,d.entityType,d.entityTypeId,d.ownedBy??config.system.userId,jsonParam(d.createTableSql),d.tableType??'PHYSICAL_TABLE',d.tagId??null,d.tagVersionId??null,d.status,d.rowCount??null,d.lastRefreshTime??null,d.createTime??new Date(),d.updateTime??null,d.dimensionColumns??null,d.aggregateConfig??null]);return this.toData(row!);}
  findById(id:string){return this.one('id=$1 AND delete_time IS NULL',[id]);}
  findByTableName(name:string){return this.one('table_name=$1 AND delete_time IS NULL',[name]);}
  findAnyByTableName(name:string){return this.one('table_name=$1',[name]);}
  findByTagId(id:string){return this.one('tag_id=$1 AND delete_time IS NULL',[id]);}
  async findAll(options?:TargetTableQueryOptions,tenant?:TenantFilterOptions){const params:unknown[]=[],where=['is_deleted=FALSE'];for(const[key,col]of [['status','status'],['entityTypeId','entity_type_id'],['tagId','tag_id']]as const)if(options?.[key]){params.push(options[key]);where.push(col+'=$'+params.length);}if(options?.tableName){params.push(options.tableName);where.push('strpos(lower(table_name),lower($'+params.length+'))>0');}return(await tagRows<TargetTable>('SELECT * FROM target_table WHERE '+where.join(' AND ')+ownershipSql(params,tenant)+' ORDER BY create_time DESC',params)).map(r=>this.toData(r));}
  private async change(id:string,sets:string,params:unknown[]){const row=await tagOne<TargetTable>('UPDATE target_table SET '+sets+',update_time=NOW() WHERE id=$1 RETURNING *',[id,...params]);if(!row)throw new Error('目标表不存在');return this.toData(row);}
  restore(id:string){return this.change(id,'is_deleted=FALSE,delete_time=NULL,deleted_by=NULL',[]);}
  async update(d:TargetTableData){const params:unknown[]=[d.id],sets=['update_time=NOW()'];
    const fields:{column:string;value:unknown;json?:boolean}[]=[{column:'table_name',value:d.tableName},{column:'entity_type',value:d.entityType},{column:'entity_type_id',value:d.entityTypeId},{column:'create_table_sql',value:d.createTableSql,json:true},{column:'table_type',value:d.tableType},{column:'tag_id',value:d.tagId},{column:'tag_version_id',value:d.tagVersionId},{column:'status',value:d.status},{column:'error_message',value:d.errorMessage},{column:'activated_at',value:d.activatedAt},{column:'deactivated_at',value:d.deactivatedAt},{column:'row_count',value:d.rowCount},{column:'last_refresh_time',value:d.lastRefreshTime},{column:'ch_exists',value:d.chExists},{column:'ch_sync_time',value:d.chSyncTime},{column:'dimension_columns',value:d.dimensionColumns},{column:'aggregate_config',value:d.aggregateConfig}];
    for(const f of fields)if(f.value!==undefined){params.push(f.json?jsonParam(f.value):f.value);sets.push(f.column+'=$'+params.length+(f.json?'::jsonb':''));}
    const row=await tagOne<TargetTable>('UPDATE target_table SET '+sets.join(',')+' WHERE id=$1 RETURNING *',params);if(!row)throw new Error('目标表不存在');return this.toData(row);
  }
  async delete(id:string,by?:string){await execute('UPDATE target_table SET is_deleted=TRUE,delete_time=NOW(),deleted_by=$2 WHERE id=$1',[id,by??null]);}
  updateStatus(id:string,status:TargetTableStatus){return this.change(id,'status=$2',[status]);}
  linkTag(id:string,tag:string,version:string){return this.change(id,'tag_id=$2,tag_version_id=$3',[tag,version]);}
  unlinkTag(id:string){return this.change(id,'tag_id=NULL,tag_version_id=NULL',[]);}
  updateStats(id:string,count:number,last?:Date){return this.change(id,'row_count=$2'+(last!==undefined?',last_refresh_time=$3':''),last!==undefined?[count,last]:[count]);}
  private toData(record: {
    id: string;
    tableName: string;
    entityType: string;
    entityTypeId: string;
    ownedBy: string;
    createTableSql: unknown;
    tableType: string;
    tagId: string | null;
    tagVersionId: string | null;
    status: string;
    errorMessage: string | null;
    activatedAt: Date | null;
    deactivatedAt: Date | null;
    rowCount: number | null;
    lastRefreshTime: Date | null;
    chExists: boolean | null;
    chSyncTime: Date | null;
    createTime: Date;
    updateTime: Date | null;
    dimensionColumns: string | null;
    aggregateConfig: string | null;
    isDeleted: boolean;
    deleteTime: Date | null;
  }): TargetTableData {
    return {
      id: record.id,
      tableName: record.tableName,
      entityType: record.entityType,
      entityTypeId: record.entityTypeId,
      ownedBy: record.ownedBy,
      createTableSql: this.parseSql(record.createTableSql),
      tableType: record.tableType ?? undefined,
      tagId: record.tagId ?? undefined,
      tagVersionId: record.tagVersionId ?? undefined,
      status: record.status as TargetTableStatus,
      errorMessage: record.errorMessage ?? undefined,
      activatedAt: record.activatedAt ?? undefined,
      deactivatedAt: record.deactivatedAt ?? undefined,
      rowCount: record.rowCount ?? undefined,
      lastRefreshTime: record.lastRefreshTime ?? undefined,
      chExists: record.chExists,
      chSyncTime: record.chSyncTime,
      createTime: record.createTime,
      updateTime: record.updateTime ?? undefined,
      dimensionColumns: record.dimensionColumns ?? undefined,
      aggregateConfig: record.aggregateConfig ?? undefined,
      isDeleted: record.isDeleted,
      deleteTime: record.deleteTime,
    };
  }

  private parseSql(sql: unknown): string {
    if (typeof sql === 'string') {
      return sql;
    }
    return JSON.stringify(sql);
  }
}
