import {z} from 'zod';

export const getMvStatusQuerySchema = z.strictObject({
  status: z.enum(['all', 'healthy', 'warning', 'error']).optional().default('all'),
  search: z.string().optional(),
  tagId: z.string().uuid().optional(),
});

export type GetMvStatusQueryDTO = z.infer<typeof getMvStatusQuerySchema>;

export const getErrorLogsQuerySchema = z.strictObject({
  unresolvedOnly: z.enum(['true', 'false']).optional().default('false'),
});

export type GetErrorLogsQueryDTO = z.infer<typeof getErrorLogsQuerySchema>;

export const resolveErrorParamsSchema = z.strictObject({
  id: z.string().uuid(),
});

export type ResolveErrorParamsDTO = z.infer<typeof resolveErrorParamsSchema>;