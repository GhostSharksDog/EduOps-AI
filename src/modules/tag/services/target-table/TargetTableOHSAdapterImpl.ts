import {ITargetTableOHSAdapter, TargetTableEntity} from '@/modules/tag/services/target-table/ITargetTableOHSAdapter';
import {TargetTableVO} from '@/shared/schemas/response/target-table/index';
import {CreateTargetTableDTO, UpdateTargetTableDTO, TargetTableQueryDTO} from '@/shared/schemas/request/target-table/index';
import {NextRequest} from 'next/server';
import {z} from 'zod';
import {createTargetTableSchema, updateTargetTableSchema, targetTableQuerySchema} from '@/shared/schemas/request/target-table/index';
import {TableType, TargetTableStatus} from '@/modules/tag/domain/entities/TargetTable';
import {deserializeDDLResult} from '@/platform/ddl/index';
import {TagValueType} from '@/shared/enums/tag/TagValueType';

export class TargetTableOHSAdapterImpl implements ITargetTableOHSAdapter {
  
  fromRequestToCreateCommand(request: NextRequest): CreateTargetTableDTO {
    throw new Error('请使用异步版本: fromRequestToCreateCommandAsync');
  }

  async fromRequestToCreateCommandAsync(request: NextRequest): Promise<CreateTargetTableDTO> {
    const body = await request.json();
    return createTargetTableSchema.parse(body);
  }

  fromRequestToUpdateCommand(request: NextRequest): UpdateTargetTableDTO {
    throw new Error('请使用异步版本: fromRequestToUpdateCommandAsync');
  }

  async fromRequestToUpdateCommandAsync(request: NextRequest): Promise<UpdateTargetTableDTO> {
    const body = await request.json();
    return updateTargetTableSchema.parse(body);
  }

  fromRequestToListQuery(request: NextRequest): TargetTableQueryDTO {
    const {searchParams} = new URL(request.url);
    return targetTableQuerySchema.parse({
      status: searchParams.get('status') || undefined,
      entityTypeId: searchParams.get('entityTypeId') || undefined,
      tagId: searchParams.get('tagId') || undefined,
      tableName: searchParams.get('tableName') || undefined,
      page: searchParams.get('page') || 1,
      pageSize: searchParams.get('pageSize') || 20,
    });
  }

  fromEntityToVO(entity: TargetTableEntity): TargetTableVO {
    const ddlResult = deserializeDDLResult(entity.createTableSql);
    const tagValueType: TagValueType | null = ddlResult?.tagValueType ?? null;

    return {
      id: entity.id,
      tableName: entity.tableName,
      entityType: entity.entityType,
      entityTypeId: entity.entityTypeId,
      ownedBy: entity.ownedBy,
      createTableSql: entity.createTableSql,
      tableType: entity.tableType as TableType | undefined,
      tagId: entity.tagId || null,
      tagVersionId: entity.tagVersionId || null,
      status: entity.status as TargetTableStatus,
      errorMessage: entity.errorMessage || null,
      activatedAt: entity.activatedAt?.toISOString() ?? null,
      deactivatedAt: entity.deactivatedAt?.toISOString() ?? null,
      rowCount: entity.rowCount ?? null,
      lastRefreshTime: entity.lastRefreshTime?.toISOString() ?? null,
      chExists: entity.chExists ?? null,
      chSyncTime: entity.chSyncTime?.toISOString() ?? null,
      tagValueType,
      dimensionColumns: entity.dimensionColumns ?? null,
      aggregateConfig: entity.aggregateConfig ?? null,
      createTime: entity.createTime.toISOString(),
      updateTime: entity.updateTime?.toISOString() ?? null,
    };
  }
}
