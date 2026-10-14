import {z} from 'zod';
import {TargetTableStatus, TableType} from '@/modules/tag/domain/entities/TargetTable';
import {TagValueType} from '@/shared/enums/tag/TagValueType';

export const targetTableSchema = z.object({
  id: z.uuid().describe('目标表ID'),
  tableName: z.string().describe('目标表名'),
  entityType: z.string().describe('实体类型名称'),
  entityTypeId: z.uuid().describe('实体类型ID'),
  ownedBy: z.uuid().describe('所属者ID'),
  createTableSql: z.string().describe('建表SQL语句'),
  tableType: z.nativeEnum(TableType).nullable().optional().describe('表类型'),
  tagId: z.uuid().nullable().optional().describe('关联标签ID'),
  tagVersionId: z.uuid().nullable().optional().describe('关联标签版本ID'),
  status: z.nativeEnum(TargetTableStatus).describe('状态'),
  errorMessage: z.string().nullable().optional().describe('错误信息'),
  activatedAt: z.string().datetime().nullable().optional().describe('激活时间'),
  deactivatedAt: z.string().datetime().nullable().optional().describe('停用时间'),
  rowCount: z.number().int().nullable().optional().describe('行数统计'),
  lastRefreshTime: z.string().datetime().nullable().optional().describe('最后刷新时间'),
  chExists: z.boolean().nullable().optional().describe('CH表是否存在 (null=未检查)'),
  chSyncTime: z.string().datetime().nullable().optional().describe('CH状态同步时间'),
  tagValueType: z.nativeEnum(TagValueType).nullable().optional().describe('标签值类型（从DDL中解析）'),
  dimensionColumns: z.string().nullable().optional().describe('维度列JSON配置'),
  aggregateConfig: z.string().nullable().optional().describe('聚合函数配置JSON'),
  createTime: z.string().datetime().describe('创建时间'),
  updateTime: z.string().datetime().nullable().optional().describe('更新时间'),
});

export type TargetTableVO = z.infer<typeof targetTableSchema>;
