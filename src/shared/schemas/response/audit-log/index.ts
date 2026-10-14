import {z} from 'zod';

export const auditLogSchema = z.strictObject({
    id: z.string(),
    action: z.string(),
    entity: z.string(),
    entityId: z.string().nullable(),
    actorId: z.string(),
    actorUsername: z.string(),
    actorRealName: z.string().nullable(),
    actorEmail: z.string().nullable(),
    actorRole: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    createdAt: z.coerce.date(),
});

export type AuditLogVO = z.infer<typeof auditLogSchema>;

export const auditLogListSchema = z.strictObject({
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    totalPages: z.number(),
    items: z.array(auditLogSchema),
});

export type AuditLogListVO = z.infer<typeof auditLogListSchema>;
