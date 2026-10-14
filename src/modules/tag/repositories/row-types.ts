import type {JsonValue} from '@/shared/types/jsonValue';

// PostgreSQL 持久化行类型；业务类型和公开 DTO 独立定义。
export interface Tag {
  id: string;
  name: string;
  ownedBy: string;
  description: string | null;
  valueType: string;
  currentVersionId: string | null;
  categoryId: string;
  status: string;
  isDeleted: boolean;
  isPublic: boolean;
  feature: JsonValue | null;
  update_cycle: string | null;
  createTime: Date;
  updateTime: Date | null;
  deleteTime: Date | null;
  createdBy: string;
  updatedBy: string | null;
  deletedBy: string | null;
}

export interface TagCategory {
  id: string;
  name: string | null;
  ownedBy: string;
  description: string | null;
  parentId: string | null;
  path: string;
  order: number;
  isDeleted: boolean;
  feature: JsonValue | null;
  createTime: Date;
  updateTime: Date | null;
  deleteTime: Date | null;
  createdBy: string;
  updatedBy: string | null;
  deletedBy: string | null;
}

export interface TagVersion {
  id: string;
  name: string | null;
  ownedBy: string;
  description: string | null;
  tagId: string;
  version: number;
  value_type: string;
  calculationRule: JsonValue;
  isCurrent: boolean | null;
  isDeleted: boolean;
  feature: JsonValue | null;
  enumValues: JsonValue | null;
  createTime: Date;
  updateTime: Date | null;
  deleteTime: Date | null;
  createdBy: string;
  updatedBy: string | null;
  deletedBy: string | null;
}

export interface TagExportTask {
  id: string;
  name: string | null;
  ownedBy: string;
  description: string | null;
  queryParams: JsonValue;
  status: string;
  totalCount: number | null;
  exportedCount: number | null;
  filePath: string | null;
  errorMessage: string | null;
  isDeleted: boolean;
  feature: JsonValue | null;
  createTime: Date;
  updateTime: Date | null;
  deleteTime: Date | null;
  createdBy: string;
  updatedBy: string | null;
  deletedBy: string | null;
}

export interface TagStorageConfig {
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
}

export interface TagBitmapSyncState {
  id: string;
  tagId: string;
  syncStatus: string;
  lastSyncTime: Date | null;
  lastSyncedCount: number | null;
  lastFullSyncTime: Date | null;
  mvLastRefreshTime: Date | null;
  tagVersion: string | null;
  errorMessage: string | null;
  retryCount: number;
  createTime: Date;
  updateTime: Date | null;
  deleteTime: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
  deletedBy: string | null;
  ownedBy: string;
}

export interface BitmapTable {
  id: string;
  entityType: string;
  entityTypeId: string;
  ownedBy: string;
  totalBits: number;
  name: string | null;
  description: string | null;
  sequence: number;
  usedBits: JsonValue;
  status: string;
  createTime: Date;
  updateTime: Date | null;
  deleteTime: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
  deletedBy: string | null;
  chTableName: string | null;
  isDeleted: boolean;
}

export interface MaterializedViewConfig {
  id: string;
  tagId: string;
  versionId: string;
  mvName: string;
  mvResultTable: string;
  refreshInterval: string;
  ownedBy: string;
  stepOrder: number;
  isCascade: boolean;
  createTime: Date;
  updateTime: Date | null;
  deleteTime: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
  deletedBy: string | null;
}

export interface TagRefreshLog {
  id: string;
  tagId: string;
  versionId: string | null;
  mvName: string;
  ownedBy: string;
  errorMessage: string | null;
  occurredAt: Date;
  isResolved: boolean;
  createTime: Date;
  updateTime: Date | null;
  deleteTime: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface TargetTable {
  id: string;
  tableName: string;
  entityType: string;
  entityTypeId: string;
  ownedBy: string;
  createTableSql: JsonValue;
  tableType: string;
  dimensionColumns: string | null;
  aggregateConfig: string | null;
  tagId: string | null;
  tagVersionId: string | null;
  status: 'DRAFT' | 'CREATE_FAILED' | 'CREATED' | 'ACTIVE' | 'INACTIVE';
  errorMessage: string | null;
  activatedAt: Date | null;
  deactivatedAt: Date | null;
  rowCount: number | null;
  lastRefreshTime: Date | null;
  chExists: boolean | null;
  chSyncTime: Date | null;
  isDeleted: boolean;
  createTime: Date;
  updateTime: Date | null;
  deleteTime: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
  deletedBy: string | null;
}

