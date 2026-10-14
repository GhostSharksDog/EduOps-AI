import {z} from 'zod';
import {RuleType} from '@/shared/enums/tag/RuleType';
import {featureSchema} from '@/shared/schemas/common/featureSchema';

// 级联步骤 schema
const cascadeStepSchema = z.strictObject({
    order: z.number().int().positive().describe('步骤顺序'),
    sql: z.string().trim().min(1, 'SQL 不能为空').describe('SQL 语句'),
    targetTableId: z.uuid('目标表ID必须是有效的UUID').optional().describe('关联的目标表ID'),
});

// 标签规则 schema
export const tagRuleSchema = z.strictObject({
    ruleType: z.enum(RuleType).describe('规则类型'),
    ruleContent: z.string().trim()
        .min(1, '规则内容不能为空')
        .max(10000, '规则内容不能超过10000个字符')
        .optional()
        .describe('规则内容（SQL 类型必填）'),
    steps: z.array(cascadeStepSchema)
        .min(1, '级联步骤至少需要一个')
        .optional()
        .describe('级联步骤（CASCADE 类型必填）'),
    dataModelIds: z.array(z.uuid('数据模型ID必须是有效的UUID'))
        .min(1, '至少需要一个数据模型')
        .describe('关联的数据模型ID数组'),
    feature: featureSchema.default({}),
}).refine(
    (data) => {
        // SQL 类型必须有 ruleContent
        if (data.ruleType === RuleType.SQL && !data.ruleContent) {
            return false;
        }
        // CASCADE 类型必须有 steps
        if (data.ruleType === RuleType.CASCADE && (!data.steps || data.steps.length === 0)) {
            return false;
        }
        return true;
    },
    {
        message: 'SQL 类型需要 ruleContent，CASCADE 类型需要 steps',
    }
);

// 导出 TypeScript 类型
export type TagRuleDTO = z.infer<typeof tagRuleSchema>;
