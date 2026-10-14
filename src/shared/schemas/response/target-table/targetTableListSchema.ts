import {z} from 'zod';
import {targetTableSchema} from '@/shared/schemas/response/target-table/targetTableSchema';

export const targetTableListSchema = z.strictObject({
  items: z.array(targetTableSchema).describe('目标表列表'),
  total: z.number().int().describe('总数'),
  page: z.number().int().describe('当前页码'),
  pageSize: z.number().int().describe('每页数量'),
});

export type TargetTableListVO = z.infer<typeof targetTableListSchema>;
