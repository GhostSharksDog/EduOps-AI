import {z} from 'zod';
import {TargetTableStatus} from '@/modules/tag/domain/entities/TargetTable';

export const targetTableQuerySchema = z.strictObject({
  status: z.enum([TargetTableStatus.DRAFT, TargetTableStatus.CREATE_FAILED, TargetTableStatus.CREATED, TargetTableStatus.ACTIVE, TargetTableStatus.INACTIVE])
    .optional().describe('状态筛选'),
  entityTypeId: z.uuid('实体类型ID必须是有效的UUID').optional().describe('实体类型ID筛选'),
  tagId: z.uuid('标签ID必须是有效的UUID').optional().describe('标签ID筛选'),
  tableName: z.string().trim().optional().describe('表名模糊搜索'),
  page: z.coerce.number().int().min(1).default(1).describe('页码'),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).describe('每页数量'),
});

export type TargetTableQueryDTO = z.infer<typeof targetTableQuerySchema>;
