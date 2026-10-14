import {Tag} from '@/modules/tag/domain/entities/Tag';
import {TagVO} from '@/modules/tag/contracts/schemas/response/tag/index';
import {CreateTagDTO, UpdateTagDTO} from '@/modules/tag/contracts/schemas/request/tag/index';
import {NextRequest} from 'next/server';

// Query types
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

// Command types
import {
    CreateTagCommand,
    CreateTagVersionCommand,
    DeleteTagCommand,
    SetCurrentVersionCommand,
    UpdateTagCommand,
    UpdateTagStatusCommand
} from '@/modules/tag/contracts/commands/index';

/**
 * 标签OHS适配器接口
 * @description 负责Tag聚合根与Schema之间的转换，以及HTTP请求到领域查询/命令的转换
 */
export interface ITagOHSAdapter {
    // ========== 响应转换方法 (Response Transformation) ==========

    /**
     * 将Tag实体转换为TagVO
     * @param tag Tag实体
     * @returns TagVO
     */
    fromTagToTagVO(tag: Tag): TagVO;

    /**
     * 批量转换Tag实体为TagVO
     * @param tags Tag实体数组
     * @returns TagVO数组
     */
    fromTagListToTagVOList(tags: Tag[]): TagVO[];

    // ========== 领域映射方法 (Domain Mapping) ==========

    /**
     * 将CreateTagDTO转换为Tag实体（通常仅用于简单映射，建议使用Factory）
     * @param dto 创建DTO（已使用schema进行验证）
     * @returns Partial<Tag> 初始实体数据
     */
    fromDTOToTagEntity(dto: CreateTagDTO): Partial<Tag>;

    /**
     * 将UpdateTagDTO应用到Tag实体（仅数据映射）
     * @param tag 现有Tag实体
     * @param dto 更新DTO（已使用schema进行验证）
     * @returns Tag 更新后的实体
     */
    fromDTOToUpdateTagEntity(tag: Tag, dto: UpdateTagDTO): Tag;

    // ========== HTTP请求到领域查询转换方法 (Request → Query) ==========

    /**
     * 从HTTP请求转换为获取标签查询
     * @param request HTTP请求对象
     * @param id 路径中的ID
     * @returns GetTagQuery 获取标签查询对象
     */
    fromRequestToGetTagQuery(request: NextRequest, id?: string): GetTagQuery;

    /**
     * 从HTTP请求转换为标签列表查询
     * @param request HTTP请求对象
     * @returns ListTagsQuery 标签列表查询对象
     */
    fromRequestToListTagsQuery(request: NextRequest): ListTagsQuery;

    /**
     * 从HTTP请求转换为标签版本列表查询
     * @param request HTTP请求对象
     * @param id 可选的ID参数（用于动态路由）
     * @returns ListTagVersionsQuery 标签版本列表查询对象
     */
    fromRequestToListTagVersionsQuery(request: NextRequest, id?: string): ListTagVersionsQuery;

    /**
     * 从HTTP请求转换为标签搜索查询
     * @param request HTTP请求对象
     * @returns SearchTagsQuery 标签搜索查询对象
     */
    fromRequestToSearchTagsQuery(request: NextRequest): SearchTagsQuery;

    /**
     * 从HTTP请求转换为按分类查询标签
     * @param request HTTP请求对象
     * @returns GetTagsByCategoryQuery 按分类查询标签对象
     */
    fromRequestToGetTagsByCategoryQuery(request: NextRequest): GetTagsByCategoryQuery;

    /**
     * 从HTTP请求转换为按类型查询标签
     * @param request HTTP请求对象
     * @returns GetTagsByTypeQuery 按类型查询标签对象
     */
    fromRequestToGetTagsByTypeQuery(request: NextRequest): GetTagsByTypeQuery;

    /**
     * 从HTTP请求转换为按状态查询标签
     * @param request HTTP请求对象
     * @returns GetTagsByStatusQuery 按状态查询标签对象
     */
    fromRequestToGetTagsByStatusQuery(request: NextRequest): GetTagsByStatusQuery;

    /**
     * 从HTTP请求转换为标签计数查询
     * @param request HTTP请求对象
     * @returns CountTagsQuery 标签计数查询对象
     */
    fromRequestToCountTagsQuery(request: NextRequest): CountTagsQuery;

    /**
     * 从HTTP请求转换为标签导出查询
     * @param request HTTP请求对象
     * @returns ExportTagsQuery 标签导出查询对象
     */
    fromRequestToExportTagsQuery(request: NextRequest): ExportTagsQuery;

    // ========== HTTP请求到领域命令转换方法 (Request → Command) ==========

    /**
     * 从HTTP请求转换为创建标签命令
     * @param request HTTP请求对象
     * @returns CreateTagCommand 创建标签命令对象
     */
    fromRequestToCreateTagCommand(request: NextRequest): Promise<CreateTagCommand>;

    /**
     * 从HTTP请求转换为更新标签命令
     * @param request HTTP请求对象
     * @param id 路径中的ID
     * @returns UpdateTagCommand 更新标签命令对象
     */
    fromRequestToUpdateTagCommand(request: NextRequest, id?: string): Promise<UpdateTagCommand>;

    /**
     * 从HTTP请求转换为更新标签状态命令
     * @param request HTTP请求对象
     * @param id 可选的ID参数（用于动态路由）
     * @returns UpdateTagStatusCommand 更新标签状态命令对象
     */
    fromRequestToUpdateTagStatusCommand(request: NextRequest, id?: string): Promise<UpdateTagStatusCommand>;

    /**
     * 从HTTP请求转换为删除标签命令
     * @param request HTTP请求对象
     * @param id 可选的ID参数（用于动态路由）
     * @returns DeleteTagCommand 删除标签命令对象
     */
    fromRequestToDeleteTagCommand(request: NextRequest, id?: string): Promise<DeleteTagCommand>;

    /**
     * 从HTTP请求转换为创建标签版本命令
     * @param request HTTP请求对象
     * @param id 可选的ID参数（用于动态路由）
     * @returns CreateTagVersionCommand 创建标签版本命令对象
     */
    fromRequestToCreateTagVersionCommand(request: NextRequest, id?: string): Promise<CreateTagVersionCommand>;

    /**
     * 从HTTP请求转换为设置当前版本命令
     * @param request HTTP请求对象
     * @param tagId 标签ID（从路由参数中获取）
     * @returns SetCurrentVersionCommand 设置当前版本命令对象
     */
    fromRequestToSetCurrentVersionCommand(request: NextRequest, tagId?: string): Promise<SetCurrentVersionCommand>;
}
