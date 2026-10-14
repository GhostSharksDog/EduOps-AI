import { z } from 'zod';

export const ApiErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  status: z.number().int().min(100).max(599),
  requestId: z.string().optional(),
  details: z.record(z.any(), z.any()).optional(),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

export const ZodErrorDetailsSchema = z.object({
  issues: z.array(
    z.object({
      field: z.string(),
      message: z.string(),
      code: z.string().optional(),
      expected: z.any().optional(),
      received: z.any().optional(),
    })
  ),
});

export type ZodErrorDetails = z.infer<typeof ZodErrorDetailsSchema>;

export function createApiErrorResponse(
  code: string,
  message: string,
  status: number,
  requestId?: string,
  details?: Record<string, unknown>
): ApiErrorResponse {
  const response: ApiErrorResponse = { code, message, status };
  if (requestId) response.requestId = requestId;
  if (details && Object.keys(details).length > 0) response.details = details;
  return response;
}
