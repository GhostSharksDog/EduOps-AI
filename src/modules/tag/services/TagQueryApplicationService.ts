import {
    CountTagsQuery,
    ExportTagsQuery,
    GetTagsByCategoryQuery,
    GetTagsByStatusQuery,
    GetTagsByTypeQuery,
    SearchTagsQuery
} from '@/modules/tag/contracts/queries/index';
import {PagedVO} from '@/shared/schemas/common/index';
import {TagVO} from '@/modules/tag/contracts/schemas/response/tag/index';
import {ExportTaskVO} from '@/modules/tag/contracts/schemas/response/export-task/index';

/**
 * 标签查询应用服务接口
 */
export interface TagQueryApplicationService {
    /**
     * 搜索标签
     * @param query 搜索标签查询
     * @returns 分页的标签VO
     */
    searchTags(query: SearchTagsQuery): Promise<PagedVO<TagVO>>;

    /**
     * 按分类获取标签
     * @param query 按分类获取标签查询
     * @returns 分页的标签VO
     */
    getTagsByCategory(query: GetTagsByCategoryQuery): Promise<PagedVO<TagVO>>;

    /**
     * 按类型获取标签
     * @param query 按类型获取标签查询
     * @returns 分页的标签VO
     */
    getTagsByType(query: GetTagsByTypeQuery): Promise<PagedVO<TagVO>>;

    /**
     * 按状态获取标签
     * @param query 按状态获取标签查询
     * @returns 分页的标签VO
     */
    getTagsByStatus(query: GetTagsByStatusQuery): Promise<PagedVO<TagVO>>;

    /**
     * 统计标签数量
     * @param query 统计标签数量查询
     * @returns 标签数量
     */
    countTags(query: CountTagsQuery): Promise<number>;

    /**
     * 导出标签
     * @param query 导出标签查询
     * @returns 导出任务VO
     */
    exportTags(query: ExportTagsQuery): Promise<ExportTaskVO>;
}
