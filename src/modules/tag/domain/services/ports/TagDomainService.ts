import type {DbClient} from '@/platform/database';
import {Tag, TagVersion} from '@/modules/tag/domain/index';
import {CreateTagCommand, UpdateTagCommand, CreateTagVersionCommand} from '@/modules/tag/contracts/commands/index';
import {TagStatus} from '@/shared/enums/index';
import {TenantFilterOptions} from '@/platform/get-current-tenant';

/**
 * 标签领域服务接口
 */
export interface TagDomainService {
    /**
     * 创建标签
     * @param command 创建标签命令
     * @param tx 可选的 数据库事务客户端
     */
    createTag(command: CreateTagCommand, tx?: DbClient): Promise<Tag>;

    /**
     * 获取标签
     * @param tagId 标签ID
     * @param tenantFilter 租户过滤器
     */
    getTag(tagId: string, tenantFilter?: TenantFilterOptions): Promise<Tag>;

    findTagByName(name: string, tenantFilter?: TenantFilterOptions): Promise<Tag | null>;

    updateTag(command: UpdateTagCommand, tenantFilter?: TenantFilterOptions): Promise<Tag>;

    /**
     * 更新标签状态
     * @param tagId 标签ID
     * @param status 目标状态
     * @param tenantFilter 租户过滤器
     */
    updateTagStatus(tagId: string, status: TagStatus, tenantFilter?: TenantFilterOptions): Promise<Tag>;

    /**
     * 删除标签
     * @param tagId 标签ID
     * @param tenantFilter 租户过滤器
     */
    deleteTag(tagId: string, deletedBy?: string, tenantFilter?: TenantFilterOptions): Promise<void>;

    /**
     * 创建标签版本
     * @param command 创建标签版本命令
     */
    createTagVersion(command: CreateTagVersionCommand): Promise<TagVersion>;

    /**
     * 设置当前版本
     * @param tagId 标签ID
     * @param versionId 版本ID
     * @param tenantFilter 租户过滤器
     */
    setCurrentVersion(tagId: string, versionId: string, tenantFilter?: TenantFilterOptions): Promise<Tag>;

    /**
     * 硬删除指定版本（用于 MV 创建失败时的回滚）
     */
    deleteTagVersion(versionId: string): Promise<void>;
}
