import {z} from 'zod';
import type {TagVO} from '@/modules/tag/contracts/schemas/response/tag/tagSchema';
import {featureSchema} from '@/shared/schemas/common/featureSchema';

// Forward declaration for circular reference
type LazyTagSchema = z.ZodLazy<z.ZodType<TagVO>>;

// 标签规则schema
export const tagRuleSchema = z.strictObject({
    id: z.uuid().describe('唯一标识符'),
    tag: z.lazy(() => z.any()).describe('关联的标签对象') as z.ZodLazy<z.ZodAny>,
    ruleType: z.string().trim().describe('规则类型'),
    ruleContent: z.string().trim().describe('规则内容'),
    dataModelIds: z.array(z.uuid()).describe('关联的数据模型ID数组'),
    feature: featureSchema,
    isDeleted: z.boolean().describe('是否删除'),
    createTime: z.iso.datetime().describe('创建时间'),
    updateTime: z.iso.datetime().optional().describe('更新时间'),
    deleteTime: z.iso.datetime().optional().describe('删除时间'),
    createdBy: z.uuid().optional().describe('创建人ID'),
    updatedBy: z.uuid().optional().describe('更新人ID'),
    deletedBy: z.uuid().optional().describe('删除人ID'),
});

// 导出类型（VO后缀，符合响应Schema规范）
export type TagRuleVO = z.infer<typeof tagRuleSchema>;