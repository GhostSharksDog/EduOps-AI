import { NextRequest } from 'next/server';
import { auditService } from '@/modules/system/repositories/audit-service';
import {getCurrentUser} from '@/modules/identity/server';
import type { AuditAction, AuditEntity, ActorSnapshot } from '@/shared/schemas/request/audit/index';
import type {LocalUser} from '@/modules/identity/contracts';
import { getCurrentTenantId } from '@/platform/get-current-tenant';

interface AuditConfig {
    action?: AuditAction;
    entity?: AuditEntity;
    entityId?: string;
    metadata?: Record<string, unknown>;
    actor?: ActorSnapshot;
}

const PATH_ENTITY_OVERRIDES: Record<string, AuditEntity> = {
    '/api/tags': 'Tag',
    '/api/tag-categories': 'TagCategory',
    '/api/segments': 'Segment',
    '/api/data-sources': 'DataSource',
    '/api/data-models': 'DataModel',
    '/api/recycle-bin': 'RecycleBin',
    '/api/admin/bitmap-tables': 'BitmapTable',
    '/api/tags/target-tables': 'TargetTable',
    '/api/auth': 'Session',
};

function extractEntityIdFromPath(pathname: string): string | undefined {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length >= 3) {
        const potentialId = segments[2];
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(potentialId)) {
            return potentialId;
        }
    }
    return undefined;
}

function inferActionFromPath(pathname: string, method: string): AuditAction | null {
    if (pathname.includes('/activate')) return 'ACTIVATE';
    if (pathname.includes('/deactivate')) return 'DEACTIVATE';
    if (pathname.includes('/restore')) return 'RESTORE';
    if (pathname.includes('/batch-restore')) return 'BATCH_RESTORE';
    if (pathname.includes('/batch') && method === 'DELETE') return 'BATCH_DELETE';
    if (pathname.includes('/reorder')) return 'REORDER';
    if (pathname.includes('/move')) return 'MOVE';
    if (pathname.includes('/test-connection')) return 'TEST_CONNECTION';
    if (pathname.includes('/enable')) return 'ACTIVATE';
    if (pathname.includes('/disable')) return 'DEACTIVATE';
    if (pathname.includes('/versions')) return 'SET_VERSION';
    if (pathname.includes('/resolve')) return 'UPDATE';
    if (pathname.includes('/auth/login') && method === 'POST') return 'LOGIN';
    if (pathname.includes('/auth/logout') && method === 'POST') return 'LOGOUT';

    return auditService.inferAction(method);
}

function inferEntityFromPath(pathname: string): AuditEntity | null {
    const sortedPaths = Object.keys(PATH_ENTITY_OVERRIDES).sort((a, b) => b.length - a.length);
    for (const path of sortedPaths) {
        if (pathname.startsWith(path)) {
            return PATH_ENTITY_OVERRIDES[path];
        }
    }
    return auditService.inferEntity(pathname);
}

export async function withAudit(
    request: NextRequest,
    config?: AuditConfig
): Promise<void> {
    let actor = config?.actor;
    
    if (!actor) {
        const user = getCurrentUser(request);
        if (!user) {
            return;
        }
        actor = {
            id: user.id,
            username: user.username,
            realName: user.realName,
            email: user.email,
            role: user.role,
        };
    }

    const pathname = request.nextUrl.pathname;
    const method = request.method;

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return;
    }

    const action = config?.action ?? inferActionFromPath(pathname, method);
    const entity = config?.entity ?? inferEntityFromPath(pathname);
    const entityId = config?.entityId ?? extractEntityIdFromPath(pathname);

    if (!action || !entity) {
        return;
    }

    await auditService.log({
        action,
        entity,
        entityId: entityId ?? null,
        actor,
        metadata: config?.metadata ?? null,
        ownedBy: getCurrentTenantId(request),
    });
}

export function createActorFromUser(user: LocalUser): ActorSnapshot {
    return {
        id: user.id,
        username: user.username,
        realName: user.realName,
        email: user.email,
        role: user.role,
    };
}

export function withAuditWrapper<T>(
    handler: (request: NextRequest, context: T) => Promise<Response>,
    config?: Omit<AuditConfig, 'entityId' | 'metadata'> & {
        extractEntityId?: (response: Response) => string | undefined;
        extractMetadata?: (request: NextRequest, response: Response) => Record<string, unknown> | undefined;
    }
): (request: NextRequest, context: T) => Promise<Response> {
    return async (request: NextRequest, context: T) => {
        const response = await handler(request, context);
        
        if (response.ok) {
            const entityId = config?.extractEntityId?.(response);
            const metadata = config?.extractMetadata?.(request, response);
            
            await withAudit(request, {
                ...config,
                entityId,
                metadata,
            });
        }
        
        return response;
    };
}
