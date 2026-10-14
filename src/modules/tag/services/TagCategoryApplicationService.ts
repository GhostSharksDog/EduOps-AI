import {
    BatchDeleteTagCategoriesCommand,
    BatchDeleteResult,
    CreateTagCategoryCommand,
    DeleteTagCategoryCommand,
    MoveTagCategoryCommand,
    ReorderTagCategoriesCommand,
    UpdateTagCategoryCommand
} from '@/modules/tag/contracts/commands/index';
import {GetTagCategoryQuery, ListTagCategoriesQuery} from '@/modules/tag/contracts/queries/index';
import {TagCategoryListVO, TagCategoryVO} from '@/modules/tag/contracts/schemas/response/tag-category/index';

/**
 * 标签分类应用服务接口
 */
export interface TagCategoryApplicationService {
    /**
     * 创建分类
     * @param command 创建分类命令
     * @returns 分类VO
     */
    createCategory(command: CreateTagCategoryCommand): Promise<TagCategoryVO>;

    /**
     * 获取分类
     * @param query 获取分类查询
     * @returns 分类VO
     */
    getCategory(query: GetTagCategoryQuery): Promise<TagCategoryVO>;

    /**
     * 更新分类
     * @param command 更新分类命令
     * @returns 分类VO
     */
    updateCategory(command: UpdateTagCategoryCommand): Promise<TagCategoryVO>;

    /**
     * 删除分类
     * @param command 删除分类命令
     */
    deleteCategory(command: DeleteTagCategoryCommand): Promise<void>;

    /**
     * 列出分类
     * @param query 列出分类查询
     * @returns 分页的分类VO
     */
    listCategories(query: ListTagCategoriesQuery): Promise<TagCategoryListVO>;

    /**
     * 移动分类
     * @param command 移动分类命令
     * @returns 分类VO
     */
    moveCategory(command: MoveTagCategoryCommand): Promise<TagCategoryVO>;

    /**
     * 重新排序分类
     * @param command 重新排序命令
     */
    reorderCategories(command: ReorderTagCategoriesCommand): Promise<void>;

    batchDeleteCategories(command: BatchDeleteTagCategoriesCommand): Promise<BatchDeleteResult>;
}
