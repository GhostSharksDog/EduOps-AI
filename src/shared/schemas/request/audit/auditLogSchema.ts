import { z } from 'zod';

export const AuditActionSchema = z.enum([
    'CREATE',
    'UPDATE',
    'DELETE',
    'ACTIVATE',
    'DEACTIVATE',
    'RESTORE',
    'BATCH_DELETE',
    'BATCH_RESTORE',
    'REORDER',
    'MOVE',
    'SET_VERSION',
    'TEST_CONNECTION',
    'LOGIN',
    'LOGOUT',
]);

export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditEntitySchema = z.enum([
    'Tag',
    'TagCategory',
    'TagVersion',
    'Segment',
    'SegmentCondition',
    'DataSource',
    'DataModel',
    'RecycleBin',
    'Enum',
    'EnumValue',
    'BitmapTable',
    'TargetTable',
    'Session',
]);

export type AuditEntity = z.infer<typeof AuditEntitySchema>;

export const ActorSnapshotSchema = z.strictObject({
    id: z.string().uuid(),
    username: z.string(),
    realName: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    role: z.string().optional().nullable(),
});

export type ActorSnapshot = z.infer<typeof ActorSnapshotSchema>;

export const CreateAuditLogSchema = z.strictObject({
    action: AuditActionSchema,
    entity: AuditEntitySchema,
    entityId: z.string().uuid().optional().nullable(),
    actor: ActorSnapshotSchema,
    metadata: z.record(z.string(), z.unknown()).optional().nullable(),
    ownedBy: z.string().optional().nullable(),
});

export type CreateAuditLogRequest = z.infer<typeof CreateAuditLogSchema>;
