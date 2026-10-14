import { mapRow, queryRows, queryOne } from '@/platform/database';
import {
  IAdminOHSAdapter,
  GetTablesQuery,
  GetPreviewQuery,
  TruncateTableCommand,
  GetAuditLogsQuery,
  ResolveErrorCommand,
  AuditLogVO,
  TableInfoVO,
  TableDataVO,
} from '@/modules/system/services/admin/IAdminOHSAdapter';
import type { IDbBrowserService, TableInfo, PreviewData } from '@/modules/system/services/db-browser/interface';

export interface IAdminApplicationService {
  getTables(query: GetTablesQuery): Promise<TableInfo[]>;
  getTablePreview(query: GetPreviewQuery): Promise<PreviewData>;
  truncateTable(command: TruncateTableCommand): Promise<void>;
  getAuditLogs(query: GetAuditLogsQuery): Promise<{ items: AuditLogVO[]; total: number; page: number; pageSize: number; totalPages: number }>;
  getTagRefreshStatuses(): Promise<unknown[]>;
}

export class AdminApplicationServiceImpl implements IAdminApplicationService {
  constructor(
    private readonly browser: IDbBrowserService,
    private readonly adapter: IAdminOHSAdapter,
    private readonly refreshStatuses: () => Promise<unknown[]>,
  ) {}

  async getTables(query: GetTablesQuery): Promise<TableInfo[]> {
    return this.browser.getTables(query.schema);
  }

  async getTablePreview(query: GetPreviewQuery): Promise<PreviewData> {
    return this.browser.getPreview('public', query.table);
  }

  async truncateTable(command: TruncateTableCommand): Promise<void> {
    return this.browser.truncateTable('public', command.table);
  }

  async getAuditLogs(query: GetAuditLogsQuery): Promise<{ items: AuditLogVO[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const conditions:string[]=['true'];
    const values:unknown[]=[];
    const add=(sql:string,value:unknown)=>{values.push(value);conditions.push(sql.replace('?',`$${values.length}`));};
    if(query.action) add('action=?',query.action);
    if(query.entity) add('entity=?',query.entity);
    if(query.tenantFilter?.tenantId) add('owned_by=?::uuid',query.tenantFilter.tenantId);
    if(query.actorId){values.push(`%${query.actorId}%`);const n=values.length;conditions.push(`(actor_username ILIKE $${n} OR actor_real_name ILIKE $${n} OR actor_email ILIKE $${n})`);}
    if(query.startTime) add('create_time>=?',query.startTime);
    if(query.endTime) add('create_time<=?',query.endTime);
    const where=conditions.join(' AND ');
    const [rows,count]=await Promise.all([
      queryRows(`SELECT * FROM audit_logs WHERE ${where} ORDER BY create_time DESC LIMIT $${values.length+1} OFFSET $${values.length+2}`,[...values,query.pageSize,(query.page-1)*query.pageSize]),
      queryOne(`SELECT COUNT(*)::int AS total FROM audit_logs WHERE ${where}`,values)
    ]);
    const total=Number(count?.total??0);
    const items=rows.map(row=>mapRow<{id:string;action:string;entity:string;entityId:string|null;actorId:string;actorUsername:string;actorRealName:string|null;actorEmail:string|null;actorRole:string|null;metadata:Record<string,unknown>|null;createdAt:Date}>(row,{create_time:'createdAt'}));

    const vos = items.map(item => this.adapter.fromAuditLogToVO({
      id: item.id,
      action: item.action,
      entity: item.entity,
      entityId: item.entityId,
      actorId: item.actorId,
      actorUsername: item.actorUsername,
      actorRealName: item.actorRealName,
      actorEmail: item.actorEmail,
      actorRole: item.actorRole,
      metadata: item.metadata as Record<string, unknown> | null,
      createdAt: item.createdAt,
    }));

    return {
      items: vos,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async getTagRefreshStatuses(): Promise<unknown[]> {
    return this.refreshStatuses();
  }
}

