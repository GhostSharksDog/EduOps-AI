import { NextRequest } from 'next/server';
import { TenantFilterOptions } from '@/platform/get-current-tenant';

export interface GetTablesQuery {
  schema: string;
}

export interface GetPreviewQuery {
  table: string;
  limit: number;
  offset: number;
}

export interface TruncateTableCommand {
  table: string;
}

export interface GetAuditLogsQuery {
  page: number;
  pageSize: number;
  action?: string;
  entity?: string;
  actorId?: string;
  startTime?: Date;
  endTime?: Date;
  tenantFilter?: TenantFilterOptions;
}

export interface ResolveErrorCommand {
  logId: string;
}

export interface TableInfoVO {
  name: string;
  schema: string;
  type: string;
}

export interface TableDataVO {
  rows: Record<string, unknown>[];
  total: number;
  columns: string[];
}

export interface AuditLogVO {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorId: string;
  actorUsername: string;
  actorRealName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AuditLogListVO {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: AuditLogVO[];
}

export interface IAdminOHSAdapter {
  fromRequestToGetTablesQuery(request: NextRequest): GetTablesQuery;
  fromRequestToGetPreviewQuery(request: NextRequest, table: string): GetPreviewQuery;
  fromRequestToTruncateTableCommand(request: NextRequest, table: string): TruncateTableCommand;
  fromRequestToGetAuditLogsQuery(request: NextRequest): GetAuditLogsQuery;
  fromAuditLogToVO(log: {
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    actorId: string;
    actorUsername: string;
    actorRealName: string | null;
    actorEmail: string | null;
    actorRole: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
  }): AuditLogVO;
  fromAuditLogListToVO(logs: AuditLogVO[], total: number, page: number, pageSize: number): AuditLogListVO;
  fromRequestToResolveErrorCommand(request: NextRequest, logId: string): ResolveErrorCommand;
}
