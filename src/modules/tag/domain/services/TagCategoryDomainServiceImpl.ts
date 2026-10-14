import {TagCategory, TagCategoryDomainService, ITagFactory, type TagCategoryFilter} from '@/modules/tag/domain/index';
import type {TagRepository} from '@/modules/tag/domain/ports/TagRepository';
import {type PaginationQueryDTO} from '@/shared/schemas/common/index';
import {CreateTagCategoryCommand, DeleteTagCategoryCommand, UpdateTagCategoryCommand} from '@/modules/tag/contracts/commands/index';
import {createTenantFilter, type TenantFilterOptions} from '@/platform/get-current-tenant';

export class TagCategoryDomainServiceImpl implements TagCategoryDomainService {
    constructor(
        private readonly tagRepository: TagRepository,
        private readonly tagFactory: ITagFactory
    ) {
    }

    async createCategory(categoryData: CreateTagCategoryCommand): Promise<TagCategory> {
        if (categoryData.parentId) await this.getCategory(categoryData.parentId, createTenantFilter(categoryData.ownedBy));
        const category = this.tagFactory.createTagCategory(categoryData);
        return await this.tagRepository.createCategory(category);
    }

    async getCategory(categoryId: string, tenantFilter?: TenantFilterOptions): Promise<TagCategory> {
        const category = await this.tagRepository.findCategoryById(categoryId, tenantFilter);
        if (!category) {
            throw new Error(`分类不存在: ${categoryId}`);
        }
        return category;
    }

    async updateCategory(categoryId: string, categoryData: UpdateTagCategoryCommand, tenantFilter?: TenantFilterOptions): Promise<TagCategory> {
        const category = await this.getCategory(categoryId, tenantFilter);
        if (categoryData.parentId) await this.getCategory(categoryData.parentId, tenantFilter);

        if (categoryData.name) category.name = categoryData.name;
        if (categoryData.description) category.description = categoryData.description;
        if (categoryData.parentId) category.parentId = categoryData.parentId;
        if (categoryData.orderIndex !== undefined) category.orderIndex = categoryData.orderIndex;
        if (categoryData.feature) category.feature = categoryData.feature;

        return await this.tagRepository.updateCategory(category, tenantFilter);
    }

    async deleteCategory(command: DeleteTagCategoryCommand, tenantFilter?: TenantFilterOptions): Promise<void> {
        await this.getCategory(command.categoryId, tenantFilter);
        await this.tagRepository.deleteCategory(command);
    }

    async listCategories(parentId?: string, pagination?: PaginationQueryDTO, tenantFilter?: TenantFilterOptions): Promise<TagCategory[]> {
        const filter: TagCategoryFilter = {};
        if (tenantFilter) filter.tenantFilter = tenantFilter;
        if (parentId) {
            filter.parentId = parentId;
        }

        if (pagination) {
            const page = pagination.page || 1;
            const pageSize = pagination.pageSize || 10;
            filter.skip = (page - 1) * pageSize;
            filter.take = pageSize;
            if (pagination.keyword) {
                filter.keyword = pagination.keyword;
            }
        }

        return await this.tagRepository.findAllCategories(filter);
    }

    async moveCategory(categoryId: string, newParentId: string, tenantFilter?: TenantFilterOptions): Promise<TagCategory> {
        const category = await this.getCategory(categoryId, tenantFilter);
        if (newParentId) await this.getCategory(newParentId, tenantFilter);
        category.parentId = newParentId === '' ? undefined : newParentId;
        return await this.tagRepository.updateCategory(category, tenantFilter);
    }

    async reorderCategories(categoryIds: string[], orderIndex: number[], tenantFilter?: TenantFilterOptions): Promise<void> {
        if (categoryIds.length !== orderIndex.length) {
            throw new Error('分类ID数组和排序索引数组长度必须一致');
        }

        const categories: TagCategory[] = [];
        for (const id of categoryIds) {
            categories.push(await this.getCategory(id, tenantFilter));
        }
        for (let i = 0; i < categories.length; i++) {
            categories[i].orderIndex = orderIndex[i];
            await this.tagRepository.updateCategory(categories[i], tenantFilter);
        }
    }

    async canDeleteCategory(categoryId: string, tenantFilter?: TenantFilterOptions): Promise<boolean> {
        await this.getCategory(categoryId, tenantFilter);
        const tagCount = await this.tagRepository.countTagsByCategoryId(categoryId);
        const childCategoryCount = await this.tagRepository.countChildCategories(categoryId);

        return tagCount === 0 && childCategoryCount === 0;
    }

    async countCategories(parentId?: string, keyword?: string, tenantFilter?: TenantFilterOptions): Promise<number> {
        const filter: TagCategoryFilter = {};
        if (tenantFilter) filter.tenantFilter = tenantFilter;
        if (parentId) {
            filter.parentId = parentId;
        }
        if (keyword) {
            filter.keyword = keyword;
        }
        return await this.tagRepository.countCategories(filter);
    }
}
