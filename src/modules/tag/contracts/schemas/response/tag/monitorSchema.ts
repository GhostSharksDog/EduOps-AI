import {z} from 'zod';

export const mvStatusSchema = z.enum(['healthy', 'warning', 'error']);
export type MvStatus = z.infer<typeof mvStatusSchema>;

export const mvStatusReportSchema = z.strictObject({
  tagId: z.string().describe('标签ID'),
  tagName: z.string().describe('标签名称'),
  mvName: z.string().describe('物化视图名称'),
  status: mvStatusSchema.describe('状态'),
  statusDescription: z.string().describe('状态描述'),
  lastRefreshTime: z.string().nullable().describe('最后刷新时间'),
  lastException: z.string().nullable().describe('最后异常信息'),
  isStale: z.boolean().describe('是否过期'),
});

export type MvStatusReportVO = z.infer<typeof mvStatusReportSchema>;

export const mvStatusReportListSchema = z.array(mvStatusReportSchema);

export const errorLogSchema = z.strictObject({
  id: z.string().describe('日志ID'),
  tagId: z.string().describe('标签ID'),
  tagName: z.string().describe('标签名称'),
  mvName: z.string().describe('物化视图名称'),
  errorMessage: z.string().describe('错误信息'),
  occurredAt: z.string().describe('发生时间'),
  isSevere: z.boolean().describe('是否严重'),
  isResolved: z.boolean().describe('是否已解决'),
});

export type ErrorLogVO = z.infer<typeof errorLogSchema>;

export const errorLogListSchema = z.array(errorLogSchema);
