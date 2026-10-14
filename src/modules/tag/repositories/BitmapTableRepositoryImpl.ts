import {transaction,execute,type DbClient} from '@/platform/database';
import {config} from '@/platform/config/index';
import {tagOne,tagRows} from './sql';
import type {BitmapTable} from './row-types';
import type {IBitmapTableRepository,BitmapTableData,AllocateBitResult} from '../domain/ports/IBitmapTableRepository';
import type {TenantFilterOptions} from '@/platform/get-current-tenant';
export class BitmapTableRepositoryImpl implements IBitmapTableRepository {
  async create(d:BitmapTableData){const row=await tagOne<BitmapTable>("INSERT INTO bitmap_table(id,entity_type,entity_type_id,owned_by,sequence,total_bits,used_bits,status,create_time,update_time,ch_table_name) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11) RETURNING *",[d.id,d.entityType,d.entityTypeId,d.ownedBy??config.system.userId,d.sequence,d.totalBits,JSON.stringify(d.usedBits),d.status,d.createTime??new Date(),d.updateTime??null,d.chTableName??null]);return this.toData(row!);}
  private ownerSql(params:unknown[],tenant?:TenantFilterOptions){if(!tenant?.tenantId)return '';params.push(tenant.tenantId);return ' AND owned_by=$'+params.length+'::uuid';}
  private async one(where:string,params:unknown[],tenant?:TenantFilterOptions){const row=await tagOne<BitmapTable>('SELECT * FROM bitmap_table WHERE '+where+this.ownerSql(params,tenant)+' LIMIT 1',params);return row?this.toData(row):null;}
  private async many(where:string,params:unknown[],tenant?:TenantFilterOptions,limit?:number){let sql='SELECT * FROM bitmap_table WHERE '+where+this.ownerSql(params,tenant)+' ORDER BY create_time ASC';if(limit!==undefined){params.push(limit);sql+=' LIMIT $'+params.length;}return(await tagRows<BitmapTable>(sql,params)).map(r=>this.toData(r));}
  findById(id:string,tenant?:TenantFilterOptions){return this.one('id=$1',[id],tenant);}
  findByEntityTypeId(id:string,includeDeleted?:boolean,tenant?:TenantFilterOptions){return this.many('entity_type_id=$1 AND is_deleted=FALSE'+(!includeDeleted?' AND delete_time IS NULL':''),[id],tenant);}
  findActiveByEntityTypeId(id:string,tenant?:TenantFilterOptions){return this.one('entity_type_id=$1 AND is_deleted=FALSE AND status=$2 AND delete_time IS NULL',[id,'ACTIVE'],tenant);}
  findAll(tenant?:TenantFilterOptions,limit=100){return this.many('is_deleted=FALSE AND delete_time IS NULL',[],tenant,limit);}
  findByEntityType(type:string,limit=100){return this.many('entity_type=$1 AND is_deleted=FALSE AND delete_time IS NULL',[type],undefined,limit);}
  findActiveByEntityType(type:string){return this.one('entity_type=$1 AND is_deleted=FALSE AND status=$2 AND delete_time IS NULL',[type,'ACTIVE']);}
  async update(d:BitmapTableData,tenant?:TenantFilterOptions){
    const params:unknown[]=[d.id,d.entityType,d.entityTypeId,JSON.stringify(d.usedBits),d.status,d.updateTime??new Date()];
    let sets='entity_type=$2,entity_type_id=$3,used_bits=$4::jsonb,status=$5,update_time=$6';
    for(const [column,value]of [['ch_table_name',d.chTableName],['name',d.name],['description',d.description],['total_bits',d.totalBits]]as const){if(value!==undefined){params.push(value);sets+=','+column+'=$'+params.length;}}
    const row=await tagOne<BitmapTable>('UPDATE bitmap_table SET '+sets+' WHERE id=$1'+this.ownerSql(params,tenant)+' RETURNING *',params);
    if(!row)throw new Error('位图表不存在');return this.toData(row);
  }
  async delete(id:string){await execute("UPDATE bitmap_table SET is_deleted=true,delete_time=NOW(),update_time=NOW() WHERE id=$1",[id]);}
  async allocateBitAtomically(entityTypeId:string,entityType:string,tenantId:string):Promise<AllocateBitResult>{return transaction(async tx=>{
    await execute("SELECT pg_advisory_xact_lock(hashtext($1))",[tenantId+':bitmap:'+entityTypeId],tx);
    const bitmap=await tagOne<BitmapTable>("SELECT * FROM bitmap_table WHERE entity_type_id=$1 AND owned_by=$2 AND is_deleted=FALSE AND status=$3 AND delete_time IS NULL ORDER BY sequence DESC LIMIT 1 FOR UPDATE",[entityTypeId,tenantId,'ACTIVE'],tx);
    if(bitmap){const bits=this.parseUsedBits(bitmap.usedBits);for(let i=0;i<bitmap.totalBits;i++)if(!bits.includes(i)){const row=await tagOne<BitmapTable>("UPDATE bitmap_table SET used_bits=$2::jsonb,update_time=NOW() WHERE id=$1 RETURNING *",[bitmap.id,JSON.stringify([...bits,i])],tx);return {bitmapTableData:this.toData(row!),bitPosition:i,isNewTable:false};}}
    const max=await tagOne<{sequence:number}>("SELECT COALESCE(MAX(sequence),0)::int AS sequence FROM bitmap_table WHERE entity_type_id=$1 AND owned_by=$2",[entityTypeId,tenantId],tx);
    const row=await tagOne<BitmapTable>("INSERT INTO bitmap_table(id,entity_type,entity_type_id,owned_by,sequence,total_bits,used_bits,status,create_time) VALUES($1,$2,$3,$4,$5,64,$6::jsonb,$7,NOW()) RETURNING *",[crypto.randomUUID(),entityType,entityTypeId,tenantId,(max?.sequence??0)+1,'[0]','ACTIVE'],tx);return {bitmapTableData:this.toData(row!),bitPosition:0,isNewTable:true};
  });}
  async releaseBitAtomically(id:string,bit:number,tx?:DbClient):Promise<BitmapTableData|null>{const release=async(client:DbClient)=>{
    const row=await tagOne<BitmapTable>("UPDATE bitmap_table SET used_bits=COALESCE((SELECT jsonb_agg(elem::int) FROM jsonb_array_elements_text(used_bits) AS arr(elem) WHERE elem::int<>$2),'[]'::jsonb),update_time=NOW() WHERE id=$1 AND used_bits @> $3::jsonb RETURNING *",[id,bit,JSON.stringify([bit])],client);return row?this.toData(row):null;};return tx?release(tx):transaction(release);}
  async assignBitAt(id:string,bit:number,tx?:DbClient):Promise<BitmapTableData>{const assign=async(client:DbClient)=>{
    const bitmap=await tagOne<BitmapTable>("SELECT * FROM bitmap_table WHERE id=$1 FOR UPDATE",[id],client);if(!bitmap)throw new Error('位图表不存在: '+id);if(!Number.isInteger(bit)||bit<0||bit>=bitmap.totalBits)throw new Error('位索引超出范围: '+bit);
    const row=await tagOne<BitmapTable>("UPDATE bitmap_table SET used_bits=used_bits||$2::jsonb,update_time=NOW() WHERE id=$1 AND NOT(used_bits @> $2::jsonb) RETURNING *",[id,JSON.stringify([bit])],client);if(!row)throw new Error('该位已分配: '+bit);return this.toData(row);};return tx?assign(tx):transaction(assign);}
  releaseBitAt(id:string,bit:number,tx?:DbClient){return this.releaseBitAtomically(id,bit,tx);}
  private toData(record: {
    id: string;
    entityType: string;
    entityTypeId: string;
    ownedBy: string;
    sequence: number;
    totalBits: number;
    usedBits: unknown;
    status: string;
    name?: string | null;
    description?: string | null;
    createTime: Date;
    updateTime: Date | null;
    deleteTime: Date | null;
    isDeleted: boolean;
    chTableName?: string | null;
  }): BitmapTableData {
    return {
      id: record.id,
      entityType: record.entityType,
      entityTypeId: record.entityTypeId,
      ownedBy: record.ownedBy,
      sequence: record.sequence,
      totalBits: record.totalBits,
      usedBits: this.parseUsedBits(record.usedBits),
      status: record.status,
      name: record.name ?? undefined,
      description: record.description ?? undefined,
      createTime: record.createTime,
      updateTime: record.updateTime || undefined,
      deleteTime: record.deleteTime,
      isDeleted: record.isDeleted,
      chTableName: record.chTableName ?? undefined,
    };
  }

  private parseUsedBits(usedBits: unknown): number[] {
    if (Array.isArray(usedBits)) {
      return usedBits.map((b) => (typeof b === 'number' ? b : parseInt(String(b), 10)));
    }
    if (typeof usedBits === 'string') {
      try {
        const parsed = JSON.parse(usedBits);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }
}
