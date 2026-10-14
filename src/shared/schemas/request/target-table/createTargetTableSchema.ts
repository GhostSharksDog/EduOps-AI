import {z} from 'zod';
import {TableType} from '@/modules/tag/domain/entities/TargetTable';
import {getAllAggregateFunctionNames} from '@/platform/ddl/aggregateFunctionMappings';

export const createTargetTableSchema = z.object({
  tableName: z.string().trim().min(1, '表名不能为空').max(255, '表名不能超过255个字符')
    .refine(
      (val) => /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(val),
      '表名格式无效，支持 schema.table 或 table 格式'
    )
    .describe('目标表名'),
  entityType: z.string().trim().min(1, '实体类型不能为空').max(50, '实体类型不能超过50个字符')
    .describe('实体类型名称'),
  entityTypeId: z.uuid('实体类型ID必须是有效的UUID').describe('实体类型ID'),
  ownedBy: z.uuid('所属者ID必须是有效的UUID').optional().describe('所属者ID'),
  createTableSql: z.string().min(1, '建表SQL不能为空').describe('建表SQL语句'),
  tableType: z.enum([TableType.PHYSICAL_TABLE, TableType.VIEW, TableType.INTERMEDIATE])
    .optional().default(TableType.PHYSICAL_TABLE).describe('表类型'),
  tagId: z.uuid('标签ID必须是有效的UUID').describe('关联标签ID（必填，用于DDL自动生成）'),
  dimensionColumns: z.string().min(1, '维度列配置不能为空').optional().describe('维度列JSON配置'),
  aggregateFunctionName: z.string().min(1, '聚合函数名不能为空').optional().describe('聚合函数名'),
}).refine(
  (data) => {
    if (data.tableType === TableType.INTERMEDIATE) {
      return !!data.dimensionColumns && !!data.aggregateFunctionName;
    }
    return true;
  },
  {message: 'INTERMEDIATE 类型必须提供 dimensionColumns 和 aggregateFunctionName', path: ['tableType']}
).refine(
  (data) => {
    if (data.tableType !== TableType.INTERMEDIATE) {
      return !!data.createTableSql;
    }
    return true;
  },
  {message: 'PHYSICAL_TABLE/VIEW 类型必须提供 createTableSql', path: ['createTableSql']}
).refine(
  (data) => {
    if (data.aggregateFunctionName) {
      return getAllAggregateFunctionNames().includes(data.aggregateFunctionName);
    }
    return true;
  },
  {message: '不支持的聚合函数名', path: ['aggregateFunctionName']}
);

export type CreateTargetTableDTO = z.infer<typeof createTargetTableSchema>;
