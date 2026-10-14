/**
 * Schema 总索引文件
 * 导出所有的Schema和类型
 */

// 通用Schema
export * from '@/shared/schemas/common/index';

// 请求Schema
export * from '@/modules/identity/contracts/schemas/request/auth/index';
export * from '@/modules/data/contracts/schemas/request/data-model/index';
export * from '@/modules/data/contracts/schemas/request/datasource/index';
export * as RequestExportTask from '@/modules/tag/contracts/schemas/request/export-task/index';

export * from '@/modules/system/contracts/schemas/request/recycle-bin/index';
export * as RequestSegment from '@/modules/segment/contracts/schemas/request/segment/index';
export * as RequestTag from '@/modules/tag/contracts/schemas/request/tag/index';
export * from '@/modules/tag/contracts/schemas/request/tag-category/index';
export * as RequestAudit from '@/shared/schemas/request/audit/index';
export * as RequestBitmapTable from '@/shared/schemas/request/bitmap-table/index';

// 响应Schema
export * from '@/modules/identity/contracts/schemas/response/auth/index';
export * from '@/modules/data/contracts/schemas/response/data-model/index';
export * from '@/modules/data/contracts/schemas/response/datasource/index';
export * as ResponseExportTask from '@/modules/tag/contracts/schemas/response/export-task/index';

export * from '@/modules/system/contracts/schemas/response/recycle-bin/index';
export * as ResponseSegment from '@/modules/segment/contracts/schemas/response/segment/index';
export * as ResponseTag from '@/modules/tag/contracts/schemas/response/tag/index';
export * from '@/modules/tag/contracts/schemas/response/tag-category/index';
export * as ResponseAuditLog from '@/shared/schemas/response/audit-log/index';
export * as ResponseBitmapTable from '@/shared/schemas/response/bitmap-table/index';
