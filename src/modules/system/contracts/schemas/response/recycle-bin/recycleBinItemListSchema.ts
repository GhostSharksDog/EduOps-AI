import {z} from 'zod';
import {recycleBinItemSchema} from '@/modules/system/contracts/schemas/response/recycle-bin/recycleBinItemSchema';
import {pagedResponseSchema} from '@/shared/schemas/common/pagedResponseSchema';

// 回收站项目列表响应schema - 使用pagedResponseSchema作为基础
export const recycleBinItemListSchema = pagedResponseSchema(recycleBinItemSchema);

// 导出TypeScript类型
export type RecycleBinItemListVO = z.infer<typeof recycleBinItemListSchema>;
