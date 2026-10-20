import {withCompanyRoute} from '@/modules/identity/server';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTenantId, createTenantFilter } from '@/platform/get-current-tenant';
import { handleAPIError } from '@/platform/api-error-handler';
import {tagApplicationService} from '@/modules/tag/server';
import { listPublicTagsQuerySchema } from '@/shared/schemas/request/public-api/index';
import { publicTagListResponseSchema } from '@/shared/schemas/response/public-api/index';
import { TagStatus } from '@/shared/enums/index';

async function GETHandler(request: NextRequest) {
    const tenantId = getCurrentTenantId(request);

    try {
        const queryParams = Object.fromEntries(request.nextUrl.searchParams);
        const query = listPublicTagsQuerySchema.parse(queryParams);
        const tenantFilter = createTenantFilter(tenantId);

        const result = await tagApplicationService.listTags({
            page: query.page,
            pageSize: query.pageSize,
            status: query.status as TagStatus | undefined,
            categoryId: query.categoryId,
            tenantFilter,
            ownedBy: tenantId,
            isPublic: true,
        });

        const response = publicTagListResponseSchema.parse({
            ...result,
            items: result.items.map(tag => ({
                id: tag.id, name: tag.name, description: tag.description ?? null,
                dataType: tag.dataType, status: tag.status, updateCycle: tag.updateCycle,
                category: tag.category ? {id: tag.category.id, name: tag.category.name} : null,
                currentVersion: tag.currentVersion ? {
                    id: tag.currentVersion.id, version: tag.currentVersion.version,
                    createdAt: tag.currentVersion.createTime,
                } : null,
                createdAt: tag.createTime, updatedAt: tag.updateTime ?? tag.createTime,
            })),
        });
        return NextResponse.json(response);
    } catch (error) {
        return handleAPIError(error);
    }
}

export const GET=withCompanyRoute(GETHandler);
