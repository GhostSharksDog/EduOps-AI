import {Tag} from '@/modules/tag/domain/index';
import {TagStatus} from '@/shared/enums/index';
import {CountTagsQuery, SearchTagsQuery} from '@/modules/tag/contracts/queries/index';
import {type PaginationQueryDTO} from '@/shared/schemas/common/index';
import type {TenantFilterOptions} from '@/platform/get-current-tenant';

/**
 * 标签查询领域服务接口
 */
export interface TagQueryDomainService {
    /**
     * 按ID列表获取标签
     * @param ids 标签ID列表
     */
    getTagsByIds(ids: string[]): Promise<Tag[]>;

    /**
     * 搜索标签
     * @param criteria 搜索条件
     * @param pagination 分页查询参数
     */
    searchTags(criteria: SearchTagsQuery, pagination?: PaginationQueryDTO): Promise<Tag[]>;

    /**
     * 按分类获取标签列表
     * @param categoryId 分类ID
     * @param pagination 分页查询参数
     */
    getTagsByCategory(categoryId: string, pagination?: PaginationQueryDTO): Promise<Tag[]>;

    /**
     * 按状态获取标签列表
     * @param status 标签状态
     * @param pagination 分页查询参数
     */
    getTagsByStatus(status: TagStatus, pagination?: PaginationQueryDTO): Promise<Tag[]>;

    /**
     * 统计标签数量
     * @param criteria 统计条件
     */
    countTagsByCriteria(criteria: CountTagsQuery): Promise<number>;

    countTagsByCategoryIds(categoryIds: string[], tenantFilter?: TenantFilterOptions): Promise<Map<string, number>>;
}
