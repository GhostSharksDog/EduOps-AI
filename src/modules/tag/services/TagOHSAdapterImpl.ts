import {Tag} from '@/modules/tag/domain/entities/Tag';
import {TagVersion} from '@/modules/tag/domain/entities/TagVersion';
import {paginationSchema} from '@/shared/schemas/common/paginationSchema';
import {TagCategory} from '@/modules/tag/domain/entities/TagCategory';
import {TagVO, TagVersionVO} from '@/modules/tag/contracts/schemas/response/tag/index';
import {TagCategoryVO} from '@/modules/tag/contracts/schemas/response/tag-category/index';
import {type CreateTagDTO, createTagSchema} from '@/modules/tag/contracts/schemas/request/tag/createTagSchema';
import {type UpdateTagDTO, updateTagSchema} from '@/modules/tag/contracts/schemas/request/tag/updateTagSchema';
import {ITagOHSAdapter} from '@/modules/tag/services/ITagOHSAdapter';
import {NextRequest} from 'next/server';
import type {JsonValue} from '@/shared/types/jsonValue';
import {getCurrentUserId} from '@/modules/identity/server';
import {getCurrentTenantId, createTenantFilter} from '@/platform/get-current-tenant';
import {updateTagStatusSchema} from '@/modules/tag/contracts/schemas/request/tag/updateTagStatusSchema';
import {createTagVersionSchema} from '@/modules/tag/contracts/schemas/request/tag/createTagVersionSchema';
import {setCurrentVersionSchema} from '@/modules/tag/contracts/schemas/request/tag/setCurrentVersionSchema';
import {TagStatus} from '@/shared/enums/tag/TagStatus';
import type {FeatureJsonValue} from '@/shared/schemas/common/featureSchema';
import {
    CountTagsQuery,
    ExportTagsQuery,
    GetTagQuery,
    GetTagsByCategoryQuery,
    GetTagsByStatusQuery,
    GetTagsByTypeQuery,
    ListTagsQuery,
    ListTagVersionsQuery,
    SearchTagsQuery
} from '@/modules/tag/contracts/queries/index';
import {
    CreateTagCommand,
    CreateTagVersionCommand,
    DeleteTagCommand,
    SetCurrentVersionCommand,
    UpdateTagCommand,
    UpdateTagStatusCommand
} from '@/modules/tag/contracts/commands/index';

export class TagOHSAdapterImpl implements ITagOHSAdapter {
    public fromTagToTagVO(tag: Tag): TagVO {
        // Handle tags without category gracefully (orphaned tags)
        const categoryVO = tag.category ? this.toCategoryVO(tag.category) : null;

        return {
            id: tag.id,
            name: tag.name,
            description: tag.description,
            category: categoryVO,
            dataType: tag.dataType,
            status: tag.status,
            updateCycle: tag.updateCycle,
            isPublic: tag.isPublic,
            ownedBy: tag.ownedBy,
            feature: (tag.feature ?? {}) as unknown as FeatureJsonValue,
            currentVersion: tag.currentVersion ? this.toTagVersionVO(tag.currentVersion, tag) : undefined,
            bitConfig: tag.bitConfig ? {
                bitmapTableId: tag.bitConfig.bitmapTableId,
                bitPosition: tag.bitConfig.bitPosition
            } : undefined,
            isDeleted: tag.isDeleted,
            targetTableId: tag.targetTableId ?? undefined,
            createTime: tag.createTime ? tag.createTime.toISOString() : new Date(0).toISOString(),
            updateTime: tag.updateTime?.toISOString() || undefined,
            deleteTime: tag.deleteTime?.toISOString() || undefined,
            createdBy: tag.createdBy,
            updatedBy: tag.updatedBy,
            deletedBy: tag.deletedBy
        };
    }

    public fromTagListToTagVOList(tags: Tag[]): TagVO[] {
        return tags.map(tag => this.fromTagToTagVO(tag));
    }

    public fromDTOToTagEntity(dto: CreateTagDTO): Partial<Tag> {
        return {
            name: dto.name,
            dataType: dto.dataType,
            categoryId: dto.categoryId,
            updateCycle: dto.updateCycle,
            isPublic: dto.isPublic,
            feature: dto.feature as JsonValue
        };
    }

    public fromDTOToUpdateTagEntity(tag: Tag, dto: UpdateTagDTO): Tag {
        if (dto.name !== undefined) {
            tag.name = dto.name;
        }
        if (dto.categoryId !== undefined) {
            tag.categoryId = dto.categoryId;
        }
        if (dto.feature !== undefined) {
            tag.feature = dto.feature as JsonValue;
        }

        tag.updateTime = new Date();

        return tag;
    }

    fromRequestToGetTagQuery(request: NextRequest, id?: string): GetTagQuery {
        const searchParams = request.nextUrl.searchParams;
        const tagId = searchParams.get('tagId') || id || this.extractIdFromPath(request);
        const tenantId = getCurrentTenantId(request);
        return {
            tagId: tagId,
            tenantFilter: createTenantFilter(tenantId)
        };
    }

    fromRequestToListTagsQuery(request: NextRequest): ListTagsQuery {
        const searchParams = request.nextUrl.searchParams;
        const tenantId = getCurrentTenantId(request);
        
        return {
            page: paginationSchema.parse({ page: parseInt(searchParams.get('page') || '1', 10), pageSize: parseInt(searchParams.get('pageSize') || '10', 10) }).page,
            pageSize: paginationSchema.parse({ page: parseInt(searchParams.get('page') || '1', 10), pageSize: parseInt(searchParams.get('pageSize') || '10', 10) }).pageSize,
            categoryId: searchParams.get('categoryId') || undefined,
            type: searchParams.get('type') as 'SIMPLE' | 'CALCULATED' | undefined,
            status: this.parseStatusParam(searchParams.get('status')),
            keyword: searchParams.get('keyword') || undefined,
            tenantFilter: createTenantFilter(tenantId)
        };
    }

    fromRequestToListTagVersionsQuery(request: NextRequest, id?: string): ListTagVersionsQuery {
        const searchParams = request.nextUrl.searchParams;
        const tagId = id || searchParams.get('tagId') || this.extractIdFromPath(request);
        return {
            tagId: tagId,
            page: paginationSchema.parse({ page: parseInt(searchParams.get('page') || '1', 10), pageSize: parseInt(searchParams.get('pageSize') || '10', 10) }).page,
            pageSize: parseInt(searchParams.get('pageSize') || '10', 10)
        };
    }

    fromRequestToSearchTagsQuery(request: NextRequest): SearchTagsQuery {
        const searchParams = request.nextUrl.searchParams;
        return {
            name: searchParams.get('name') || undefined,
            type: searchParams.get('type') as 'SIMPLE' | 'CALCULATED' | undefined,
            valueType: searchParams.get('valueType') || undefined,
            categoryId: searchParams.get('categoryId') || undefined,
            status: this.parseStatusParam(searchParams.get('status')),
            createdBy: searchParams.get('createdBy') || undefined,
            technicalOwner: searchParams.get('technicalOwner') || undefined,
            businessOwner: searchParams.get('businessOwner') || undefined,
            page: paginationSchema.parse({ page: parseInt(searchParams.get('page') || '1', 10), pageSize: parseInt(searchParams.get('pageSize') || '10', 10) }).page,
            pageSize: parseInt(searchParams.get('pageSize') || '10', 10)
        };
    }

    fromRequestToGetTagsByCategoryQuery(request: NextRequest): GetTagsByCategoryQuery {
        const searchParams = request.nextUrl.searchParams;
        return {
            categoryId: searchParams.get('categoryId') || '',
            page: paginationSchema.parse({ page: parseInt(searchParams.get('page') || '1', 10), pageSize: parseInt(searchParams.get('pageSize') || '10', 10) }).page,
            pageSize: parseInt(searchParams.get('pageSize') || '10', 10)
        };
    }

    fromRequestToGetTagsByTypeQuery(request: NextRequest): GetTagsByTypeQuery {
        const searchParams = request.nextUrl.searchParams;
        return {
            type: searchParams.get('type') as 'SIMPLE' | 'CALCULATED' || 'SIMPLE',
            page: paginationSchema.parse({ page: parseInt(searchParams.get('page') || '1', 10), pageSize: parseInt(searchParams.get('pageSize') || '10', 10) }).page,
            pageSize: parseInt(searchParams.get('pageSize') || '10', 10)
        };
    }

    fromRequestToGetTagsByStatusQuery(request: NextRequest): GetTagsByStatusQuery {
        const searchParams = request.nextUrl.searchParams;
        const statusValue = searchParams.get('status');
        if (!statusValue || !Object.values(TagStatus).includes(statusValue as TagStatus)) {
            throw new Error('状态参数无效或缺失');
        }
        return {
            status: statusValue as TagStatus,
            page: paginationSchema.parse({ page: parseInt(searchParams.get('page') || '1', 10), pageSize: parseInt(searchParams.get('pageSize') || '10', 10) }).page,
            pageSize: parseInt(searchParams.get('pageSize') || '10', 10)
        };
    }

    fromRequestToCountTagsQuery(request: NextRequest): CountTagsQuery {
        const searchParams = request.nextUrl.searchParams;
        return {
            type: searchParams.get('type') as 'SIMPLE' | 'CALCULATED' | undefined,
            valueType: searchParams.get('valueType') || undefined,
            categoryId: searchParams.get('categoryId') || undefined,
            status: this.parseStatusParam(searchParams.get('status')),
            name: searchParams.get('name') || undefined
        };
    }

    fromRequestToExportTagsQuery(request: NextRequest): ExportTagsQuery {
        const searchParams = request.nextUrl.searchParams;
        return {
            type: searchParams.get('type') as 'SIMPLE' | 'CALCULATED' | undefined,
            valueType: searchParams.get('valueType') || undefined,
            categoryId: searchParams.get('categoryId') || undefined,
            status: this.parseStatusParam(searchParams.get('status')),
            format: searchParams.get('format') || 'CSV'
        };
    }

    async fromRequestToCreateTagCommand(request: NextRequest): Promise<CreateTagCommand> {
        const userId = getCurrentUserId(request);
        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }

        const body = await request.json();
        const validatedBody = createTagSchema.parse(body);

 return {
            name: validatedBody.name,
            valueType: validatedBody.dataType,
            categoryId: validatedBody.categoryId,
            description: validatedBody.description,
            updateCycle: validatedBody.updateCycle,
            feature: validatedBody.feature,
            isPublic: validatedBody.isPublic,
            createdBy: userId,
            ownedBy: getCurrentTenantId(request),
            version: validatedBody.version,
            rule: validatedBody.rule,
            targetTableId: validatedBody.targetTableId,
            bitConfig: validatedBody.bitConfig ? {
                bitmapTableId: validatedBody.bitConfig.bitmapTableId,
                bitPosition: validatedBody.bitConfig.bitPosition,
            } : undefined,
            enumValues: validatedBody.enumValues,
        };
    }

    async fromRequestToUpdateTagCommand(request: NextRequest, id?: string): Promise<UpdateTagCommand> {
        const userId = getCurrentUserId(request);
        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }

        const body = await request.json();
        const validatedBody = updateTagSchema.parse(body);
        const tagId = id || this.extractIdFromPath(request);

        return {
            tagId: tagId,
            name: validatedBody.name,
            valueType: validatedBody.dataType,
            categoryId: validatedBody.categoryId,
            description: validatedBody.description,
            updateCycle: validatedBody.updateCycle,
            isPublic: validatedBody.isPublic,
            feature: validatedBody.feature,
            updatedBy: userId,
            ownedBy: getCurrentTenantId(request),
            bitConfig: validatedBody.bitConfig,
            rule: validatedBody.rule,
            targetTableId: validatedBody.targetTableId,
        };
    }

    async fromRequestToUpdateTagStatusCommand(request: NextRequest, id?: string): Promise<UpdateTagStatusCommand> {
        const userId = getCurrentUserId(request);
        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }

        const body = await request.json();
        const validatedBody = updateTagStatusSchema.parse(body);
        const tagId = id || this.extractIdFromPath(request);

        return {
            tagId: tagId,
            status: validatedBody.status,
            updatedBy: userId,
            ownedBy: getCurrentTenantId(request)
        };
    }

    async fromRequestToDeleteTagCommand(request: NextRequest, id?: string): Promise<DeleteTagCommand> {
        const userId = getCurrentUserId(request);
        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }

        const tagId = id || this.extractIdFromPath(request);

        return {
            tagId: tagId,
            deletedBy: userId,
            ownedBy: getCurrentTenantId(request)
        };
    }

    async fromRequestToCreateTagVersionCommand(request: NextRequest, id?: string): Promise<CreateTagVersionCommand> {
        const userId = getCurrentUserId(request);
        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }

        const body = await request.json();
        const validatedBody = createTagVersionSchema.parse(body);
        const tagId = id || this.extractIdFromPath(request);

        return {
            tagId: tagId,
            version: Number(validatedBody.version) || 1,
            description: validatedBody.description,
            rule: validatedBody.rule,
            createdBy: userId,
            ownedBy: getCurrentTenantId(request)
        };
    }

    async fromRequestToSetCurrentVersionCommand(request: NextRequest, id?: string): Promise<SetCurrentVersionCommand> {
        const userId = getCurrentUserId(request);
        if (!userId) {
            throw new Error('请求中未找到用户ID');
        }

        const body = await request.json();
        const validatedBody = setCurrentVersionSchema.parse(body);
        const tagId = id || this.extractIdFromPath(request);

        return {
            tagId: tagId,
            versionId: validatedBody.versionId,
            updatedBy: userId
        };
    }

    private extractIdFromPath(request: NextRequest): string {
        const url = request.nextUrl.pathname;
        const segments = url.split('/');
        const id = segments[segments.length - 1];
        return id || '';
    }

    private parseStatusParam(value: string | null): TagStatus | undefined {
        if (!value) {
            return undefined;
        }
        if (Object.values(TagStatus).includes(value as TagStatus)) {
            return value as TagStatus;
        }
        return undefined;
    }

    private toCategoryVO(category: TagCategory): TagCategoryVO {
        return {
            id: category.id,
            name: category.name || '',
            parent: null,
            path: category.path,
            description: category.description || '',
            orderIndex: category.orderIndex,
            tagCount: 0,
            feature: category.feature ?? {},
            isDeleted: category.isDeleted || false,
            createTime: category.createTime ? category.createTime.toISOString() : new Date(0).toISOString(),
            updateTime: category.updateTime?.toISOString() || undefined,
            deleteTime: category.deleteTime?.toISOString() || undefined,
            createdBy: category.createdBy,
            updatedBy: category.updatedBy,
            deletedBy: category.deletedBy,
            children: []
        };
    }

    private toTagVersionVO(version: TagVersion, tag: Tag): TagVersionVO {
        return {
            id: version.id,
            tag: {
                id: tag.id,
                name: tag.name,
                description: tag.description,
                category: null,
                dataType: tag.dataType,
                status: tag.status,
                updateCycle: tag.updateCycle,
                isPublic: tag.isPublic,
                ownedBy: tag.ownedBy,
                feature: (tag.feature ?? {}) as unknown as FeatureJsonValue,
                isDeleted: tag.isDeleted,
                createTime: tag.createTime ? tag.createTime.toISOString() : new Date(0).toISOString(),
                updateTime: tag.updateTime?.toISOString() || undefined,
                deleteTime: tag.deleteTime?.toISOString() || undefined,
                createdBy: tag.createdBy,
                updatedBy: tag.updatedBy,
                deletedBy: tag.deletedBy
            },
            version: String(version.version),
            description: version.description,
            rule: version.rule ? this.toTagRuleVO(version.rule, tag) : undefined,
            isCurrent: version.isCurrent,
            isDeleted: version.isDeleted,
            feature: (version.feature ?? {}) as unknown as FeatureJsonValue,
            createTime: version.createTime ? version.createTime.toISOString() : new Date(0).toISOString(),
            updateTime: version.updateTime?.toISOString() || undefined,
            deleteTime: version.deleteTime?.toISOString() || undefined,
            createdBy: version.createdBy,
            updatedBy: version.updatedBy,
            deletedBy: version.deletedBy,
            calculationRule: version.calculationRule,
            enumValues: version.enumValues
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private toTagRuleVO(rule: any, tag: Tag): any {
        return {
            id: rule.id || '00000000-0000-0000-0000-000000000000',
            tag: {
                id: tag.id,
                name: tag.name,
                description: tag.description,
                category: null,
                dataType: tag.dataType,
                status: tag.status,
                updateCycle: tag.updateCycle,
                isPublic: tag.isPublic,
                ownedBy: tag.ownedBy,
                feature: (tag.feature ?? {}) as unknown as FeatureJsonValue,
                isDeleted: tag.isDeleted,
                createTime: tag.createTime ? tag.createTime.toISOString() : new Date(0).toISOString(),
                updateTime: tag.updateTime?.toISOString() || undefined,
                deleteTime: tag.deleteTime?.toISOString() || undefined,
                createdBy: tag.createdBy,
                updatedBy: tag.updatedBy,
                deletedBy: tag.deletedBy
            },
            ruleType: rule.ruleType || '',
            ruleContent: rule.ruleContent || '',
            dataModelIds: rule.dataModelIds ?? [],
            feature: (rule.feature ?? {}) as unknown as FeatureJsonValue,
            isDeleted: rule.isDeleted ?? false,
            createTime: rule.createTime ? rule.createTime.toISOString() : new Date(0).toISOString(),
            updateTime: rule.updateTime?.toISOString() || undefined,
            deleteTime: rule.deleteTime?.toISOString() || undefined,
            createdBy: rule.createdBy,
            updatedBy: rule.updatedBy,
            deletedBy: rule.deletedBy
        };
    }
}
