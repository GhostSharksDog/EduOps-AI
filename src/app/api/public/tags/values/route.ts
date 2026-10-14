import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTenantId } from '@/platform/get-current-tenant';
import { handleAPIError, ValidationError } from '@/platform/api-error-handler';
import {tagApplicationService} from '@/modules/tag/server';
import {getTagValueQueryApplicationService} from '@/modules/tag/server';
import {GetTagValuesCommand} from '@/modules/tag/server';
import { publicTagValuesResponseSchema } from '@/shared/schemas/response/public-api/index';
import { isValidUUID } from '@/shared/utils/typeGuards';
import { z } from 'zod';

const querySchema = z.strictObject({
    tagId: z.string().uuid().optional(),
    tagName: z.string().min(1).optional(),
    entityIds: z.string().min(1, 'entityIds is required'),
    versionId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
    const tenantId = getCurrentTenantId(request);
    if (!request.headers.has('x-tenant-id') || !isValidUUID(tenantId)) {
        return NextResponse.json({error: '缺少或无效的 x-tenant-id 请求头'}, {status: 400});
    }

    try {
        const queryParams = Object.fromEntries(request.nextUrl.searchParams);
        const query = querySchema.parse(queryParams);

        if (!query.tagId && !query.tagName) {
            throw new ValidationError('tagId or tagName is required');
        }

        const entityIds = query.entityIds.split(',').filter(Boolean);
        if (entityIds.length === 0) {
            throw new ValidationError('entityIds cannot be empty');
        }
        if (entityIds.length > 1000) {
            throw new ValidationError('entityIds exceeds maximum of 1000');
        }
        const invalidIds = entityIds.filter(id => !isValidUUID(id));
        if (invalidIds.length > 0) {
            throw new ValidationError(
                `Invalid entityId format: ${invalidIds.slice(0, 3).join(', ')}${invalidIds.length > 3 ? '...' : ''}`
            );
        }

        let tagId: string;
        let tagName: string;
        let tagIsPublic: boolean;
        let currentVersionNumber: string | null = null;

        if (query.tagId) {
            tagId = query.tagId;
            try {
                const tag = await tagApplicationService.getTag({
                    tagId,
                    tenantFilter: { tenantId },
                });
                if(tag.ownedBy !== tenantId) return NextResponse.json({error:'标签不存在'},{status:404});
                tagName = tag.name;
                tagIsPublic = tag.isPublic;
                currentVersionNumber = tag.currentVersion?.version ?? null;
            } catch {
                return NextResponse.json({ error: '标签不存在' }, { status: 404 });
            }
        } else {
            const tag = await tagApplicationService.getTagByName(query.tagName!, tenantId);
            if (!tag) {
                return NextResponse.json(
                    { error: `标签名称 '${query.tagName}' 不存在` },
                    { status: 404 }
                );
            }
            if(tag.ownedBy !== tenantId) return NextResponse.json({error:'标签不存在'},{status:404});
            tagId = tag.id;
            tagName = tag.name;
            tagIsPublic = tag.isPublic;
            currentVersionNumber = tag.currentVersion?.version ?? null;
        }

        if (!tagIsPublic) {
            return NextResponse.json({ error: '该标签未公开' }, { status: 403 });
        }

        const service = getTagValueQueryApplicationService();
        const result = await service.getTagValues(
            new GetTagValuesCommand(tagId, entityIds, query.versionId)
        );

        const response = publicTagValuesResponseSchema.parse({
            tagId,
            tagName,
            version: currentVersionNumber,
            data: result,
        });

        return NextResponse.json(response);
    } catch (error) {
        return handleAPIError(error);
    }
}
