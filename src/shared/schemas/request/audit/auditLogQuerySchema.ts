import {z} from 'zod';

export const AuditLogQuerySchema = z.strictObject({
    page: z.number().int().min(1).describe('当前页码'),
    pageSize: z.number().int().min(1).describe('每页记录数'),
    action: z.string().optional().describe('操作类型'),
    entity: z.string().optional().describe('实体类型'),
    actorId: z.string().optional().describe('操作者ID'),
    startTime: z.string().optional().describe('开始时间'),
    endTime: z.string().optional().describe('结束时间'),
});

export type AuditLogQueryDTO = z.infer<typeof AuditLogQuerySchema>;
