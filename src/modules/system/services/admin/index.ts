export { AdminApplicationServiceImpl, type IAdminApplicationService } from '@/modules/system/services/admin/AdminApplicationServiceImpl';
export { AdminOHSAdapterImpl } from '@/modules/system/services/admin/AdminOHSAdapterImpl';
export type {
  IAdminOHSAdapter,
  GetTablesQuery,
  GetPreviewQuery,
  TruncateTableCommand,
  GetAuditLogsQuery,
  ResolveErrorCommand,
  AuditLogVO,
  AuditLogListVO,
  TableInfoVO,
  TableDataVO,
} from '@/modules/system/services/admin/IAdminOHSAdapter';
