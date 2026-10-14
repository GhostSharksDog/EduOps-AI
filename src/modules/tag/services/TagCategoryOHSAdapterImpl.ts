import {TagCategory} from '@/modules/tag/domain/entities/TagCategory';
import {paginationSchema} from '@/shared/schemas/common/paginationSchema';
import {TagCategoryVO} from '@/modules/tag/contracts/schemas/response/tag-category/index';
import {
    batchDeleteTagCategoriesSchema,
    CreateTagCategoryDTO,
    createTagCategorySchema,
    moveTagCategorySchema,
    reorderTagCategoriesSchema,
    updateTagCategorySchema
} from '@/modules/tag/contracts/schemas/request/tag-category/index';
import {ITagCategoryOHSAdapter} from '@/modules/tag/services/request-mappers';
import {GetTagCategoryQuery, ListTagCategoriesQuery} from '@/modules/tag/contracts/queries/index';
import {
    BatchDeleteTagCategoriesCommand,
    CreateTagCategoryCommand,
    DeleteTagCategoryCommand,
    MoveTagCategoryCommand,
    ReorderTagCategoriesCommand,
    UpdateTagCategoryCommand
} from '@/modules/tag/contracts/commands/index';
import {getCurrentUserId} from '@/modules/identity/server';
import {getCurrentTenantId, createTenantFilter} from '@/platform/get-current-tenant';
import {NextRequest} from 'next/server';
import type {JsonValue} from '@/shared/types/jsonValue';

/**
 * 标签分类OHS适配器实现
 */
export class TagCategoryOHSAdapterImpl implements ITagCategoryOHSAdapter {
    /**
     * 将HTTP请求转换为查询对象
     * @param request HTTP请求对象
     * @returns ListTagCategoriesQuery
     */
    public fromRequestToListCategoriesQuery(request: NextRequest): ListTagCategoriesQuery {
        const searchParams = request.nextUrl.searchParams;
        const parentIdParam = searchParams.get('parentId');
        const tenantId = getCurrentTenantId(request);

        return {
            parentId: parentIdParam === 'null' || parentIdParam === null ? undefined : parentIdParam,
            page: paginationSchema.parse({ page: parseInt(searchParams.get('page') || '1', 10), pageSize: parseInt(searchParams.get('pageSize') || '10', 10) }).page,
            pageSize: paginationSchema.parse({ page: parseInt(searchParams.get('page') || '1', 10), pageSize: parseInt(searchParams.get('pageSize') || '10', 10) }).pageSize,
            keyword: searchParams.get('keyword') || undefined,
            tenantFilter: createTenantFilter(tenantId)
        };
    }

    /**
     * 将HTTP请求转换为获取单个分类查询对象
     * @param request HTTP请求对象
     * @returns GetTagCategoryQuery
     */
    public fromRequestToGetCategoryQuery(request: NextRequest, id?: string): GetTagCategoryQuery {
        const searchParams = request.nextUrl.searchParams;
        const tenantId = getCurrentTenantId(request);

        return {
            categoryId: searchParams.get('categoryId') || id || '',
            tenantFilter: createTenantFilter(tenantId)
        };
    }

    /**
     * 将HTTP请求转换为创建分类命令
     * @param request HTTP请求对象
     * @returns Promise<CreateTagCategoryCommand>
     */
    public async fromRequestToCreateCategoryCommand(request: NextRequest): Promise<CreateTagCategoryCommand> {
        const body = await request.json();
        const userId = getCurrentUserId(request);

        if (!userId) {
            throw new Error('User ID not found in request');
        }

        const validatedBody = createTagCategorySchema.parse(body);

        return {
            name: validatedBody.name,
            parentId: validatedBody.parentId || undefined,
            description: validatedBody.description || '',
            orderIndex: validatedBody.orderIndex || 0,
            feature: validatedBody.feature,
            createdBy: userId,
            ownedBy: getCurrentTenantId(request)
        };
    }

    /**
     * 将HTTP请求转换为更新分类命令对象
     * @param request HTTP请求对象
     * @param id 分类ID
     * @returns Promise<UpdateTagCategoryCommand>
     */
    public async fromRequestToUpdateCategoryCommand(request: NextRequest, id: string): Promise<UpdateTagCategoryCommand> {
        const body = await request.json();
        const userId = getCurrentUserId(request);

        if (!userId) {
            throw new Error('User ID not found in request');
        }

        const validatedBody = updateTagCategorySchema.parse({...body, id: id});

        return {
            categoryId: id,
            name: validatedBody.name,
            parentId: validatedBody.parentId || undefined,
            description: validatedBody.description || '',
            orderIndex: validatedBody.orderIndex,
            feature: validatedBody.feature,
            updatedBy: userId,
            ownedBy: getCurrentTenantId(request)
        };
    }

    /**
     * 将HTTP请求转换为删除分类命令对象
     * @param request HTTP请求对象
     * @param id 分类ID
     * @returns DeleteTagCategoryCommand
     */
    public fromRequestToDeleteCategoryCommand(request: NextRequest, id: string): DeleteTagCategoryCommand {
        const userId = getCurrentUserId(request);

        if (!userId) {
            throw new Error('User ID not found in request');
        }

        return {
            categoryId: id,
            deletedBy: userId,
            ownedBy: getCurrentTenantId(request)
        };
    }

    /**
     * 将HTTP请求转换为移动分类命令对象
     * @param request HTTP请求对象
     * @returns Promise<MoveTagCategoryCommand>
     */
    public async fromRequestToMoveCategoryCommand(request: NextRequest): Promise<MoveTagCategoryCommand> {
        const body = await request.json();
        const userId = getCurrentUserId(request);

        if (!userId) {
            throw new Error('User ID not found in request');
        }

        const validatedBody = moveTagCategorySchema.parse(body);

        return {
            categoryId: validatedBody.categoryId,
            newParentId: validatedBody.newParentId,
            updatedBy: userId,
            ownedBy: getCurrentTenantId(request)
        };
    }

    /**
     * 将HTTP请求转换为重新排序分类命令对象
     * @param request HTTP请求对象
     * @returns Promise<ReorderTagCategoriesCommand>
     */
    public async fromRequestToReorderCategoriesCommand(request: NextRequest): Promise<ReorderTagCategoriesCommand> {
        const body = await request.json();
        const userId = getCurrentUserId(request);

        if (!userId) {
            throw new Error('User ID not found in request');
        }

        const validatedBody = reorderTagCategoriesSchema.parse(body);

        return {
            categoryIds: validatedBody.categoryIds,
            orderIndex: validatedBody.orderIndex,
            updatedBy: userId,
            ownedBy: getCurrentTenantId(request)
        };
    }

    /**
     * 将HTTP请求转换为批量删除分类命令对象
     * @param request HTTP请求对象
     * @returns Promise<BatchDeleteTagCategoriesCommand>
     */
    public async fromRequestToBatchDeleteCommand(request: NextRequest): Promise<BatchDeleteTagCategoriesCommand> {
        const body = await request.json();
        const userId = getCurrentUserId(request);

        if (!userId) {
            throw new Error('User ID not found in request');
        }

        const validatedBody = batchDeleteTagCategoriesSchema.parse(body);

        return {
            ids: validatedBody.ids,
            deletedBy: userId,
            ownedBy: getCurrentTenantId(request)
        };
    }

    /**
     * 将TagCategory实体转换为TagCategoryVO（带完整父分类引用）
     * @param category TagCategory实体
     * @param tagCount 关联的标签数量
     * @param parentCategory 父分类实体（可选，用于构建完整的嵌套结构）
     * @returns TagCategoryVO
     */
    public fromEntityToTagCategoryVO(category: TagCategory, tagCount: number = 0, parentCategory?: TagCategory | null): TagCategoryVO {
        const parentVO = parentCategory ? {
            id: parentCategory.id,
            name: parentCategory.name || '',
            parent: null,
            path: parentCategory.path,
            description: parentCategory.description || '',
            orderIndex: parentCategory.orderIndex,
            tagCount: 0,
            feature: parentCategory.feature ?? {},
            isDeleted: parentCategory.isDeleted,
            createTime: parentCategory.createTime ? parentCategory.createTime.toISOString() : new Date(0).toISOString(),
            updateTime: parentCategory.updateTime?.toISOString() || undefined,
            deleteTime: parentCategory.deleteTime?.toISOString() || undefined,
            createdBy: parentCategory.createdBy,
            updatedBy: parentCategory.updatedBy,
            deletedBy: parentCategory.deletedBy,
            children: []
        } : null;

        return {
            id: category.id,
            name: category.name || '',
            parent: parentVO,
            path: category.path,
            description: category.description || '',
            orderIndex: category.orderIndex,
            tagCount: tagCount,
            childrenCount: 0,
            feature: category.feature ?? {},
            isDeleted: category.isDeleted,
            createTime: category.createTime ? category.createTime.toISOString() : new Date(0).toISOString(),
            updateTime: category.updateTime?.toISOString() || undefined,
            deleteTime: category.deleteTime?.toISOString() || undefined,
            createdBy: category.createdBy,
            updatedBy: category.updatedBy,
            deletedBy: category.deletedBy,
            children: []
        };
    }

    /**
     * 将TagCategory实体列表转换为TagCategoryVO树形结构
     * @param categories TagCategory实体列表
     * @param tagCounts 标签数量映射 Map<CategoryId, count>
     * @returns TagCategoryVO[] 树形结构
     */
    public fromEntityListToTagCategoryVOTree(categories: TagCategory[], tagCounts?: Map<string, number>): TagCategoryVO[] {
        const nodeMap = new Map<string, TagCategoryVO>();
        const categoryMap = new Map<string, TagCategory>();
        const roots: TagCategoryVO[] = [];
        const parentSimpleMap = new Map<string, TagCategoryVO | null>();

        categories.forEach(cat => {
            categoryMap.set(cat.id, cat);
        });

        categories.forEach(cat => {
            const parentVO = cat.parentId ? this.buildParentSimpleVO(cat.parentId, categoryMap) : null;
            parentSimpleMap.set(cat.id, parentVO);
        });

        categories.forEach(cat => {
            const count = tagCounts ? (tagCounts.get(cat.id) || 0) : 0;
            nodeMap.set(cat.id, {
                id: cat.id,
                name: cat.name || '',
                parent: parentSimpleMap.get(cat.id) || null,
                path: cat.path,
                description: cat.description || '',
                orderIndex: cat.orderIndex,
                tagCount: count,
                feature: cat.feature ?? {},
                isDeleted: cat.isDeleted,
                createTime: cat.createTime ? cat.createTime.toISOString() : new Date(0).toISOString(),
                updateTime: cat.updateTime?.toISOString() || undefined,
                deleteTime: cat.deleteTime?.toISOString() || undefined,
                createdBy: cat.createdBy,
                updatedBy: cat.updatedBy,
                deletedBy: cat.deletedBy,
                children: []
            });
        });

        categories.forEach(cat => {
            const node = nodeMap.get(cat.id);
            if (!node) return;

            if (cat.parentId && nodeMap.has(cat.parentId)) {
                const parent = nodeMap.get(cat.parentId);
                if (parent) {
                    if (!parent.children) {
                        parent.children = [];
                    }
                    parent.children.push(node);
                }
            } else {
                roots.push(node);
            }
        });

        const sortNodes = (nodes: TagCategoryVO[]) => {
            nodes.sort((a, b) => a.orderIndex - b.orderIndex);
            nodes.forEach(node => {
                if (node.children && node.children.length > 0) {
                    sortNodes(node.children);
                }
            });
        };

        const setChildrenCount = (nodes: TagCategoryVO[]) => {
            nodes.forEach(node => {
                node.childrenCount = node.children?.length || 0;
                if (node.children && node.children.length > 0) {
                    setChildrenCount(node.children);
                }
            });
        };

        sortNodes(roots);
        setChildrenCount(roots);
        return roots;
    }

    private buildParentSimpleVO(parentId: string, categoryMap: Map<string, TagCategory>): TagCategoryVO | null {
        const parent = categoryMap.get(parentId);
        if (!parent) return null;

        const grandparentVO = parent.parentId ? this.buildParentSimpleVO(parent.parentId, categoryMap) : null;

        return {
            id: parent.id,
            name: parent.name || '',
            parent: grandparentVO,
            path: parent.path,
            description: parent.description || '',
            orderIndex: parent.orderIndex,
            tagCount: 0,
            childrenCount: 0,
            feature: parent.feature ?? {},
            isDeleted: parent.isDeleted,
            createTime: parent.createTime ? parent.createTime.toISOString() : new Date(0).toISOString(),
            updateTime: parent.updateTime?.toISOString() || undefined,
            deleteTime: parent.deleteTime?.toISOString() || undefined,
            createdBy: parent.createdBy,
            updatedBy: parent.updatedBy,
            deletedBy: parent.deletedBy,
            children: []
        };
    }

    /**
     * 将CreateTagCategoryDTO转换为TagCategory实体数据
     * @param dto 创建分类DTO
     * @returns Partial<TagCategory> TagCategory实体数据
     */
    public fromDTOToTagCategoryEntity(dto: CreateTagCategoryDTO): Partial<TagCategory> {
        return {
            name: dto.name,
            parentId: dto.parentId || undefined,
            description: dto.description,
            orderIndex: dto.orderIndex,
            feature: dto.feature as JsonValue
        };
    }
}
