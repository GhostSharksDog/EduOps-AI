import {TagVersion, TagVersionDomainService} from '@/modules/tag/domain/index';
import type {TagRepository} from '@/modules/tag/domain/ports/TagRepository';
import {type UpdateTagVersionDTO} from '@/modules/tag/contracts/schemas/request/tag/index';
import {TagStatus} from '@/shared/enums/index';

export class TagVersionDomainServiceImpl implements TagVersionDomainService {
    constructor(
        private readonly tagRepository: TagRepository
    ) {
    }

    async getVersion(versionId: string): Promise<TagVersion> {
        const version = await this.tagRepository.findVersionById(versionId);
        if (!version) {
            throw new Error(`版本不存在: ${versionId}`);
        }
        return version;
    }

    async updateVersion(versionId: string, versionData: UpdateTagVersionDTO): Promise<TagVersion> {
        const version = await this.getVersion(versionId);

        if (versionData.description) version.updateDescription(versionData.description);
        if (versionData.rule) version.updateRule(versionData.rule);

        return await this.tagRepository.updateVersion(version);
    }

    async listVersions(tagId: string): Promise<TagVersion[]> {
        return await this.tagRepository.findVersionsByTagId(tagId);
    }

    async countVersionsByTagId(tagId: string): Promise<number> {
        return await this.tagRepository.countVersionsByTagId(tagId);
    }

    async getCurrentVersion(tagId: string): Promise<TagVersion> {
        const tag = await this.tagRepository.findById(tagId);
        if (!tag) {
            throw new Error(`标签不存在: ${tagId}`);
        }

        if (tag.currentVersion) {
            return tag.currentVersion;
        }

        if (tag.currentVersionId) {
            return await this.getVersion(tag.currentVersionId);
        }

        throw new Error(`标签未设置当前版本: ${tagId}`);
    }

    async updateVersionStatus(versionId: string, status: TagStatus): Promise<TagVersion> {
        const version = await this.getVersion(versionId);

        if (status === TagStatus.ACTIVE) {
            version.setAsCurrent();
        } else if (status === TagStatus.INACTIVE) {
            version.unsetAsCurrent();
        }

        return await this.tagRepository.updateVersion(version);
    }
}
