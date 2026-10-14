import {
    CreateTagCommand,
    CreateTagVersionCommand,
    DeleteTagCommand,
    SetCurrentVersionCommand,
    UpdateTagCommand,
    UpdateTagStatusCommand
} from '@/modules/tag/contracts/commands/index';
import {GetTagQuery, ListTagsQuery, ListTagVersionsQuery} from '@/modules/tag/contracts/queries/index';
import {PagedVO} from '@/shared/schemas/common/index';
import {TagVersionVO, TagVO} from '@/modules/tag/contracts/schemas/response/tag/index';

/**
 * 标签应用服务接口
 */
export interface TagApplicationService {
    /**
     * 创建标签
     * @param command 创建标签命令
     * @returns 标签VO
     */
    createTag(command: CreateTagCommand): Promise<TagVO>;

    /**
     * 获取标签
     * @param query 获取标签查询
     * @returns 标签VO
     */
    getTag(query: GetTagQuery): Promise<TagVO>;

    getTagByName(name: string, tenantId: string): Promise<TagVO | null>;

    updateTag(command: UpdateTagCommand): Promise<TagVO>;

    /**
     * 更新标签状态
     * @param command 更新标签状态命令
     * @returns 标签VO
     */
    updateTagStatus(command: UpdateTagStatusCommand): Promise<TagVO>;

    /**
     * 删除标签
     * @param command 删除标签命令
     */
    deleteTag(command: DeleteTagCommand): Promise<void>;

    /**
     * 创建标签版本
     * @param command 创建标签版本命令
     * @returns 标签版本VO
     */
    createTagVersion(command: CreateTagVersionCommand): Promise<TagVersionVO>;

    /**
     * 设置当前版本
     * @param command 设置当前版本命令
     * @returns 标签VO
     */
    setCurrentVersion(command: SetCurrentVersionCommand): Promise<TagVO>;

    /**
     * 列出标签版本
     * @param query 列出标签版本查询
     * @returns 分页的标签版本VO
     */
    listTagVersions(query: ListTagVersionsQuery): Promise<PagedVO<TagVersionVO>>;

    /**
     * 列出标签
     * @param query 列出标签查询
     * @returns 分页的标签VO
     */
    listTags(query: ListTagsQuery): Promise<PagedVO<TagVO>>;
}
