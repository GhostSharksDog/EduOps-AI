import type {DbClient} from '@/platform/database';
import {TagDomainService} from '@/modules/tag/domain/services/ports/TagDomainService';
import type {TagRepository} from '@/modules/tag/domain/ports/TagRepository';
import type {ITargetTableRepository} from '@/modules/tag/domain/ports/ITargetTableRepository';
import {Tag, ITagFactory, TagVersion} from '@/modules/tag/domain/index';
import {CreateTagCommand, UpdateTagCommand, CreateTagVersionCommand} from '@/modules/tag/contracts/commands/index';
import {TagStatus} from '@/shared/enums/index';
import {TenantFilterOptions} from '@/platform/get-current-tenant';

export class TagDomainServiceImpl implements TagDomainService {
    constructor(
        private readonly tagRepository: TagRepository,
        private readonly tagFactory: ITagFactory,
        private readonly targetTableRepository: ITargetTableRepository
    ) {
    }

    async createTag(command: CreateTagCommand, tx?: DbClient): Promise<Tag> {
        const category = await this.tagRepository.findCategoryById(command.categoryId);
        if (!category) {
            throw new Error(`分类不存在: ${command.categoryId}`);
        }
        if (category.isDeleted) {
            throw new Error(`分类已被删除: ${command.categoryId}`);
        }
        
        const tag = this.tagFactory.createTag(command);
        const createdTag = await this.tagRepository.create(tag, tx);
        
        if (command.targetTableId && createdTag.currentVersionId) {
            await this.targetTableRepository.linkTag(
                command.targetTableId,
                createdTag.id,
                createdTag.currentVersionId
            );
        }
        
        return createdTag;
    }

    async getTag(tagId: string, tenantFilter?: TenantFilterOptions): Promise<Tag> {
        const tag = await this.tagRepository.findById(tagId, tenantFilter);
        if (!tag) {
            throw new Error(`标签不存在: ${tagId}`);
        }
        return tag;
    }

    async findTagByName(name: string, tenantFilter?: TenantFilterOptions): Promise<Tag | null> {
        return this.tagRepository.findByName(name, tenantFilter);
    }

    async updateTag(command: UpdateTagCommand, tenantFilter?: TenantFilterOptions): Promise<Tag> {
        const tag = await this.getTag(command.tagId, tenantFilter);

        if (command.name) tag.updateInfo(command.name, command.description, command.updateCycle);

        if (command.isPublic !== undefined) tag.setPublic(command.isPublic);

        if (command.bitConfig !== undefined) {
            tag.updateBitConfig(command.bitConfig);
        }

        if (command.rule && tag.currentVersion) {
            tag.currentVersion.updateRule(command.rule);
        }

        if (command.targetTableId !== undefined && tag.currentVersionId) {
            if (command.targetTableId === null) {
                const existingTargetTable = await this.targetTableRepository.findByTagId(tag.id);
                if (existingTargetTable) {
                    await this.targetTableRepository.unlinkTag(existingTargetTable.id);
                }
            } else {
                await this.targetTableRepository.linkTag(
                    command.targetTableId,
                    tag.id,
                    tag.currentVersionId
                );
            }
        }

        return await this.tagRepository.update(tag);
    }

    async updateTagStatus(tagId: string, status: TagStatus, tenantFilter?: TenantFilterOptions): Promise<Tag> {
        const tag = await this.getTag(tagId, tenantFilter);
        tag.changeStatus(status);
        return await this.tagRepository.update(tag);
    }

    async deleteTag(tagId: string, deletedBy?: string, tenantFilter?: TenantFilterOptions): Promise<void> {
        await this.getTag(tagId, tenantFilter);
        // 软删除：保留所有子记录和关联关系，回收站恢复时可以还原
        await this.tagRepository.delete(tagId, deletedBy);
    }

    async createTagVersion(command: CreateTagVersionCommand): Promise<TagVersion> {
        // 自动计算版本号：当前最大版本号 + 1，忽略前端传入的值
        const maxVersion = await this.tagRepository.maxVersionByTagId(command.tagId);
        const nextVersion = maxVersion + 1;

        const version = this.tagFactory.createTagVersion({
            ...command,
            version: nextVersion,
        });
        return await this.tagRepository.createVersion(version);
    }

    async setCurrentVersion(tagId: string, versionId: string, tenantFilter?: TenantFilterOptions): Promise<Tag> {
        const tag = await this.getTag(tagId, tenantFilter);
        tag.setCurrentVersion(versionId);

        return await this.tagRepository.update(tag);
    }

    async deleteTagVersion(versionId: string): Promise<void> {
        await this.tagRepository.deleteVersionById(versionId);
    }
}
