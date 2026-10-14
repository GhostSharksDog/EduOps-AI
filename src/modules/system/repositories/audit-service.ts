import { execute, transaction, type DbClient } from '@/platform/database';
import { config } from '@/platform/config/index';
import { log } from '@/platform/logger';
import type { CreateAuditLogRequest, AuditAction, AuditEntity } from '@/shared/schemas/request/audit/index';

class AuditService {
    private async insert(request: CreateAuditLogRequest, client?: DbClient): Promise<void> {
        await execute(`INSERT INTO audit_logs(action,entity,entity_id,actor_id,actor_username,actor_real_name,actor_email,actor_role,owned_by,metadata)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`, [request.action, request.entity, request.entityId ?? null,
            request.actor.id, request.actor.username, request.actor.realName ?? null, request.actor.email ?? null,
            request.actor.role ?? null, request.ownedBy ?? config.system.userId, request.metadata == null ? null : JSON.stringify(request.metadata)], client);
    }
    async log(request: CreateAuditLogRequest): Promise<boolean> {
        try {
            await this.insert(request);
            return true;
        } catch (error) {
            log.error('写入审计记录失败');
            return false;
        }
    }

    async logBatch(requests: CreateAuditLogRequest[]): Promise<boolean> {
        try {
            await transaction(async client => { for (const request of requests) await this.insert(request, client); });
            return true;
        } catch (error) {
            log.error('批量写入审计记录失败');
            return false;
        }
    }

    inferEntity(pathname: string): AuditEntity | null {
        if (pathname.includes('/tags/')) return 'Tag';
        if (pathname.includes('/tag-categories/')) return 'TagCategory';
        if (pathname.includes('/segments/')) return 'Segment';
        if (pathname.includes('/data-sources/')) return 'DataSource';
        if (pathname.includes('/data-models/')) return 'DataModel';
        if (pathname.includes('/recycle-bin/')) return 'RecycleBin';
        if (pathname.includes('/auth/')) return 'Session';
        return null;
    }

    inferAction(method: string): AuditAction | null {
        switch (method.toUpperCase()) {
            case 'POST':
                return 'CREATE';
            case 'PUT':
            case 'PATCH':
                return 'UPDATE';
            case 'DELETE':
                return 'DELETE';
            default:
                return null;
        }
    }
}

export const auditService = new AuditService();
