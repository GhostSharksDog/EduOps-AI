import {z} from 'zod';
import {DataModelStatus} from '@/shared/enums/data-models/DataModelStatus';
import {extensibleBaseSchema} from '@/shared/schemas/common/index';
import {dataSourceSchema} from '@/modules/data/contracts/schemas/response/datasource/dataSourceSchema';
import {modelColumnSchema} from '@/modules/data/contracts/schemas/response/data-model/modelColumnSchema';

// 数据模型响应schema，使用lazy处理可能的循环依赖
export const dataModelSchema = extensibleBaseSchema.extend({
    name: z.string().trim().min(1, '模型名称不能为空').describe('模型名称'),
    description: z.string().trim().optional().describe('模型描述'),
    datasource: z.lazy(() => dataSourceSchema).describe('数据源'),
    tableName: z.string().trim().optional().describe('表名'),
    status: z.enum(DataModelStatus).describe('模型状态'),
    columns: z.array(modelColumnSchema).default([]).describe('列定义列表'),
});

// 导出类型（VO后缀，符合响应Schema规范）
export type DataModelVO = z.infer<typeof dataModelSchema>;
export type DataModelDetailVO = DataModelVO;
