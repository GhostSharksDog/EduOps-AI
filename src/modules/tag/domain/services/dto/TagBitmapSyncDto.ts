/**
 * Tag Bitmap 同步相关 DTO 类型
 */

/** 同步状态枚举 */
export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'OBSOLETE';

/** 同步类型 */
export type SyncType = 'FULL' | 'INCREMENTAL';

/** 单个标签同步结果 */
export interface SyncResult {
  /** 是否成功 */
  success: boolean;
  /** 标签 ID */
  tagId: string;
  /** 同步行数 */
  syncedCount: number;
  /** 同步类型（全量/增量） */
  syncType: SyncType;
  /** 同步耗时（毫秒） */
  durationMs: number;
  /** 错误信息（失败时） */
  error?: string;
}

/** 批量同步结果 */
export interface BatchSyncResult {
  /** 总数 */
  total: number;
  /** 成功数 */
  succeeded: number;
  /** 失败数 */
  failed: number;
  /** 各标签同步结果 */
  results: SyncResult[];
}

/** 同步状态 */
export interface SyncState {
  /** 记录 ID */
  id: string;
  /** 标签 ID */
  tagId: string;
  /** 同步状态 */
  syncStatus: SyncStatus;
  /** 最近同步时间 */
  lastSyncTime: Date | null;
  /** 最近同步行数 */
  lastSyncedCount: number | null;
  /** 最近全量同步时间 */
  lastFullSyncTime: Date | null;
  /** MV 最近刷新时间 */
  mvLastRefreshTime: Date | null;
  /** 标签版本 */
  tagVersion: string | null;
  /** 错误信息 */
  errorMessage: string | null;
  /** 重试次数 */
  retryCount: number;
}

/** 创建同步状态命令 */
export interface CreateSyncStateCommand {
  /** 标签 ID */
  tagId: string;
  /** 标签版本 */
  tagVersion: string;
  /** 租户 ID */
  ownedBy: string;
}

/** Repository 创建数据 */
export interface CreateSyncStateData {
  tagId: string;
  tagVersion: string;
  ownedBy: string;
  syncStatus: SyncStatus;
}

/** Repository 更新数据 */
export interface UpdateSyncStateData {
  syncStatus?: SyncStatus;
  lastSyncTime?: Date;
  lastSyncedCount?: number;
  lastFullSyncTime?: Date;
  mvLastRefreshTime?: Date;
  tagVersion?: string;
  errorMessage?: string;
  retryCount?: number;
  updatedBy?: string;
}
