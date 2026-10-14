import {z} from 'zod';
import {RuleType} from '@/shared/enums/tag/RuleType';
import {featureSchema} from '@/shared/schemas/common/featureSchema';

// 创建标签版本schema
export const createTagVersionSchema = z.strictObject({
    tagId: z.uuid('标签ID必须是有效的UUID').describe('标签ID'),
    version: z.string().trim().describe('版本号'),
    description: z.string().trim().optional().describe('版本描述'),
    rule: z.strictObject({
        ruleType: z.enum(RuleType).describe('规则类型'),
        ruleContent: z.string().trim().describe('规则内容'),
        dataModelIds: z.array(z.uuid('数据模型ID必须是有效的UUID'))
            .min(1, '至少需要一个数据模型')
            .describe('关联的数据模型ID数组'),
        feature: featureSchema,
    }).optional().describe('计算规则'),
    feature: featureSchema,
});

// 导出TypeScript类型
export type CreateTagVersionDTO = z.infer<typeof createTagVersionSchema>;