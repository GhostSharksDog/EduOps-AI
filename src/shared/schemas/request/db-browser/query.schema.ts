import { z } from 'zod';

const identifierSchema = z
  .string()
  .min(1, { message: '标识符不能为空' })
  .max(63, { message: '标识符不能超过 63 个字符' })
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
    message: '无效的标识符格式: 必须以字母或下划线开头，只能包含字母、数字和下划线',
  });

export const getTablesQuerySchema = z.strictObject({
  schema: identifierSchema.default('public'),
});

export const previewQuerySchema = z.strictObject({
  schema: identifierSchema.default('public'),
});

export type GetTablesQuery = z.infer<typeof getTablesQuerySchema>;
export type PreviewQuery = z.infer<typeof previewQuerySchema>;
