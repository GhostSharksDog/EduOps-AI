import {ITargetTableApplicationService} from '@/modules/tag/services/target-table/ITargetTableApplicationService';
import {TargetTableVO, TargetTableListVO} from '@/shared/schemas/response/target-table/index';
import {CreateTargetTableDTO, UpdateTargetTableDTO, TargetTableQueryDTO} from '@/shared/schemas/request/target-table/index';
import {ITargetTableRepository, TargetTableData} from '@/modules/tag/domain/ports/ITargetTableRepository';
import {TagRepository} from '@/modules/tag/domain/ports/TagRepository';
import {ITargetTableOHSAdapter} from '@/modules/tag/services/target-table/ITargetTableOHSAdapter';
import {TargetTable, TargetTableStatus, TableType} from '@/modules/tag/domain/entities/TargetTable';
import {IClickHouseClientAdapter} from '@/platform/database/interface/IClickHouseClientAdapter';
import {deserializeDDLResult, generateTargetTableDDL, serializeDDLResult} from '@/platform/ddl/index';
import type {DDLTableType} from '@/platform/ddl/index';
import {config} from '@/platform/config/index';
import {TenantFilterOptions} from '@/platform/get-current-tenant';
import {log} from '@/platform/logger';
import {
  ConflictException,
  NotFoundException,
  BusinessException,
  ValidationException,
} from '@/shared/errors/index';

/**
 * ClickHouse DESCRIBE TABLE FORMAT JSON 返回的列信息
 */
interface ColumnInfo {
  name: string;
  type: string;
  default_type?: string;
  default_expression?: string;
  comment?: string;
  codec_expression?: string;
  ttl_expression?: string;
}

export class TargetTableApplicationServiceImpl implements ITargetTableApplicationService {
  constructor(
    private readonly repository: ITargetTableRepository,
    private readonly ohsAdapter: ITargetTableOHSAdapter,
    private readonly chClient: IClickHouseClientAdapter,
    private readonly tagRepository: TagRepository
  ) {}

  async listTargetTables(query: TargetTableQueryDTO, tenantId?: string): Promise<TargetTableListVO> {
    const tenantFilter: TenantFilterOptions | undefined = tenantId ? { tenantId } : undefined;
    
    const tables = await this.repository.findAll({
      status: query.status,
      entityTypeId: query.entityTypeId,
      tagId: query.tagId,
      tableName: query.tableName,
    }, tenantFilter);

    const total = tables.length;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    const pagedTables = tables.slice(start, start + pageSize);

    const items = pagedTables.map(t => this.ohsAdapter.fromEntityToVO(this.toVOData(t)));

    return { items, total, page, pageSize };
  }

  async getTargetTableById(id: string): Promise<TargetTableVO | null> {
    const table = await this.repository.findById(id);
    if (!table) return null;
    return this.ohsAdapter.fromEntityToVO(this.toVOData(table));
  }

  async createTargetTable(dto: CreateTargetTableDTO, tenantId?: string, userId?: string): Promise<TargetTableVO> {
    // 检查是否存在未删除的记录
    const existing = await this.repository.findByTableName(dto.tableName);
    if (existing) {
      throw new ConflictException('TAG_TARGET_TABLE_EXISTS', { tableName: dto.tableName });
    }

    // 校验 tagId 对应的标签存在且未删除
    const tag = await this.tagRepository.findById(dto.tagId);
    if (!tag) {
      throw new NotFoundException('TAG_NOT_FOUND', 'Tag', dto.tagId);
    }
    if (tag.isDeleted) {
      throw new BusinessException('TAG_CANNOT_LINK_DELETED_TAG', { tagId: dto.tagId });
    }

    // INTERMEDIATE 类型自动生成 DDL
    let createTableSql: string;
    let dimensionColumns: string | undefined;
    let aggregateConfig: string | undefined;

    if (dto.tableType === TableType.INTERMEDIATE && dto.dimensionColumns && dto.aggregateFunctionName) {
      const ddlResult = generateTargetTableDDL({
        tableName: dto.tableName,
        entityTypeCode: dto.entityType,
        entityTypeId: dto.entityTypeId,
        tableType: dto.tableType as DDLTableType,
        dimensionColumns: JSON.parse(dto.dimensionColumns),
        aggregateFunctionName: dto.aggregateFunctionName,
      });
      createTableSql = serializeDDLResult(ddlResult);
      dimensionColumns = ddlResult.dimensionColumns ? JSON.stringify(ddlResult.dimensionColumns) : undefined;
      aggregateConfig = ddlResult.aggregateConfig ? JSON.stringify(ddlResult.aggregateConfig) : undefined;
    } else {
      createTableSql = dto.createTableSql;
    }

    const table = new TargetTable(
      crypto.randomUUID(),
      dto.tableName,
      dto.entityType,
      dto.entityTypeId,
      tenantId ?? config.system.userId,
      createTableSql,
      dto.tableType,
      dto.tagId ?? undefined,
      tag.currentVersionId ?? undefined,
      TargetTableStatus.DRAFT,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      dimensionColumns,
      aggregateConfig
    );

    const data = await this.repository.create(table.toData());
    return this.ohsAdapter.fromEntityToVO(this.toVOData(data));
  }

  async updateTargetTable(id: string, dto: UpdateTargetTableDTO): Promise<TargetTableVO> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException('TAG_TARGET_TABLE_NOT_FOUND', 'TargetTable', id);
    }

    if (dto.tableName && dto.tableName !== existing.tableName) {
      const nameConflict = await this.repository.findByTableName(dto.tableName);
      if (nameConflict) {
        throw new ConflictException('TAG_TARGET_TABLE_EXISTS', { tableName: dto.tableName });
      }
    }

    // INTERMEDIATE 类型：如果提供了 dimensionColumns 或 aggregateFunctionName，重新生成 DDL
    let createTableSql = dto.createTableSql ?? existing.createTableSql;
    let dimensionColumns = dto.dimensionColumns ?? existing.dimensionColumns;
    let aggregateConfig = existing.aggregateConfig;

    const effectiveTableType = dto.tableType ?? existing.tableType;
    if (effectiveTableType === TableType.INTERMEDIATE && (dto.dimensionColumns || dto.aggregateFunctionName)) {
      const dimCols = dto.dimensionColumns ? JSON.parse(dto.dimensionColumns) : (existing.dimensionColumns ? JSON.parse(existing.dimensionColumns) : undefined);
      const aggFn = dto.aggregateFunctionName;
      if (dimCols && aggFn) {
        const ddlResult = generateTargetTableDDL({
          tableName: dto.tableName ?? existing.tableName,
          entityTypeCode: existing.entityType,
          entityTypeId: existing.entityTypeId,
          tableType: effectiveTableType as DDLTableType,
          dimensionColumns: dimCols,
          aggregateFunctionName: aggFn,
        });
        createTableSql = serializeDDLResult(ddlResult);
        dimensionColumns = ddlResult.dimensionColumns ? JSON.stringify(ddlResult.dimensionColumns) : undefined;
        aggregateConfig = ddlResult.aggregateConfig ? JSON.stringify(ddlResult.aggregateConfig) : undefined;
      }
    }

    const updated = await this.repository.update({
      ...existing,
      tableName: dto.tableName ?? existing.tableName,
      createTableSql,
      tableType: dto.tableType ?? existing.tableType,
      tagId: dto.tagId === null ? undefined : (dto.tagId ?? existing.tagId),
      tagVersionId: dto.tagVersionId === null ? undefined : (dto.tagVersionId ?? existing.tagVersionId),
      dimensionColumns,
      aggregateConfig,
      updateTime: new Date(),
    });

    return this.ohsAdapter.fromEntityToVO(this.toVOData(updated));
  }

  async deleteTargetTable(id: string, userId?: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException('TAG_TARGET_TABLE_NOT_FOUND', 'TargetTable', id);
    }

    const entity = TargetTable.fromData(existing);
    if (!entity.canDelete()) {
      throw new BusinessException('TAG_BUSINESS_CANNOT_DELETE_ACTIVE_TABLE', { id });
    }

    if (existing.tagId && existing.tagVersionId) {
      const tag = await this.tagRepository.findById(existing.tagId);
      if (tag && !tag.isDeleted) {
        throw new BusinessException('TAG_TARGET_TABLE_CANNOT_DELETE_LINKED_TAG', { id, tagId: existing.tagId });
      }
    }

    // 软删除：保留 CH 表，只标记 PG 记录，回收站永久删除时再清理 CH
    await this.repository.delete(id, userId);
  }

  async createTable(id: string): Promise<TargetTableVO> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException('TAG_TARGET_TABLE_NOT_FOUND', 'TargetTable', id);
    }

    const entity = TargetTable.fromData(existing);
    if (!entity.canCreateTable()) {
      throw new BusinessException('TAG_BUSINESS_INVALID_STATUS_TRANSITION', { from: existing.status, to: 'CREATED' });
    }

    try {
      const ddlResult = deserializeDDLResult(entity.createTableSql);
      const sqlToExecute = ddlResult?.sql ?? entity.createTableSql;
      await this.chClient.createTable(sqlToExecute);
      entity.markAsCreated();
      // 建表后验证 CH 表是否真的存在
      entity.chExists = await this.chClient.checkTableExists(entity.tableName);
      entity.chSyncTime = new Date();
      if (!entity.chExists) {
        log.error('ClickHouse DDL 成功但表不存在', { tableName: entity.tableName, id });
      } else {
        log.info('ClickHouse 目标表创建成功', { tableName: entity.tableName, id });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      entity.markAsCreateFailed(errorMessage);
      log.error('ClickHouse 目标表创建失败', { tableName: entity.tableName, id, error });
    }

    const updated = await this.repository.update(entity.toData());
    return this.ohsAdapter.fromEntityToVO(this.toVOData(updated));
  }

  async activate(id: string): Promise<TargetTableVO> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException('TAG_TARGET_TABLE_NOT_FOUND', 'TargetTable', id);
    }

    const entity = TargetTable.fromData(existing);
    if (!entity.canActivate()) {
      throw new BusinessException('TAG_BUSINESS_INVALID_STATUS_TRANSITION', { from: existing.status, to: 'ACTIVE' });
    }

    const tableExists = await this.chClient.checkTableExists(entity.tableName);
    if (!tableExists) {
      throw new ValidationException('TAG_VALIDATION_SCHEMA_INVALID', { message: `表 ${entity.tableName} 不存在于 ClickHouse` });
    }

    const escapedTableName = entity.tableName
      .split('.')
      .map(p => `\`${p}\``)
      .join('.');
    const schemaResult = await this.chClient.query<ColumnInfo>(
      `DESCRIBE TABLE ${escapedTableName}`
    );
    const columnMap = new Map(schemaResult.map(col => [col.name, col]));

    const requiredColumns: string[] = [];
    if (!entity.isIntermediate()) {
      requiredColumns.push('entity_id', 'tag_value');
    } else {
      const dimCols = entity.getDimensionColumns();
      requiredColumns.push(...dimCols.map(col => col.name), 'entity_id', 'tag_value');
    }
    for (const colName of requiredColumns) {
      const column = columnMap.get(colName);
      if (!column) {
        throw new ValidationException('TAG_VALIDATION_SCHEMA_INVALID', {
          message: `表 ${entity.tableName} 缺少必要列: ${colName}`,
        });
      }
    }

    entity.activate();
    const updated = await this.repository.update(entity.toData());
    
    log.info('目标表已激活', { tableName: entity.tableName, id });
    return this.ohsAdapter.fromEntityToVO(this.toVOData(updated));
  }

  async deactivate(id: string): Promise<TargetTableVO> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException('TAG_TARGET_TABLE_NOT_FOUND', 'TargetTable', id);
    }

    const entity = TargetTable.fromData(existing);
    if (!entity.canDeactivate()) {
      throw new BusinessException('TAG_BUSINESS_INVALID_STATUS_TRANSITION', { from: existing.status, to: 'INACTIVE' });
    }

    entity.deactivate();
    const updated = await this.repository.update(entity.toData());
    
    log.info('目标表已停用', { tableName: entity.tableName, id });
    return this.ohsAdapter.fromEntityToVO(this.toVOData(updated));
  }

  async linkTag(id: string, tagId: string, tagVersionId: string): Promise<TargetTableVO> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException('TAG_TARGET_TABLE_NOT_FOUND', 'TargetTable', id);
    }

    // 验证 Tag 存在且未被删除
    const tag = await this.tagRepository.findById(tagId);
    if (!tag) {
      throw new NotFoundException('TAG_NOT_FOUND', 'Tag', tagId);
    }
    if (tag.isDeleted) {
      throw new BusinessException('TAG_CANNOT_LINK_DELETED_TAG', { tagId });
    }

    const entity = TargetTable.fromData(existing);
    entity.linkTag(tagId, tagVersionId);

    const updated = await this.repository.update(entity.toData());
    return this.ohsAdapter.fromEntityToVO(this.toVOData(updated));
  }

  private toVOData(data: TargetTableData) {
    return {
      id: data.id,
      tableName: data.tableName,
      entityType: data.entityType,
      entityTypeId: data.entityTypeId,
      ownedBy: data.ownedBy,
      createTableSql: data.createTableSql,
      tableType: data.tableType,
      tagId: data.tagId,
      tagVersionId: data.tagVersionId,
      status: data.status,
      errorMessage: data.errorMessage,
      activatedAt: data.activatedAt,
      deactivatedAt: data.deactivatedAt,
      rowCount: data.rowCount,
      lastRefreshTime: data.lastRefreshTime,
      chExists: data.chExists,
      chSyncTime: data.chSyncTime,
      createTime: data.createTime,
      updateTime: data.updateTime,
      dimensionColumns: data.dimensionColumns ?? undefined,
      aggregateConfig: data.aggregateConfig ?? undefined,
    };
  }

  async syncStatus(id: string): Promise<TargetTableVO> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException('TAG_TARGET_TABLE_NOT_FOUND', 'TargetTable', id);
    }

    const entity = TargetTable.fromData(existing);
    // 只对已建表/已激活/已停用的表检查CH存在性
    if (!entity.isDraft()) {
      const exists = await this.chClient.checkTableExists(entity.tableName);
      entity.chExists = exists;
      entity.chSyncTime = new Date();

      // 如果表不存在但状态是ACTIVE/CREATED，回退为CREATE_FAILED
      if (!exists && (entity.isActive() || entity.isCreated())) {
        log.warn('ClickHouse 表已不存在，回退状态为 CREATE_FAILED', { tableName: entity.tableName, oldStatus: entity.status });
        entity.markAsMissing();
      }

      // 如果表存在但状态是CREATE_FAILED（之前丢失后重建了），恢复为CREATED
      if (exists && entity.status === 'CREATE_FAILED') {
        log.info('ClickHouse 表已恢复，更新状态为 CREATED', { tableName: entity.tableName });
        entity.status = 'CREATED' as any;
        entity.errorMessage = null as any;
      }

      await this.repository.update(entity.toData());
    }

    const updated = await this.repository.findById(id);
    return this.ohsAdapter.fromEntityToVO(this.toVOData(updated!));
  }

  async syncAllStatus(): Promise<{ synced: number; missing: number }> {
    const tables = await this.repository.findAll({ status: undefined });
    let synced = 0;
    let missing = 0;

    for (const table of tables) {
      const entity = TargetTable.fromData(table);
      if (entity.isDraft()) continue;

      try {
        const exists = await this.chClient.checkTableExists(entity.tableName);
        entity.chExists = exists;
        entity.chSyncTime = new Date();
        if (!exists) missing++;
        await this.repository.update(entity.toData());
        synced++;
      } catch (error) {
        log.error('同步目标表状态失败', { tableName: entity.tableName, error });
      }
    }

    return { synced, missing };
  }
}
