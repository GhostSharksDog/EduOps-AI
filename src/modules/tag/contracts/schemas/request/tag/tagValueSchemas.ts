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

export type GetTagValuesRequest = z.infer<typeof getTagValuesSchema>;

/**
 * 获取单个标签值请求 Schema
 */
export const getTagValueSchema = z.strictObject({
  tagId: z.string().uuid('tagId 格式错误'),
  entityId: z.string().uuid('entityId 格式错误'),
  versionId: z.string().uuid('versionId 格式错误').optional(),
});

export type GetTagValueRequest = z.infer<typeof getTagValueSchema>;

/**
 * 激活标签请求 Schema
 */
export const activateTagSchema = z.strictObject({
  tagId: z.string().uuid('tagId 格式错误'),
});

export type ActivateTagRequest = z.infer<typeof activateTagSchema>;

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

export type UpdateTagRuleRequest = z.infer<typeof updateTagRuleSchema>;

/**
 * 更新标签周期请求 Schema
 */
export const updateTagCycleSchema = z.strictObject({
  tagId: z.string().uuid('tagId 格式错误'),
  cycle: z.nativeEnum(UpdateCycle),
});

export type UpdateTagCycleRequest = z.infer<typeof updateTagCycleSchema>;
