import {z} from 'zod';
import {tagSchema} from '@/modules/tag/contracts/schemas/response/tag/tagSchema';
import {tagRuleSchema} from '@/modules/tag/contracts/schemas/response/tag/tagRuleSchema';
import {featureSchema} from '@/shared/schemas/common/featureSchema';

// 标签版本schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tagVersionSchema: z.ZodType<any> = z.strictObject({
    id: z.uuid().describe('唯一标识符'),
    tag: z.lazy(() => tagSchema).describe('关联的标签对象'),
    version: z.string().trim().describe('版本号'),
    description: z.string().trim().optional().describe('版本描述'),
    calculationRule: z.string().optional().describe('JSON 计算规则'),
    rule: z.lazy(() => tagRuleSchema).optional().describe('关联的计算规则对象'),
    enumValues: z.array(z.string()).optional().describe('枚举值列表（仅 ENUM 类型）'),
    targetTableId: z.string().uuid().optional().describe('关联的目标表ID'),
    isCurrent: z.boolean().describe('是否为当前版本'),
    isDeleted: z.boolean().describe('是否删除'),
    feature: featureSchema,
    createTime: z.iso.datetime().describe('创建时间'),
    updateTime: z.iso.datetime().optional().describe('更新时间'),
    deleteTime: z.iso.datetime().optional().describe('删除时间'),
    createdBy: z.uuid().optional().describe('创建人ID'),
    updatedBy: z.uuid().optional().describe('更新人ID'),
    deletedBy: z.uuid().optional().describe('删除人ID'),
});

// 导出类型（VO后缀，符合响应Schema规范）
export type TagVersionVO = z.infer<typeof tagVersionSchema>;