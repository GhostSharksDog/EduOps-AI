import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { log } from '@/platform/logger';
import {authMiddleware, getCurrentUser} from '@/modules/identity/server';
import { handleAPIError } from '@/platform/api-error-handler';
import {adminApplicationService} from '@/modules/system/server';
import {createTenantFilter} from '@/platform/get-current-tenant';

const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    action: z.string().optional(),
    entity: z.string().optional(),
    actorId: z.string().optional(),
    startTime: z.string().datetime({ offset: true }).optional(),
    endTime: z.string().datetime({ offset: true }).optional(),
});

export async function GET(request: NextRequest) {
    const authError = await authMiddleware(request);
    if (authError) return authError;
    const user = getCurrentUser(request);
    if (!user) return NextResponse.json({error: '请先登录'}, {status: 401});

    try {
        const { searchParams } = request.nextUrl;
        const rawQuery = {
            page: searchParams.get('page') ?? 1,
            pageSize: searchParams.get('pageSize') ?? 20,
            action: searchParams.get('action') ?? undefined,
            entity: searchParams.get('entity') ?? undefined,
            actorId: searchParams.get('actorId') ?? undefined,
            startTime: searchParams.get('startTime') ?? undefined,
            endTime: searchParams.get('endTime') ?? undefined,
        };

        const validatedQuery = querySchema.parse(rawQuery);

        const result = await adminApplicationService.getAuditLogs({
            page: validatedQuery.page,
            pageSize: validatedQuery.pageSize,
            action: validatedQuery.action,
            entity: validatedQuery.entity,
            actorId: validatedQuery.actorId,
            startTime: validatedQuery.startTime ? new Date(validatedQuery.startTime) : undefined,
            endTime: validatedQuery.endTime ? new Date(validatedQuery.endTime) : undefined,
            tenantFilter: createTenantFilter(user.ownedBy),
        });

        return NextResponse.json(result);
    } catch (error) {
        log.error('GET /api/audit-logs - Error:', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: '参数验证失败',
                details: error.issues,
            }, { status: 400 });
        }
        return handleAPIError(error);
    }
}
