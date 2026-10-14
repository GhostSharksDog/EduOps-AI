import {TagCategory} from '@/modules/tag/domain/entities/TagCategory';
import {TagCategoryVO} from '@/modules/tag/contracts/schemas/response/tag-category/index';
import {CreateTagCategoryDTO} from '@/modules/tag/contracts/schemas/request/tag-category/index';
import {GetTagCategoryQuery, ListTagCategoriesQuery} from '@/modules/tag/contracts/queries/index';
import {
    BatchDeleteTagCategoriesCommand,
    CreateTagCategoryCommand,
    DeleteTagCategoryCommand,
    MoveTagCategoryCommand,
    ReorderTagCategoriesCommand,
    UpdateTagCategoryCommand
} from '@/modules/tag/contracts/commands/index';
import {NextRequest} from 'next/server';

/**
 * 标签分类OHS适配器接口
 * @description 负责TagCategory实体与Schema之间的转换，以及HTTP请求与领域查询/命令之间的转换
 */
export interface ITagCategoryOHSAdapter {
    // ========== HTTP请求到领域查询转换方法 (Request → Query) ==========

    /**
     * 将HTTP请求转换为分类列表查询对象
     * @param request HTTP请求对象
     * @returns ListTagCategoriesQuery
     */
    fromRequestToListCategoriesQuery(request: NextRequest): ListTagCategoriesQuery;

    /**
     * 将HTTP请求转换为获取单个分类查询对象
     * @param request HTTP请求对象
     * @returns GetTagCategoryQuery
     */
    fromRequestToGetCategoryQuery(request: NextRequest): GetTagCategoryQuery;

    // ========== HTTP请求到领域命令转换方法 (Request → Command) ==========

    /**
     * 将HTTP请求转换为创建分类命令对象
     * @param request HTTP请求对象
     * @returns Promise<CreateTagCategoryCommand>
     */
    fromRequestToCreateCategoryCommand(request: NextRequest): Promise<CreateTagCategoryCommand>;

    /**
     * 将HTTP请求转换为更新分类命令对象
     * @param request HTTP请求对象
     * @param id 分类ID
     * @returns Promise<UpdateTagCategoryCommand>
     */
    fromRequestToUpdateCategoryCommand(request: NextRequest, id: string): Promise<UpdateTagCategoryCommand>;

    /**
     * 将HTTP请求转换为删除分类命令对象
     * @param request HTTP请求对象
     * @param id 分类ID
     * @returns DeleteTagCategoryCommand
     */
    fromRequestToDeleteCategoryCommand(request: NextRequest, id: string): DeleteTagCategoryCommand;

    /**
     * 将HTTP请求转换为移动分类命令对象
     * @param request HTTP请求对象
     * @returns Promise<MoveTagCategoryCommand>
     */
    fromRequestToMoveCategoryCommand(request: NextRequest): Promise<MoveTagCategoryCommand>;

    /**
     * 将HTTP请求转换为重新排序分类命令对象
     * @param request HTTP请求对象
     * @returns Promise<ReorderTagCategoriesCommand>
     */
    fromRequestToReorderCategoriesCommand(request: NextRequest): Promise<ReorderTagCategoriesCommand>;

    /**
     * 将HTTP请求转换为批量删除分类命令对象
     * @param request HTTP请求对象
     * @returns Promise<BatchDeleteTagCategoriesCommand>
     */
    fromRequestToBatchDeleteCommand(request: NextRequest): Promise<BatchDeleteTagCategoriesCommand>;

    // ========== 实体到响应VO转换方法 (Entity → Response) ==========

    /**
     * 将TagCategory实体转换为TagCategoryVO
     * @param category TagCategory实体
     * @param tagCount 关联的标签数量
     * @param parentCategory 父分类实体（可选，用于构建完整的嵌套结构）
     * @returns TagCategoryVO
     */
    fromEntityToTagCategoryVO(category: TagCategory, tagCount?: number, parentCategory?: TagCategory | null): TagCategoryVO;

    /**
     * 将TagCategory实体列表转换为TagCategoryVO树形结构
     * @param categories TagCategory实体列表
     * @param tagCounts 标签数量映射 Map<CategoryId, count>
     * @returns TagCategoryVO[] 树形结构
     */
    fromEntityListToTagCategoryVOTree(categories: TagCategory[], tagCounts?: Map<string, number>): TagCategoryVO[];

    // ========== DTO到实体转换方法 (DTO → Entity) ==========

    /**
     * 将CreateTagCategoryDTO转换为TagCategory实体数据
     * @param dto 创建分类DTO
     * @returns Partial<TagCategory> TagCategory实体数据
     */
    fromDTOToTagCategoryEntity(dto: CreateTagCategoryDTO): Partial<TagCategory>;
}
