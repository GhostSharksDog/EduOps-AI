import {z} from 'zod';
import {TableType} from '@/modules/tag/domain/entities/TargetTable';

export const updateTargetTableSchema = z.object({
  tableName: z.string().trim().min(1, '表名不能为空').max(255, '表名不能超过255个字符')
    .refine(
      (val) => /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(val),
      '表名格式无效，支持 schema.table 或 table 格式'
    )
    .optional().describe('目标表名'),
  createTableSql: z.string().min(1, '建表SQL不能为空').optional().describe('建表SQL语句'),
  tableType: z.enum([TableType.PHYSICAL_TABLE, TableType.VIEW, TableType.INTERMEDIATE]).optional().describe('表类型'),
  tagId: z.uuid('标签ID必须是有效的UUID').nullable().optional().describe('关联标签ID'),
  tagVersionId: z.uuid('标签版本ID必须是有效的UUID').nullable().optional().describe('关联标签版本ID'),
  dimensionColumns: z.string().optional().describe('维度列JSON配置'),
  aggregateFunctionName: z.string().optional().describe('聚合函数名'),
});

export type UpdateTargetTableDTO = z.infer<typeof updateTargetTableSchema>;
