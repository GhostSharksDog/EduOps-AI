import {TagApplicationService} from '@/modules/tag/services/index';
import {IBitmapApplicationService as BitmapApplicationService} from '@/modules/tag/services/bitmap/IBitmapApplicationService';
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
import {SortOrder, TagStatus, TagValueType} from '@/shared/enums/index';
import {TagDomainService} from '@/modules/tag/domain/services/ports/TagDomainService';
import {TagVersionDomainService} from '@/modules/tag/domain/services/ports/TagVersionDomainService';
import {TagQueryDomainService} from '@/modules/tag/domain/services/ports/TagQueryDomainService';
import {Tag} from '@/modules/tag/domain/entities/Tag';
import {TagVersion} from '@/modules/tag/domain/entities/TagVersion';
import {ITagOHSAdapter} from '@/modules/tag/services/ITagOHSAdapter';
import {ITagVersionOHSAdapter} from '@/modules/tag/services/ITagVersionOHSAdapter';
import {createTenantFilter} from '@/platform/get-current-tenant';
import {ConflictException} from '@/shared/errors/index';
import {transaction} from '@/platform/database';
import {log} from '@/platform/logger';
import {IMaterializedViewConfigRepository} from '@/modules/tag/domain/ports/IMaterializedViewConfigRepository';
import {ITargetTableRepository} from '@/modules/tag/domain/ports/ITargetTableRepository';
import {IClickHouseClientAdapter} from '@/platform/database/interface/IClickHouseClientAdapter';

export class TagApplicationServiceImpl implements TagApplicationService {
    constructor(
        private readonly tagDomainService: TagDomainService,
        private readonly tagVersionDomainService: TagVersionDomainService,
        private readonly tagQueryDomainService: TagQueryDomainService,
        private readonly tagOHSAdapter: ITagOHSAdapter,
        private readonly tagVersionOHSAdapter: ITagVersionOHSAdapter,
        private readonly bitmapApplicationService: BitmapApplicationService,
        private readonly mvConfigRepository: IMaterializedViewConfigRepository,
        private readonly targetTableRepository: ITargetTableRepository,
        private readonly chClient: IClickHouseClientAdapter
    ) {
    }

    async createTag(command: CreateTagCommand): Promise<TagVO> {
        const result = await transaction(async (tx) => {
            if (command.bitConfig) {
                const available = await this.bitmapApplicationService.isBitPositionAvailable(
                    command.bitConfig.bitmapTableId,
                    command.bitConfig.bitPosition
                );
                if (!available) {
                    throw new ConflictException('TAG_BIT_POSITION_OCCUPIED', {
                        bitmapTableId: command.bitConfig.bitmapTableId,
                        bitPosition: command.bitConfig.bitPosition
                    });
                }
            }

            const tag = await this.tagDomainService.createTag(command, tx);

            if (command.bitConfig) {
                await this.bitmapApplicationService.assignBitToTag(
                    command.bitConfig.bitmapTableId,
                    command.bitConfig.bitPosition,
                    tag.id,
                    command.createdBy,
                    tx
                );
            }

            return tag;
        });

        return this.tagOHSAdapter.fromTagToTagVO(result);
    }

    async getTag(query: GetTagQuery): Promise<TagVO> {
        const tag = await this.tagDomainService.getTag(query.tagId, query.tenantFilter);
        return this.tagOHSAdapter.fromTagToTagVO(tag);
    }

    async getTagByName(name: string, tenantId: string): Promise<TagVO | null> {
        const filter = createTenantFilter(tenantId);
        const tag = await this.tagDomainService.findTagByName(name, filter);
        return tag ? this.tagOHSAdapter.fromTagToTagVO(tag) : null;
    }

    async updateTag(command: UpdateTagCommand): Promise<TagVO> {
        const existingTag = await this.tagDomainService.getTag(command.tagId, createTenantFilter(command.ownedBy));
        const existingBitAssignment = await this.bitmapApplicationService.getTagBitAssignment(command.tagId);

        if (command.bitConfig !== undefined) {
            if (command.bitConfig) {
                if (existingBitAssignment) {
                    if (existingBitAssignment.bitmapTableId !== command.bitConfig.bitmapTableId ||
                        existingBitAssignment.bitPosition !== command.bitConfig.bitPosition) {
                        const available = await this.bitmapApplicationService.isBitPositionAvailable(
                            command.bitConfig.bitmapTableId,
                            command.bitConfig.bitPosition
                        );
                        if (!available) {
                            throw new ConflictException('TAG_BIT_POSITION_OCCUPIED');
                        }
                        await this.bitmapApplicationService.unassignBit(
                            existingBitAssignment.bitmapTableId,
                            existingBitAssignment.bitPosition!,
                            command.updatedBy
                        );
                        await this.bitmapApplicationService.assignBitToTag(
                            command.bitConfig.bitmapTableId,
                            command.bitConfig.bitPosition,
                            command.tagId,
                            command.updatedBy
                        );
                    }
                } else {
                    const available = await this.bitmapApplicationService.isBitPositionAvailable(
                        command.bitConfig.bitmapTableId,
                        command.bitConfig.bitPosition
                    );
                    if (!available) {
                        throw new ConflictException('TAG_BIT_POSITION_OCCUPIED');
                    }
                    await this.bitmapApplicationService.assignBitToTag(
                        command.bitConfig.bitmapTableId,
                        command.bitConfig.bitPosition,
                        command.tagId,
                        command.updatedBy
                    );
                }
            } else if (existingBitAssignment) {
                await this.bitmapApplicationService.unassignBit(
                    existingBitAssignment.bitmapTableId,
                    existingBitAssignment.bitPosition!,
                    command.updatedBy
                );
            }
        }

        const tag = await this.tagDomainService.updateTag(command, createTenantFilter(command.ownedBy));

        return this.tagOHSAdapter.fromTagToTagVO(tag);
    }

    async updateTagStatus(command: UpdateTagStatusCommand): Promise<TagVO> {
        const tag = await this.tagDomainService.updateTagStatus(command.tagId, command.status, createTenantFilter(command.ownedBy));
        return this.tagOHSAdapter.fromTagToTagVO(tag);
    }

    async deleteTag(command: DeleteTagCommand): Promise<void> {
        const bitAssignment = await this.bitmapApplicationService.getTagBitAssignment(command.tagId);
        if (bitAssignment && bitAssignment.bitPosition !== null && bitAssignment.bitPosition !== undefined) {
            await this.bitmapApplicationService.unassignBit(
                bitAssignment.bitmapTableId,
                bitAssignment.bitPosition,
                command.deletedBy
            );
        }
        await this.tagDomainService.deleteTag(command.tagId, command.deletedBy, createTenantFilter(command.ownedBy));
    }

    async createTagVersion(command: CreateTagVersionCommand): Promise<TagVersionVO> {
        const version = await this.tagDomainService.createTagVersion(command);
        const tag = await this.tagDomainService.getTag(command.tagId);
        return this.tagVersionOHSAdapter.fromTagVersionToTagVersionVO(version, tag);
    }

    async setCurrentVersion(command: SetCurrentVersionCommand): Promise<TagVO> {
        const tenantFilter = createTenantFilter(command.ownedBy);
        const tag = await this.tagDomainService.getTag(command.tagId, tenantFilter);

        // 状态校验：ACTIVE 状态禁止切换版本（与 updateTagRule 保持一致）
        if (tag.status === TagStatus.ACTIVE) {
            throw new Error('标签处于活跃状态，请先停用后再切换版本');
        }

        // 短路：切到当前版本无需任何操作
        if (tag.currentVersionId === command.versionId) {
            return this.tagOHSAdapter.fromTagToTagVO(tag);
        }

        const oldVersionNumber = tag.currentVersion?.version;

        // 1. 清理旧版本 MV 对象（优先根据 mvc 确定，再按命名规则兜底）
        await this.cleanupOldVersionMvs(tag, oldVersionNumber);

        // 2. 清理 materialized_view_config 行
        try {
            await this.mvConfigRepository.deleteByTagId(command.tagId, tenantFilter);
        } catch (error) {
            log.warn('切换版本：清理旧 MV 配置记录失败', {tagId: command.tagId, error});
        }

        // 3. 切换版本
        const updatedTag = await this.tagDomainService.setCurrentVersion(
            command.tagId,
            command.versionId,
            tenantFilter
        );

        // 4. 重连 target_table.tag_version_id
        try {
            const targetTable = await this.targetTableRepository.findByTagId(command.tagId);
            if (targetTable && targetTable.tagVersionId !== command.versionId) {
                await this.targetTableRepository.linkTag(targetTable.id, command.tagId, command.versionId);
            }
        } catch (error) {
            log.warn('切换版本：更新目标表 tag_version_id 失败', {tagId: command.tagId, error});
        }

        return this.tagOHSAdapter.fromTagToTagVO(updatedTag);
    }

    /**
     * 清理旧版本在 ClickHouse 中的 MV 对象
     * 顺序：mvc.mvName → 命名规则兜底 → ENUM bitmap MV/表
     */
    private async cleanupOldVersionMvs(tag: Tag, oldVersionNumber?: number): Promise<void> {
        // 1. 优先根据 mvc.mvName 删除（权威名）
        let droppedFromConfig = false;
        try {
            const oldConfigs = await this.mvConfigRepository.findByTagId(tag.id);
            for (const cfg of oldConfigs) {
                try {
                    await this.chClient.dropMaterializedView(cfg.mvName);
                    droppedFromConfig = true;
                    log.info('切换版本：删除旧 MV', {tagId: tag.id, mvName: cfg.mvName});
                } catch (error) {
                    log.warn('切换版本：删除旧 MV 失败（可能不存在）', {tagId: tag.id, mvName: cfg.mvName, error});
                }
            }
        } catch (error) {
            log.warn('切换版本：读取旧 MV 配置失败', {tagId: tag.id, error});
        }

        // 2. 兜底：mvc 为空但旧版本号已知，按命名规则尝试删除
        if (!droppedFromConfig && oldVersionNumber !== undefined) {
            const fallbackMain = `mv_tag_${tag.id}_v${oldVersionNumber}`;
            for (const name of [fallbackMain, `${fallbackMain}_bitmap`]) {
                try {
                    await this.chClient.dropMaterializedView(name);
                    log.info('切换版本：按命名规则删除旧 MV', {tagId: tag.id, mvName: name});
                } catch (error) {
                    log.warn('切换版本：按命名规则删除旧 MV 失败', {tagId: tag.id, mvName: name, error});
                }
            }
        }

        // 3. ENUM 标签：清理 _enum_bitmap MV、_bitmap MV（兼容命名）、_enum bitmap 表
        if (tag.dataType === TagValueType.ENUM && oldVersionNumber !== undefined) {
            const enumBitmapMvName = `mv_tag_${tag.id}_v${oldVersionNumber}_enum_bitmap`;
            try {
                await this.chClient.dropMaterializedView(enumBitmapMvName);
                log.info('切换版本：删除 ENUM bitmap MV', {tagId: tag.id, mvName: enumBitmapMvName});
            } catch (error) {
                log.warn('切换版本：删除 ENUM bitmap MV 失败', {tagId: tag.id, mvName: enumBitmapMvName, error});
            }

            // 兼容非标准 _bitmap 后缀（rebuild/updateCycle 创建）
            const bitmapMvName = `mv_tag_${tag.id}_v${oldVersionNumber}_bitmap`;
            try {
                await this.chClient.dropMaterializedView(bitmapMvName);
            } catch (error) {
                log.warn('切换版本：删除 bitmap MV 失败', {tagId: tag.id, mvName: bitmapMvName, error});
            }

            // 删除 ENUM bitmap 表（{bitmapTableName}_enum）
            try {
                const bitAssignment = await this.bitmapApplicationService.getTagBitAssignment(tag.id);
                const bitmapTableName = bitAssignment?.bitmapTableName;
                if (bitmapTableName) {
                    const enumTableName = `${bitmapTableName}_enum`;
                    await this.chClient.dropTable(enumTableName);
                    log.info('切换版本：删除 ENUM bitmap 表', {tagId: tag.id, enumTableName});
                }
            } catch (error) {
                log.warn('切换版本：删除 ENUM bitmap 表失败', {tagId: tag.id, error});
            }
        }
    }

    async listTagVersions(query: ListTagVersionsQuery): Promise<PagedVO<TagVersionVO>> {
        const allVersions = await this.tagVersionDomainService.listVersions(query.tagId);

        // 按 version 降序排序 + 去重：同版本号保留最新创建的
        const deduped = this.deduplicateVersions(allVersions);

        const totalCount = deduped.length;

        // 所有 version 都属于同一个 tagId，直接获取一次即可
        const tags = new Map<string, Tag>();
        try {
            const tag = await this.tagDomainService.getTag(query.tagId);
            tags.set(query.tagId, tag);
        } catch {
            // Ignore errors when fetching tag
        }

        const items = this.tagVersionOHSAdapter.fromTagVersionListToTagVersionVOList(deduped, tags);

        return {
            items,
            totalCount,
            page: query.page || 1,
            pageSize: query.pageSize || 10,
            totalPages: Math.ceil(totalCount / (query.pageSize || 10))
        };
    }

    /**
     * 去重 + 排序：相同 version 号的记录只保留最新创建的，按 version 降序排列
     */
    private deduplicateVersions(versions: TagVersion[]): TagVersion[] {
        const versionMap = new Map<number, TagVersion>();
        for (const v of versions) {
            const ver = v.version;
            const existing = versionMap.get(ver);
            // 保留 createTime 更新的那条；如果 createTime 相同则保留后出现的
            if (!existing || (v.createTime && existing.createTime && v.createTime >= existing.createTime)) {
                versionMap.set(ver, v);
            }
        }
        return Array.from(versionMap.entries())
            .sort(([a], [b]) => b - a)
            .map(([, v]) => v);
    }

    async listTags(query: ListTagsQuery): Promise<PagedVO<TagVO>> {
        const organizationFilter={
            ...(query.ownedBy?{ownedBy:query.ownedBy}:{}),
            ...(query.isPublic!==undefined?{isPublic:query.isPublic}:{}),
            ...(query.tenantFilter?{tenantFilter:query.tenantFilter}:{})
        };
        // Mapping ListTagsQuery to SearchTagsQuery or direct usage if TagQueryDomainService supports it
        // TagQueryDomainService has searchTags(criteria: SearchTagsQuery)
        // ListTagsQuery has categoryId, type, status, page, pageSize
        const tags = await this.tagQueryDomainService.searchTags({
            ...organizationFilter,
            categoryId: query.categoryId,
            type: query.type,
            status: query.status,
            name: query.keyword
        }, {
            page: query.page ||1,
            pageSize: query.pageSize || 10,
            sortOrder: SortOrder.DESC
        });

        // Need total count
        const totalCount = await this.tagQueryDomainService.countTagsByCriteria({
            ...organizationFilter,
            categoryId: query.categoryId,
            type: query.type,
            status: query.status,
            name: query.keyword
        });

        return {
            items: tags.map(t => this.tagOHSAdapter.fromTagToTagVO(t)),
            totalCount: totalCount,
            page: query.page || 1,
            pageSize: query.pageSize || 10,
            totalPages: Math.ceil(totalCount / (query.pageSize || 10))
        };
    }
}
