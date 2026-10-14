import {TagAdapter} from '@/modules/tag/repositories/TagAdapter';
import {Tag, BitConfig} from '@/modules/tag/domain/entities/Tag';
import {TagPO} from '@/modules/tag/repositories/persistence/TagPO';
import {TagVersionPO} from '@/modules/tag/repositories/persistence/TagVersionPO';
import {TagCategoryPO} from '@/modules/tag/repositories/persistence/TagCategoryPO';
import {TagVersionAdapterImpl} from '@/modules/tag/repositories/TagVersionAdapterImpl';
import {TagCategoryAdapterImpl} from '@/modules/tag/repositories/TagCategoryAdapterImpl';
import {TagStatus, TagValueType, UpdateCycle} from '@/shared/enums/index';
import {TagVO} from '@/modules/tag/contracts/schemas/response/tag/tagSchema';
import {TagStorageConfigData} from '@/modules/tag/domain/ports/ITagStorageConfigRepository';

/**
 * 标签适配器实现
 * 负责标签领域实体与持久化对象之间的转换
 */
export class TagAdapterImpl implements TagAdapter {
    private tagVersionAdapter = new TagVersionAdapterImpl();
    private tagCategoryAdapter = new TagCategoryAdapterImpl();

    fromPOToTagEntity(tagPO: TagPO, versionPOs?: TagVersionPO[], categoryPO?: TagCategoryPO, storageConfigPO?: TagStorageConfigData | null): Tag {
        const versions = versionPOs?.map(po => this.tagVersionAdapter.fromPOToTagVersionEntity(po)) || [];

        let currentVersion: typeof versions[0] | undefined;
        if (tagPO.currentVersionId) {
            const found = versions.find(v => v.id === tagPO.currentVersionId);
            currentVersion = found;
        } else {
            currentVersion = undefined;
        }

        let category = undefined;
        if (categoryPO) {
            category = this.tagCategoryAdapter.fromPOToTagCategoryEntity(categoryPO);
        }

        let bitConfig: BitConfig | undefined = undefined;
        if (storageConfigPO?.bitmapTableId && storageConfigPO?.bitPosition !== undefined && storageConfigPO?.bitPosition !== null) {
            bitConfig = {
                bitmapTableId: storageConfigPO.bitmapTableId,
                bitPosition: storageConfigPO.bitPosition
            };
        }

        const dataType = (tagPO.valueType as TagValueType | undefined) || TagValueType.STRING;

        return new Tag(
            tagPO.id,
            tagPO.name || 'Unnamed Tag',
            dataType,
            (tagPO.status as TagStatus) || TagStatus.DRAFT,
            (tagPO.update_cycle as UpdateCycle) || UpdateCycle.DAILY,
            tagPO.ownedBy,
            tagPO.categoryId || '',
            tagPO.createTime,
            tagPO.createdBy,
            tagPO.isPublic || false,
            tagPO.description || undefined,
            category,
            tagPO.feature,
            bitConfig,
            tagPO.currentVersionId || undefined,
            currentVersion,
            versions,
            tagPO.isDeleted || false,
            tagPO.updateTime || undefined,
            tagPO.deleteTime || undefined,
            tagPO.updatedBy || undefined,
            tagPO.deletedBy || undefined
        );
    }

    /**
     * 将标签领域实体转换为持久化对象
     * @description 负责将标签领域实体转换为数据库持久化对象
     * @param tag 标签领域实体
     * @returns 标签持久化对象
     */
    fromTagToTagPO(tag: Tag): TagPO {
        return {
            id: tag.id,
            currentVersionId: tag.currentVersionId || null,
            categoryId: tag.categoryId,
            valueType: tag.dataType,
            name: tag.name,
            ownedBy: tag.ownedBy,
            description: tag.description || null,
            status: tag.status || TagStatus.DRAFT,
            isDeleted: tag.isDeleted || false,
            isPublic: tag.isPublic || false,
            feature: tag.feature || {},
            update_cycle: tag.updateCycle || UpdateCycle.DAILY,
            createTime: tag.createTime,
            updateTime: tag.updateTime || null,
            deleteTime: tag.deleteTime || null,
            createdBy: tag.createdBy ?? null,
            updatedBy: tag.updatedBy || null,
            deletedBy: tag.deletedBy || null
        };
    }

    /**
     * 将领域实体转换为 VO (Value Object) 格式
     * 匹配 src/shared/schemas/response/tag/tagSchema.ts 中的 tagSchema
     * @param tag 标签领域实体
     * @returns VO 格式的对象
     */
    fromTagToTagVO(tag: Tag): TagVO {
        return {
            id: tag.id,
            name: tag.name,
            description: tag.description ?? undefined,
            category: tag.category ? this.tagCategoryAdapter.fromTagCategoryEntityToTagCategoryVO(tag.category) : null,
            dataType: tag.dataType,
            status: tag.status,
            updateCycle: tag.updateCycle,
            isPublic: tag.isPublic,
            ownedBy: tag.ownedBy,
            feature: tag.feature as unknown as TagVO['feature'],
            currentVersion: tag.currentVersion,
            isDeleted: tag.isDeleted || false,
            createTime: tag.createTime.toISOString(),
            updateTime: tag.updateTime?.toISOString(),
            deleteTime: tag.deleteTime?.toISOString(),
            createdBy: tag.createdBy,
            updatedBy: tag.updatedBy,
            deletedBy: tag.deletedBy
        };
    }
}
