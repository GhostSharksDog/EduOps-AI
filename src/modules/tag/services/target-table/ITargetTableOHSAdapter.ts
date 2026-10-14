import {TargetTable} from '@/modules/tag/domain/entities/TargetTable';
import {TargetTableVO} from '@/shared/schemas/response/target-table/index';
import {CreateTargetTableDTO, UpdateTargetTableDTO, TargetTableQueryDTO} from '@/shared/schemas/request/target-table/index';
import {NextRequest} from 'next/server';

export interface TargetTableEntity {
  id: string;
  tableName: string;
  entityType: string;
  entityTypeId: string;
  ownedBy: string;
  createTableSql: string;
  tableType: string;
  tagId?: string;
  tagVersionId?: string;
  status: string;
  errorMessage?: string;
  activatedAt?: Date;
  deactivatedAt?: Date;
  rowCount?: number;
  lastRefreshTime?: Date;
  chExists?: boolean | null;
  chSyncTime?: Date | null;
  createTime: Date;
  updateTime?: Date;
  dimensionColumns?: string;
  aggregateConfig?: string;
}

export interface ITargetTableOHSAdapter {
  fromRequestToCreateCommand(request: NextRequest): CreateTargetTableDTO;
  fromRequestToUpdateCommand(request: NextRequest): UpdateTargetTableDTO;
  fromRequestToListQuery(request: NextRequest): TargetTableQueryDTO;
  fromEntityToVO(entity: TargetTableEntity): TargetTableVO;
}
