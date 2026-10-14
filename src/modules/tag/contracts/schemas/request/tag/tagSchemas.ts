import { z } from 'zod';
import { RuleType } from '@/shared/enums/tag/RuleType';
import { UpdateCycle } from '@/shared/enums/tag/UpdateCycle';

/**
 * 获取标签值请求 Schema
 */
export const getTagValuesSchema = z.strictObject({
  tagId: z.string().uuid('tagId 格式错误'),
  entityIds: z
    .string()
    .transform((val) => val.split(',').filter(Boolean))
    .refine((arr) => arr.length > 0, { message: 'entityIds 不能为空' }),
  versionId: z.string().uuid('versionId 格式错误').optional(),
});

/**
 * 获取单个标签值请求 Schema
 */
export const getTagValueSchema = z.strictObject({
  tagId: z.string().uuid('tagId 格式错误'),
  entityId: z.string().uuid('entityId 格式错误'),
  versionId: z.string().uuid('versionId 格式错误').optional(),
});

/**
 * 激活标签请求 Schema
 */
export const activateTagSchema = z.strictObject({
  tagId: z.string().uuid('tagId 格式错误'),
});

/**
 * 停用标签请求 Schema
 */
export const deactivateTagSchema = z.strictObject({
  tagId: z.string().uuid('tagId 格式错误'),
});

/**
 * 删除标签请求 Schema
 */
export const deleteTagSchema = z.strictObject({
  tagId: z.string().uuid('tagId 格式错误'),
});

/**
 * 更新标签规则请求 Schema
 */
export const updateTagRuleSchema = z.strictObject({
  tagId: z.string().uuid('tagId 格式错误'),
  rule: z.strictObject({
    ruleType: z.nativeEnum(RuleType),
    ruleContent: z.string().optional(),
    steps: z
      .array(
        z.strictObject({
          order: z.number().int().positive(),
          sql: z.string().min(1, 'SQL 不能为空'),
        })
      )
      .optional(),
    dataModelIds: z.array(z.string().uuid()).optional(),
  }),
});

/**
 * 更新标签周期请求 Schema
 */
export const updateTagCycleSchema = z.strictObject({
  tagId: z.string().uuid('tagId 格式错误'),
  cycle: z.nativeEnum(UpdateCycle),
});

// 类型导出
export type GetTagValuesRequest = z.infer<typeof getTagValuesSchema>;
export type GetTagValueRequest = z.infer<typeof getTagValueSchema>;
export type ActivateTagRequest = z.infer<typeof activateTagSchema>;
export type DeactivateTagRequest = z.infer<typeof deactivateTagSchema>;
export type DeleteTagRequest = z.infer<typeof deleteTagSchema>;
export type UpdateTagRuleRequest = z.infer<typeof updateTagRuleSchema>;
export type UpdateTagCycleRequest = z.infer<typeof updateTagCycleSchema>;
