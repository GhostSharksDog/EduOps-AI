import {Tag, TagQueryDomainService, type TagQueryFilter} from '@/modules/tag/domain/index';
import type {TagRepository} from '@/modules/tag/domain/ports/TagRepository';
import {TagStatus, SortOrder} from '@/shared/enums/index';
import {CountTagsQuery, SearchTagsQuery} from '@/modules/tag/contracts/queries/index';
import {type PaginationQueryDTO} from '@/shared/schemas/common/index';
import type {TenantFilterOptions} from '@/platform/get-current-tenant';

export class TagQueryDomainServiceImpl implements TagQueryDomainService {
    constructor(private readonly tagRepository: TagRepository) {
    }

    async getTagsByIds(ids: string[]): Promise<Tag[]> {
        if (!ids || ids.length === 0) {
            return [];
        }
        return await this.tagRepository.findAll({ids});
    }

    async searchTags(criteria: SearchTagsQuery, pagination?: PaginationQueryDTO): Promise<Tag[]> {
        const filter: TagQueryFilter = {};
        if(criteria.ownedBy)filter.ownedBy=criteria.ownedBy;
        if(criteria.tenantFilter)filter.tenantFilter=criteria.tenantFilter;

        if (criteria.categoryId) {
            filter.categoryId = criteria.categoryId;
        }

        if (criteria.type) {
            filter.type = criteria.type;
        }

        if (criteria.status) {
            filter.status = criteria.status;
        }

        if (criteria.name) {
            filter.name = criteria.name;
        }

        if (criteria.isPublic !== undefined) {
            filter.isPublic = criteria.isPublic;
        }

        if (pagination) {
            filter.skip = ((pagination.page || 1) - 1) * (pagination.pageSize || 10);
            filter.take = pagination.pageSize || 10;
            filter.sortOrder = pagination.sortOrder || SortOrder.DESC;
        }

        return await this.tagRepository.findAll(filter);
    }

    async getTagsByCategory(categoryId: string, pagination?: PaginationQueryDTO): Promise<Tag[]> {
        const filter: TagQueryFilter = {categoryId};
        if (pagination) {
            filter.skip = ((pagination.page || 1) - 1) * (pagination.pageSize || 10);
            filter.take = pagination.pageSize || 10;
            filter.sortOrder = pagination.sortOrder || SortOrder.DESC;
        }
        return await this.tagRepository.findAll(filter);
    }

    async getTagsByStatus(status: TagStatus, pagination?: PaginationQueryDTO): Promise<Tag[]> {
        const filter: TagQueryFilter = {status};
        if (pagination) {
            filter.skip = ((pagination.page || 1) - 1) * (pagination.pageSize || 10);
            filter.take = pagination.pageSize || 10;
            filter.sortOrder = pagination.sortOrder || SortOrder.DESC;
        }
        return await this.tagRepository.findAll(filter);
    }

    async countTagsByCriteria(criteria: CountTagsQuery): Promise<number> {
        const tags = await this.tagRepository.findAll(criteria);
        return tags.length;
    }

    async countTagsByCategoryIds(categoryIds: string[], tenantFilter?: TenantFilterOptions): Promise<Map<string, number>> {
        return this.tagRepository.countTagsByCategoryIds(categoryIds, tenantFilter);
    }
}
