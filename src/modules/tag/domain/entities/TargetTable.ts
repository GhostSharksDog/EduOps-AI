import type { DimensionColumn } from '@/modules/tag/domain/value-objects/DimensionColumn';
import type { AggregateFunctionConfig } from '@/platform/ddl/aggregateFunctionMappings';

export enum TargetTableStatus {
  DRAFT = 'DRAFT',           // 草稿，未建表
  CREATE_FAILED = 'CREATE_FAILED', // 建表失败
  CREATED = 'CREATED',       // 已建表，未激活
  ACTIVE = 'ACTIVE',         // 激活使用中
  INACTIVE = 'INACTIVE',     // 已停用
}

export enum TableType {
  PHYSICAL_TABLE = 'PHYSICAL_TABLE',
  VIEW = 'VIEW',
  INTERMEDIATE = 'INTERMEDIATE',
}

export class TargetTable {
  constructor(
    public id: string,
    public tableName: string,
    public entityType: string,
    public entityTypeId: string,
    public ownedBy: string,
    public createTableSql: string,
    public tableType: TableType,
    public tagId?: string,
    public tagVersionId?: string,
    public status: TargetTableStatus = TargetTableStatus.DRAFT,
    public errorMessage?: string,
    public activatedAt?: Date,
    public deactivatedAt?: Date,
    public rowCount?: number,
    public lastRefreshTime?: Date,
    public chExists?: boolean | null,
    public chSyncTime?: Date | null,
    public createTime: Date = new Date(),
    public updateTime?: Date,
    public dimensionColumns?: string,
    public aggregateConfig?: string
  ) {}

  // ==================== 状态检查方法 ====================

  isDraft(): boolean {
    return this.status === TargetTableStatus.DRAFT;
  }

  isCreateFailed(): boolean {
    return this.status === TargetTableStatus.CREATE_FAILED;
  }

  isCreated(): boolean {
    return this.status === TargetTableStatus.CREATED;
  }

  isActive(): boolean {
    return this.status === TargetTableStatus.ACTIVE;
  }

  isInactive(): boolean {
    return this.status === TargetTableStatus.INACTIVE;
  }

  // ==================== 状态转换校验方法 ====================

  /**
   * 是否可以执行建表操作
   * DRAFT、CREATE_FAILED 或 INACTIVE（表丢失时可重建）状态可以建表
   */
  canCreateTable(): boolean {
    return this.status === TargetTableStatus.DRAFT || 
           this.status === TargetTableStatus.CREATE_FAILED ||
           this.status === TargetTableStatus.INACTIVE;
  }

  /**
   * 是否可以激活
   * CREATED 或 INACTIVE 状态可以激活
   */
  canActivate(): boolean {
    return this.status === TargetTableStatus.CREATED || 
           this.status === TargetTableStatus.INACTIVE;
  }

  /**
   * 是否可以停用
   * 只有 ACTIVE 状态可以停用
   */
  canDeactivate(): boolean {
    return this.status === TargetTableStatus.ACTIVE;
  }

  /**
   * 是否可以删除
   * ACTIVE 状态不能删除，需先停用
   */
  canDelete(): boolean {
    return this.status !== TargetTableStatus.ACTIVE;
  }

  // ==================== 状态转换方法 ====================

  /**
   * 标记建表成功
   * DRAFT/CREATE_FAILED → CREATED
   */
  markAsCreated(): void {
    if (!this.canCreateTable()) {
      throw new Error(`无法将状态标记为 CREATED，当前状态为 ${this.status}`);
    }
    this.status = TargetTableStatus.CREATED;
    this.errorMessage = undefined;
    this.updateTime = new Date();
  }

  /**
   * 标记建表失败
   * DRAFT/CREATE_FAILED → CREATE_FAILED
   */
  markAsCreateFailed(error: string): void {
    if (!this.canCreateTable()) {
      throw new Error(`无法将状态标记为 CREATE_FAILED，当前状态为 ${this.status}`);
    }
    this.status = TargetTableStatus.CREATE_FAILED;
    this.errorMessage = error;
    this.updateTime = new Date();
  }

  /**
   * 标记表丢失（同步检测到 CH 表不存在时回退）
   * CREATED/ACTIVE/INACTIVE → CREATE_FAILED
   */
  markAsMissing(): void {
    this.status = TargetTableStatus.CREATE_FAILED;
    this.errorMessage = '同步检测到 ClickHouse 表丢失';
    this.updateTime = new Date();
  }

  /**
   * 激活
   * CREATED/INACTIVE → ACTIVE
   */
  activate(): void {
    if (!this.canActivate()) {
      throw new Error(`无法激活，当前状态为 ${this.status}`);
    }
    this.status = TargetTableStatus.ACTIVE;
    this.activatedAt = new Date();
    this.deactivatedAt = undefined;
    this.updateTime = new Date();
  }

  /**
   * 停用
   * ACTIVE → INACTIVE
   */
  deactivate(): void {
    if (!this.canDeactivate()) {
      throw new Error(`无法停用，当前状态为 ${this.status}`);
    }
    this.status = TargetTableStatus.INACTIVE;
    this.deactivatedAt = new Date();
    this.updateTime = new Date();
  }

  /**
   * 重置为草稿（用于修改 SQL 后重试）
   * CREATE_FAILED → DRAFT
   */
  resetToDraft(): void {
    if (this.status !== TargetTableStatus.CREATE_FAILED) {
      throw new Error(`无法重置为 DRAFT，当前状态为 ${this.status}`);
    }
    this.status = TargetTableStatus.DRAFT;
    this.errorMessage = undefined;
    this.updateTime = new Date();
  }

  // ==================== 其他方法 ====================

  linkTag(tagId: string, tagVersionId: string): void {
    if (!this.isCreated() && !this.isActive() && !this.isInactive()) {
      throw new Error('无法将标签关联到未创建的表');
    }
    this.tagId = tagId;
    this.tagVersionId = tagVersionId;
    this.updateTime = new Date();
  }

  /**
   * 解除标签关联
   */
  unlinkTag(): void {
    this.tagId = undefined;
    this.tagVersionId = undefined;
    this.updateTime = new Date();
  }

  updateStats(rowCount: number, lastRefreshTime?: Date): void {
    this.rowCount = rowCount;
    this.lastRefreshTime = lastRefreshTime;
    this.updateTime = new Date();
  }

  // ==================== INTERMEDIATE 相关方法 ====================

  getDimensionColumns(): DimensionColumn[] {
    if (!this.dimensionColumns) return [];
    try {
      return JSON.parse(this.dimensionColumns);
    } catch {
      return [];
    }
  }

  getAggregateConfig(): AggregateFunctionConfig | null {
    if (!this.aggregateConfig) return null;
    try {
      return JSON.parse(this.aggregateConfig);
    } catch {
      return null;
    }
  }

  isIntermediate(): boolean {
    return this.tableType === TableType.INTERMEDIATE;
  }

  validateIntermediate(): void {
    if (!this.isIntermediate()) return;
    if (!this.aggregateConfig) {
      throw new Error('INTERMEDIATE 类型必须提供 aggregateConfig');
    }
    if (!this.dimensionColumns || this.getDimensionColumns().length === 0) {
      throw new Error('INTERMEDIATE 类型必须至少包含一个维度列');
    }
  }

  // ==================== 工厂方法 ====================

  static fromData(data: {
    id: string;
    tableName: string;
    entityType: string;
    entityTypeId: string;
    ownedBy: string;
    createTableSql: string;
    tableType: string;
    tagId?: string | null;
    tagVersionId?: string | null;
    status: string;
    errorMessage?: string | null;
    activatedAt?: Date | null;
    deactivatedAt?: Date | null;
    rowCount?: number | null;
    lastRefreshTime?: Date | null;
    chExists?: boolean | null;
    chSyncTime?: Date | null;
    createTime: Date;
    updateTime?: Date | null;
    dimensionColumns?: string | null;
    aggregateConfig?: string | null;
  }): TargetTable {
    return new TargetTable(
      data.id,
      data.tableName,
      data.entityType,
      data.entityTypeId,
      data.ownedBy,
      data.createTableSql,
      data.tableType as TableType,
      data.tagId ?? undefined,
      data.tagVersionId ?? undefined,
      data.status as TargetTableStatus,
      data.errorMessage ?? undefined,
      data.activatedAt ?? undefined,
      data.deactivatedAt ?? undefined,
      data.rowCount ?? undefined,
      data.lastRefreshTime ?? undefined,
      data.chExists,
      data.chSyncTime,
      data.createTime,
      data.updateTime ?? undefined,
      data.dimensionColumns ?? undefined,
      data.aggregateConfig ?? undefined
    );
  }

  toData(): {
    id: string;
    tableName: string;
    entityType: string;
    entityTypeId: string;
    ownedBy: string;
    createTableSql: string;
    tableType: TableType;
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
    isDeleted: boolean;
    dimensionColumns?: string;
    aggregateConfig?: string;
  } {
    return {
      id: this.id,
      tableName: this.tableName,
      entityType: this.entityType,
      entityTypeId: this.entityTypeId,
      ownedBy: this.ownedBy,
      createTableSql: this.createTableSql,
      tableType: this.tableType,
      tagId: this.tagId,
      tagVersionId: this.tagVersionId,
      status: this.status,
      errorMessage: this.errorMessage,
      activatedAt: this.activatedAt,
      deactivatedAt: this.deactivatedAt,
      rowCount: this.rowCount,
      lastRefreshTime: this.lastRefreshTime,
      chExists: this.chExists,
      chSyncTime: this.chSyncTime,
      createTime: this.createTime,
      updateTime: this.updateTime,
      isDeleted: false,
      dimensionColumns: this.dimensionColumns,
      aggregateConfig: this.aggregateConfig,
    };
  }
}
