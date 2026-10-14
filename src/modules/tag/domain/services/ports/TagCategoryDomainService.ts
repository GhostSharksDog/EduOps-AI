import {TagCategory} from '@/modules/tag/domain/entities/index';
import {type PaginationQueryDTO} from '@/shared/schemas/common/index';
import {CreateTagCategoryCommand, DeleteTagCategoryCommand, UpdateTagCategoryCommand} from '@/modules/tag/contracts/commands/index';
import {TenantFilterOptions} from '@/platform/get-current-tenant';

/**
 * 标签分类领域服务接口
 */
export interface TagCategoryDomainService {
    /**
     * 创建分类
     * @param categoryData 分类创建数据
     */
    createCategory(categoryData: CreateTagCategoryCommand): Promise<TagCategory>;

    /**
     * 获取分类
     * @param categoryId 分类ID
     * @param tenantFilter 租户过滤器
     */
    getCategory(categoryId: string, tenantFilter?: TenantFilterOptions): Promise<TagCategory>;

    /**
     * 更新分类
     * @param categoryId 分类ID
     * @param categoryData 分类更新数据
     * @param tenantFilter 租户过滤器
     */
    updateCategory(categoryId: string, categoryData: UpdateTagCategoryCommand, tenantFilter?: TenantFilterOptions): Promise<TagCategory>;

    /**
     * 删除分类
     * @param command 分类ID
     * @param tenantFilter 租户过滤器
     */
    deleteCategory(command: DeleteTagCategoryCommand, tenantFilter?: TenantFilterOptions): Promise<void>;

    /**
     * 列出分类
     * @param parentId 父分类ID
     * @param pagination 分页查询参数
     */
    listCategories(parentId?: string, pagination?: PaginationQueryDTO, tenantFilter?: TenantFilterOptions): Promise<TagCategory[]>;

    /**
     * 移动分类
     * @param categoryId 分类ID
     * @param newParentId 新父分类ID
     * @param tenantFilter 租户过滤器
     */
    moveCategory(categoryId: string, newParentId: string, tenantFilter?: TenantFilterOptions): Promise<TagCategory>;

    /**
     * 重新排序分类
     * @param categoryIds 分类ID数组
     * @param orderIndex 排序索引数组
     */
    reorderCategories(categoryIds: string[], orderIndex: number[], tenantFilter?: TenantFilterOptions): Promise<void>;

    /**
     * 检查分类是否可以删除
     * @param categoryId 分类ID
     * @param tenantFilter 租户过滤器
     */
    canDeleteCategory(categoryId: string, tenantFilter?: TenantFilterOptions): Promise<boolean>;

    /**
     * 统计分类数量
     * @param parentId 父分类ID
     * @param keyword 搜索关键词
     * @returns 分类数量
     */
    countCategories(parentId?: string, keyword?: string, tenantFilter?: TenantFilterOptions): Promise<number>;
}
