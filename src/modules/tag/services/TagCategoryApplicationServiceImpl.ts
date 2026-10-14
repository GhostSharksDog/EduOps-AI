import {TagCategoryApplicationService} from '@/modules/tag/services/TagCategoryApplicationService';
import {
    BatchDeleteTagCategoriesCommand,
    BatchDeleteResult,
    BatchDeleteFailedItem,
    CreateTagCategoryCommand,
    DeleteTagCategoryCommand,
    MoveTagCategoryCommand,
    ReorderTagCategoriesCommand,
    UpdateTagCategoryCommand
} from '@/modules/tag/contracts/commands/index';
import {GetTagCategoryQuery, ListTagCategoriesQuery} from '@/modules/tag/contracts/queries/index';
import {TagCategoryListVO, TagCategoryVO} from '@/modules/tag/contracts/schemas/response/tag-category/index';
import {TagCategoryDomainService} from '@/modules/tag/domain/services/ports/TagCategoryDomainService';
import {TagQueryDomainService} from '@/modules/tag/domain/services/ports/TagQueryDomainService';
import {ITagCategoryOHSAdapter} from '@/modules/tag/services/ITagCategoryOHSAdapter';
import {type PaginationQueryDTO} from '@/shared/schemas/common/index';
import {SortOrder} from '@/shared/enums/index';
import {ValidationError} from '@/platform/api-error-handler';
import {createTenantFilter} from '@/platform/get-current-tenant';

export class TagCategoryApplicationServiceImpl implements TagCategoryApplicationService {
    constructor(
        private readonly tagCategoryDomainService: TagCategoryDomainService,
        private readonly tagQueryDomainService: TagQueryDomainService,
        private readonly tagCategoryOHSAdapter: ITagCategoryOHSAdapter
    ) {
    }

    async createCategory(command: CreateTagCategoryCommand): Promise<TagCategoryVO> {
        const category = await this.tagCategoryDomainService.createCategory(command);
        return this.tagCategoryOHSAdapter.fromEntityToTagCategoryVO(category);
    }

    async getCategory(query: GetTagCategoryQuery): Promise<TagCategoryVO> {
        const category = await this.tagCategoryDomainService.getCategory(query.categoryId, query.tenantFilter);
        const count = await this.tagQueryDomainService.countTagsByCriteria({
            categoryId: category.id,
            ...(query.tenantFilter ? {tenantFilter: query.tenantFilter} : {}),
        });
        return this.tagCategoryOHSAdapter.fromEntityToTagCategoryVO(category, count);
    }

    async updateCategory(command: UpdateTagCategoryCommand): Promise<TagCategoryVO> {
        const category = await this.tagCategoryDomainService.updateCategory(command.categoryId, command, createTenantFilter(command.ownedBy));
        return this.tagCategoryOHSAdapter.fromEntityToTagCategoryVO(category);
    }

    async deleteCategory(command: DeleteTagCategoryCommand): Promise<void> {
        const canDelete = await this.tagCategoryDomainService.canDeleteCategory(command.categoryId, createTenantFilter(command.ownedBy));
        if (!canDelete) {
            throw new ValidationError('无法删除该分类：分类下存在子分类或标签');
        }
        await this.tagCategoryDomainService.deleteCategory(command, createTenantFilter(command.ownedBy));
    }

    async listCategories(query: ListTagCategoriesQuery): Promise<TagCategoryListVO> {
        const page = query.page || 1;
        const pageSize = query.pageSize || 10;
        const keyword = query.keyword;

        if (!query.parentId) {
            const pagination: PaginationQueryDTO = {
                page: page,
                pageSize: pageSize,
                keyword: keyword,
                sortOrder: SortOrder.ASC
            };
            
            const allCategories = await this.tagCategoryDomainService.listCategories(undefined, pagination, query.tenantFilter);
            const totalCount = await this.tagCategoryDomainService.countCategories(undefined, keyword, query.tenantFilter);
            
            const categoryIds = allCategories.map(c => c.id);
            const tagCounts = await this.tagQueryDomainService.countTagsByCategoryIds(categoryIds, query.tenantFilter);

            const treeItems = this.tagCategoryOHSAdapter.fromEntityListToTagCategoryVOTree(allCategories, tagCounts);

            return {
                items: treeItems,
                totalCount: totalCount,
                page: page,
                pageSize: pageSize,
                totalPages: Math.ceil(totalCount / pageSize)
            };
        }

        const pagination: PaginationQueryDTO = {
            page: page,
            pageSize: pageSize,
            keyword: keyword,
            sortOrder: SortOrder.ASC
        };
        const categories = await this.tagCategoryDomainService.listCategories(query.parentId, pagination, query.tenantFilter);
        const totalCount = await this.tagCategoryDomainService.countCategories(query.parentId, keyword, query.tenantFilter);

        const categoryIds = categories.map(c => c.id);
        const tagCounts = await this.tagQueryDomainService.countTagsByCategoryIds(categoryIds, query.tenantFilter);

        const items = categories.map((c) => {
            const count = tagCounts.get(c.id) || 0;
            return this.tagCategoryOHSAdapter.fromEntityToTagCategoryVO(c, count);
        });

        return {
            items: items,
            totalCount: totalCount,
            page: page,
            pageSize: pageSize,
            totalPages: Math.ceil(totalCount / pageSize)
        };
    }

    async moveCategory(command: MoveTagCategoryCommand): Promise<TagCategoryVO> {
        const category = await this.tagCategoryDomainService.moveCategory(command.categoryId, command.newParentId, createTenantFilter(command.ownedBy));
        return this.tagCategoryOHSAdapter.fromEntityToTagCategoryVO(category);
    }

    async reorderCategories(command: ReorderTagCategoriesCommand): Promise<void> {
        await this.tagCategoryDomainService.reorderCategories(command.categoryIds, command.orderIndex, createTenantFilter(command.ownedBy));
    }

    async batchDeleteCategories(command: BatchDeleteTagCategoriesCommand): Promise<BatchDeleteResult> {
        const {ids, deletedBy, ownedBy} = command;
        const tenantFilter = createTenantFilter(ownedBy);
        const deletedIds: string[] = [];
        const failedItems: BatchDeleteFailedItem[] = [];

        for (const categoryId of ids) {
            try {
                const canDelete = await this.tagCategoryDomainService.canDeleteCategory(categoryId, tenantFilter);
                if (!canDelete) {
                    const category = await this.tagCategoryDomainService.getCategory(categoryId, tenantFilter);
                    failedItems.push({
                        id: categoryId,
                        name: category?.name || categoryId,
                        reason: '该分类下存在子分类或标签',
                    });
                    continue;
                }

                await this.tagCategoryDomainService.deleteCategory({
                    categoryId,
                    deletedBy,
                    ownedBy,
                }, tenantFilter);
                deletedIds.push(categoryId);
            } catch (error) {
                const category = await this.tagCategoryDomainService.getCategory(categoryId, tenantFilter).catch(() => null);
                failedItems.push({
                    id: categoryId,
                    name: category?.name || categoryId,
                    reason: error instanceof Error ? error.message : '删除失败',
                });
            }
        }

        const success = failedItems.length === 0;
        const deletedCount = deletedIds.length;

        return {
            success,
            deletedCount,
            message: success 
                ? `成功删除 ${deletedCount} 个分类`
                : `成功删除 ${deletedCount} 个分类，${failedItems.length} 个失败`,
            failedItems: failedItems.length > 0 ? failedItems : undefined,
        };
    }
}
