import {execute} from '@/platform/database';
import {config} from '@/platform/config/index';
import {tagOne,tagRows} from './sql';
import type {TagRefreshLog} from './row-types';
import type {ITagRefreshLogRepository,TagRefreshLogData} from '../domain/ports/ITagRefreshLogRepository';
import type {TenantFilterOptions} from '@/platform/get-current-tenant';
import {NotFoundException} from '@/shared/errors';
export class TagRefreshLogRepositoryImpl implements ITagRefreshLogRepository {
  async create(d:TagRefreshLogData){const row=await tagOne<TagRefreshLog>('INSERT INTO tag_refresh_log(id,tag_id,mv_name,owned_by,error_message,occurred_at,is_resolved) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[d.id,d.tagId,d.mvName,d.ownedBy??config.system.userId,d.errorMessage??null,d.occurredAt,d.isResolved]);return this.toData(row!);}
  async findByTagId(id:string,limit=100){return(await tagRows<TagRefreshLog>('SELECT * FROM tag_refresh_log WHERE tag_id=$1 ORDER BY occurred_at DESC LIMIT $2',[id,limit])).map(r=>this.toData(r));}
  async hasUnresolvedError(id:string,name:string){return !!await tagOne<{id:string}>('SELECT id FROM tag_refresh_log WHERE tag_id=$1 AND mv_name=$2 AND is_resolved=FALSE LIMIT 1',[id,name]);}
  async findUnresolved(limit=100,tenant?:TenantFilterOptions){const params:unknown[]=[limit];const scope=tenant?.tenantId?(params.push(tenant.tenantId),' AND owned_by=$2::uuid'):'';return(await tagRows<TagRefreshLog>('SELECT * FROM tag_refresh_log WHERE is_resolved=FALSE'+scope+' ORDER BY occurred_at DESC LIMIT $1',params)).map(r=>this.toData(r));}
  async findRecent(limit=100){return(await tagRows<TagRefreshLog>('SELECT * FROM tag_refresh_log ORDER BY occurred_at DESC LIMIT $1',[limit])).map(r=>this.toData(r));}
  async markResolved(id:string,tenant?:TenantFilterOptions){const params:unknown[]=[id];const scope=tenant?.tenantId?(params.push(tenant.tenantId),' AND owned_by=$2::uuid'):'';if(!await execute('UPDATE tag_refresh_log SET is_resolved=TRUE WHERE id=$1'+scope,params))throw new NotFoundException('TAG_RESOURCE_NOT_FOUND','TagRefreshLog',id);}
  async markResolvedBatch(ids:string[]){if(ids.length)await execute('UPDATE tag_refresh_log SET is_resolved=TRUE WHERE id=ANY($1::uuid[])',[ids]);}
  markResolvedByTagAndMv(id:string,name:string){return execute('UPDATE tag_refresh_log SET is_resolved=TRUE WHERE tag_id=$1 AND mv_name=$2 AND is_resolved=FALSE',[id,name]);}
  async deleteByTagId(id:string){await execute('DELETE FROM tag_refresh_log WHERE tag_id=$1',[id]);}
  deleteOlderThan(days:number){const cutoff=new Date();cutoff.setDate(cutoff.getDate()-days);return execute('DELETE FROM tag_refresh_log WHERE occurred_at<$1',[cutoff]);}
  private toData(record: {
    id: string;
    tagId: string;
    mvName: string;
    ownedBy: string;
    errorMessage: string | null;
    occurredAt: Date;
    isResolved: boolean;
    createTime: Date;
  }): TagRefreshLogData {
    return {
      id: record.id,
      tagId: record.tagId,
      mvName: record.mvName,
      ownedBy: record.ownedBy,
      errorMessage: record.errorMessage || undefined,
      occurredAt: record.occurredAt,
      isResolved: record.isResolved,
      createTime: record.createTime,
    };
  }
}

