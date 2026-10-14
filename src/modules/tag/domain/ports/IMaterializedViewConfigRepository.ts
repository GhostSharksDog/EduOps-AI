import { TenantFilterOptions } from '@/platform/get-current-tenant';

export interface MaterializedViewConfigData {
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
  updateTime?: Date;
}

export interface IMaterializedViewConfigRepository {
  create(data: MaterializedViewConfigData): Promise<MaterializedViewConfigData>;
  findById(id: string, tenantFilter?: TenantFilterOptions): Promise<MaterializedViewConfigData | null>;
  findByTagId(tagId: string, tenantFilter?: TenantFilterOptions): Promise<MaterializedViewConfigData[]>;
  findByTagIdAndVersionId(tagId: string, versionId: string, tenantFilter?: TenantFilterOptions): Promise<MaterializedViewConfigData[]>;
  findByMvName(mvName: string, tenantFilter?: TenantFilterOptions): Promise<MaterializedViewConfigData | null>;
  update(data: MaterializedViewConfigData, tenantFilter?: TenantFilterOptions): Promise<MaterializedViewConfigData>;
  delete(id: string, tenantFilter?: TenantFilterOptions): Promise<void>;
  deleteByTagId(tagId: string, tenantFilter?: TenantFilterOptions): Promise<void>;
  findAllWithTagName(tenantFilter?: TenantFilterOptions): Promise<(MaterializedViewConfigData & { tagName: string })[]>;
}
