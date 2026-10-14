import { TenantFilterOptions } from '@/platform/get-current-tenant';
import { TargetTableStatus } from '@/modules/tag/domain/entities/TargetTable';

export interface TargetTableData {
  id: string;
  tableName: string;
  entityType: string;
  entityTypeId: string;
  ownedBy: string;
  createTableSql: string;
  tableType: string;
  tagId?: string;
  tagVersionId?: string;
  status: TargetTableStatus;
  errorMessage?: string;
  activatedAt?: Date;
  deactivatedAt?: Date;
  rowCount?: number;
  lastRefreshTime?: Date;
  chExists?: boolean | null;
  chSyncTime?: Date | null;
  createTime: Date;
  updateTime?: Date;
  dimensionColumns?: string | null;
  aggregateConfig?: string | null;
  isDeleted: boolean;
  deleteTime?: Date | null;
}

export interface TargetTableQueryOptions {
  status?: TargetTableStatus;
  entityTypeId?: string;
  tagId?: string;
  tableName?: string;
}

export interface ITargetTableRepository {
  create(data: TargetTableData): Promise<TargetTableData>;

  findById(id: string): Promise<TargetTableData | null>;

  findByTableName(tableName: string): Promise<TargetTableData | null>;

  /** 查找任意状态（含软删除）的表名记录 */
  findAnyByTableName(tableName: string): Promise<TargetTableData | null>;

  findByTagId(tagId: string): Promise<TargetTableData | null>;

  findAll(options?: TargetTableQueryOptions, tenantFilter?: TenantFilterOptions): Promise<TargetTableData[]>;

  update(data: TargetTableData): Promise<TargetTableData>;

  /** 恢复软删除的记录 */
  restore(id: string): Promise<TargetTableData>;

  delete(id: string, deletedBy?: string): Promise<void>;

  updateStatus(id: string, status: TargetTableStatus): Promise<TargetTableData>;

  linkTag(id: string, tagId: string, tagVersionId: string): Promise<TargetTableData>;

  unlinkTag(id: string): Promise<TargetTableData>;

  updateStats(id: string, rowCount: number, lastRefreshTime?: Date): Promise<TargetTableData>;
}
