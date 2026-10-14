import {z} from 'zod';
import {pagedResponseSchema} from '@/shared/schemas/common/pagedResponseSchema';
import {dataModelSchema} from '@/modules/data/contracts/schemas/response/data-model/dataModelSchema';

// 数据模型列表响应schema - 使用pagedResponseSchema作为基础
export const dataModelListSchema = pagedResponseSchema(dataModelSchema);

// 导出TypeScript类型
export type DataModelListVO = z.infer<typeof dataModelListSchema>;
