import { NextRequest } from 'next/server';
import { getCurrentTenantId, createTenantFilter } from '@/platform/get-current-tenant';
import {
  IAdminOHSAdapter,
  GetTablesQuery,
  GetPreviewQuery,
  TruncateTableCommand,
  GetAuditLogsQuery,
  ResolveErrorCommand,
  AuditLogVO,
  AuditLogListVO,
} from '@/modules/system/services/admin/IAdminOHSAdapter';

export class AdminOHSAdapterImpl implements IAdminOHSAdapter {
  fromRequestToGetTablesQuery(request: NextRequest): GetTablesQuery {
    const { searchParams } = new URL(request.url);
    return {
      schema: searchParams.get('schema') || 'public',
    };
  }

  fromRequestToGetPreviewQuery(request: NextRequest, table: string): GetPreviewQuery {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    return { table, limit, offset };
  }

  fromRequestToTruncateTableCommand(_request: NextRequest, table: string): TruncateTableCommand {
    return { table };
  }

  fromRequestToGetAuditLogsQuery(request: NextRequest): GetAuditLogsQuery {
    const { searchParams } = request.nextUrl;
    const tenantId = getCurrentTenantId(request);
    
    return {
      page: parseInt(searchParams.get('page') || '1', 10),
      pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
      action: searchParams.get('action') || undefined,
      entity: searchParams.get('entity') || undefined,
      actorId: searchParams.get('actorId') || undefined,
      startTime: searchParams.get('startTime') ? new Date(searchParams.get('startTime')!) : undefined,
      endTime: searchParams.get('endTime') ? new Date(searchParams.get('endTime')!) : undefined,
      tenantFilter: createTenantFilter(tenantId),
    };
  }

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
  }): AuditLogVO {
    return {
      id: log.id,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      actorId: log.actorId,
      actorUsername: log.actorUsername,
      actorRealName: log.actorRealName,
      actorEmail: log.actorEmail,
      actorRole: log.actorRole,
      metadata: log.metadata,
      createdAt: log.createdAt,
    };
  }

  fromAuditLogListToVO(logs: AuditLogVO[], total: number, page: number, pageSize: number): AuditLogListVO {
    return {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      items: logs,
    };
  }

  fromRequestToResolveErrorCommand(_request: NextRequest, logId: string): ResolveErrorCommand {
    return { logId };
  }
}

