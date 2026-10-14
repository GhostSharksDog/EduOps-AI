import type {DbClient} from '@/platform/database';
/* eslint-disable @typescript-eslint/no-explicit-any */
import {Tag, TagCategory, TagVersion} from '@/modules/tag/domain/index';
import {DeleteTagCategoryCommand} from '@/modules/tag/contracts/commands/index';
import {TenantFilterOptions} from '@/platform/get-current-tenant';

/**
 * 标签仓储接口
 * 负责标签、标签版本和标签分类的持久化操作
 */
export interface TagRepository {
    // 标签操作
    create(tag: Tag, tx?: DbClient): Promise<Tag>;

    findById(id: string, tenantFilter?: TenantFilterOptions): Promise<Tag | null>;

    findAll(filter?: Record<string, any>): Promise<Tag[]>;

    /**
     * 通过 name 查找标签
     *
     * 前提条件: name 在租户范围内唯一 (业务保证)
     *
     * @param name 标签名称
     * @param tenantFilter 租户过滤器 (用于租户隔离)
     */
    findByName(name: string, tenantFilter?: TenantFilterOptions): Promise<Tag | null>;

    update(tag: Tag, tenantFilter?: TenantFilterOptions): Promise<Tag>;

    delete(id: string, deletedBy?: string, tenantFilter?: TenantFilterOptions): Promise<void>;

    restore(id: string, tenantFilter?: TenantFilterOptions): Promise<Tag>;

    // 标签版本操作
    createVersion(tagVersion: TagVersion): Promise<TagVersion>;

    findVersionById(id: string): Promise<TagVersion | null>;

    findVersionsByTagId(tagId: string): Promise<TagVersion[]>;

    countVersionsByTagId(tagId: string): Promise<number>;

    /**
     * 获取指定标签的最大版本号
     * @param tagId 标签ID
     * @returns 最大版本号，没有版本时返回 0
     */
    maxVersionByTagId(tagId: string): Promise<number>;

    updateVersion(tagVersion: TagVersion, tenantFilter?: TenantFilterOptions): Promise<TagVersion>;

    /**
     * 硬删除指定版本（用于 MV 创建失败时的回滚）
     */
    deleteVersionById(versionId: string): Promise<void>;

    // 标签分类操作
    createCategory(category: TagCategory): Promise<TagCategory>;

    findCategoryById(categoryId: string, tenantFilter?: TenantFilterOptions): Promise<TagCategory | null>;

    findAllCategories(filter?: Record<string, any>): Promise<TagCategory[]>;

    updateCategory(category: TagCategory, tenantFilter?: TenantFilterOptions): Promise<TagCategory>;

    deleteCategory(command: DeleteTagCategoryCommand, tenantFilter?: TenantFilterOptions): Promise<void>;

    countTagsByCategoryId(categoryId: string): Promise<number>;

    /**
     * 批量统计多个分类下的标签数量
     * @param categoryIds 分类ID数组
     * @returns Map<categoryId, count>
     */
    countTagsByCategoryIds(categoryIds: string[], tenantFilter?: TenantFilterOptions): Promise<Map<string, number>>;

    countChildCategories(parentId: string): Promise<number>;

    countCategories(filter?: Record<string, any>): Promise<number>;
}
