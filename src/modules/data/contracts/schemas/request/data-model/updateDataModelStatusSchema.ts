import {z} from 'zod';
import {DataModelStatus} from '@/shared/enums/data-models/DataModelStatus';

// 更新模型状态 schema
export const updateDataModelStatusSchema = z.strictObject({
    id: z.uuid('模型ID必须是有效的UUID').describe('模型ID'),
    status: z.enum(Object.values(DataModelStatus) as [string, ...string[]]).describe('模型状态'),
});

// 导出TypeScript类型
export type UpdateDataModelStatusDTO = z.infer<typeof updateDataModelStatusSchema>;
