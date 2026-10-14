import {z} from 'zod';
import {DataModelStatus} from '@/shared/enums/data-models/DataModelStatus';

// 数据模型状态更新响应schema
export const dataModelStatusUpdateSchema = z.strictObject({
    id: z.uuid('模型ID必须是有效的UUID').describe('模型ID'),
    name: z.string().trim().describe('模型名称'),
    status: z.enum(DataModelStatus).describe('模型状态'),
});

// 导出TypeScript类型
export type DataModelStatusUpdateVO = z.infer<typeof dataModelStatusUpdateSchema>;
