import {TagVersion} from '@/modules/tag/domain/entities/TagVersion';
import {Tag} from '@/modules/tag/domain/entities/Tag';
import {TagVersionVO, TagVO} from '@/modules/tag/contracts/schemas/response/tag/index';
import {TagCategoryVO} from '@/modules/tag/contracts/schemas/response/tag-category/index';
import {TagValueType, UpdateCycle, TagStatus} from '@/shared/enums/index';
import type {FeatureJsonValue} from '@/shared/schemas/common/featureSchema';
import {ITagVersionOHSAdapter} from '@/modules/tag/services/ITagVersionOHSAdapter';
import {config} from "@/platform/config/index";
import type {TagCategory} from '@/modules/tag/domain/entities/TagCategory';

/**
 * 标签版本OHS适配器实现
 */
export class TagVersionOHSAdapterImpl implements ITagVersionOHSAdapter {
    /**
     * 将TagVersion实体转换为TagVersionVO
     * @param version 实体
     * @param tag 关联的Tag实体（可选，用于构建完整的嵌套结构）
     * @returns TagVersionVO
     */
    public fromTagVersionToTagVersionVO(version: TagVersion, tag?: Tag): TagVersionVO {
        const categoryVO = {
            id: '',
            name: '',
            parent: null,
            path: '',
            orderIndex: 0,
            tagCount: 0,
            feature: {},
            isDeleted: false,
            createTime: '',
            children: []
        };

        const tagVO = tag ? this.toTagVOWithoutCurrentVersion(tag) : {
            id: version.tagId,
            name: '',
            description: '',
            category: categoryVO,
            dataType: TagValueType.STRING,
            status: TagStatus.ACTIVE, // 使用 TagStatus 枚举
            updateCycle: UpdateCycle.REALTIME, // 添加默认 updateCycle
            isPublic: true,
            ownedBy: config.system.userId,
            feature: undefined,
            isDeleted: version.isDeleted || false,
            createTime: version.createTime?.toISOString() || '',
            updateTime: version.updateTime?.toISOString() || undefined,
            deleteTime: version.deleteTime?.toISOString() || undefined,
            createdBy: version.createdBy,
            updatedBy: version.updatedBy,
            deletedBy: version.deletedBy
        };

        return {
            id: version.id,
            tag: tagVO,
            version: version.version?.toString() || '',
            description: version.description || '',
            rule: version.rule ? this.toTagRuleVO(version.rule, tag) : undefined,
            calculationRule: version.calculationRule || undefined,
            isCurrent: version.isCurrent,
            isDeleted: version.isDeleted || false,
            feature: (version.feature ?? {}) as unknown as FeatureJsonValue,
            createTime: version.createTime?.toISOString() || '',
            updateTime: version.updateTime?.toISOString() || undefined,
            deleteTime: version.deleteTime?.toISOString() || undefined,
            createdBy: version.createdBy,
            updatedBy: version.updatedBy,
            deletedBy: version.deletedBy,
            enumValues: version.enumValues
        };
    }

    /**
     * 批量转换TagVersion实体列表为TagVersionVO列表
     * @param versions 实体数组
     * @param tags Tag实体映射（可选）
     * @returns TagVersionVO[]
     */
    public fromTagVersionListToTagVersionVOList(versions: TagVersion[], tags?: Map<string, Tag>): TagVersionVO[] {
        return versions.map(v => {
            const tag = tags ? tags.get(v.tagId) : undefined;
            return this.fromTagVersionToTagVersionVO(v, tag);
        });
    }

    /**
     * 将TagCategory实体转换为TagCategoryVO
     * @param category TagCategory实体
     * @returns TagCategoryVO
     */
    private toCategoryVO(category: TagCategory): TagCategoryVO {
        return {
            id: category.id,
            name: category.name || '',
            parent: null,
            path: category.path || '',
            description: category.description || '',
            orderIndex: category.orderIndex || 0,
            tagCount: 0,
            feature: category.feature ?? {},
            isDeleted: category.isDeleted || false,
            createTime: category.createTime?.toISOString() || '',
            updateTime: category.updateTime?.toISOString() || undefined,
            deleteTime: category.deleteTime?.toISOString() || undefined,
            createdBy: category.createdBy,
            updatedBy: category.updatedBy,
            deletedBy: category.deletedBy,
            children: []
        };
    }

    public toTagVO(tag: Tag): TagVO {
        const categoryVO = tag.category ? this.toCategoryVO(tag.category) : {
            id: tag.categoryId || '00000000-0000-0000-0000-000000000000',
            name: '',
            parent: null,
            path: '',
            orderIndex: 0,
            tagCount: 0,
            feature: {},
            isDeleted: false,
            createTime: '',
            children: []
        };

        return {
            id: tag.id,
            name: tag.name,
            description: tag.description,
            category: categoryVO,
            dataType: tag.dataType,
            status: tag.status,
            updateCycle: (tag.updateCycle as UpdateCycle) || UpdateCycle.DAILY,
            isPublic: tag.isPublic ?? true,
            ownedBy: tag.ownedBy,
            feature: (tag.feature ?? {}) as unknown as FeatureJsonValue,
            currentVersion: tag.currentVersion ? {
                id: tag.currentVersion.id,
                tag: this.toTagVOWithoutCurrentVersion(tag),
                version: tag.currentVersion.version?.toString() || '',
                description: tag.currentVersion.description || '',
                rule: tag.currentVersion.rule ? this.toTagRuleVO(tag.currentVersion.rule, tag) : undefined,
                calculationRule: tag.currentVersion.calculationRule || undefined,
                isCurrent: tag.currentVersion.isCurrent,
                isDeleted: tag.currentVersion.isDeleted || false,
                feature: (tag.currentVersion.feature ?? {}) as unknown as FeatureJsonValue,
                createTime: tag.currentVersion.createTime?.toISOString() || '',
                updateTime: tag.currentVersion.updateTime?.toISOString() || undefined,
                deleteTime: tag.currentVersion.deleteTime?.toISOString() || undefined,
                createdBy: tag.currentVersion.createdBy,
                updatedBy: tag.currentVersion.updatedBy,
                deletedBy: tag.currentVersion.deletedBy,
                enumValues: tag.currentVersion.enumValues
            } : undefined,
            bitConfig: tag.bitConfig ? {
                bitmapTableId: tag.bitConfig.bitmapTableId,
                bitPosition: tag.bitConfig.bitPosition,
            } : undefined,
            isDeleted: tag.isDeleted || false,
            createTime: tag.createTime?.toISOString() || '',
            updateTime: tag.updateTime?.toISOString() || undefined,
            deleteTime: tag.deleteTime?.toISOString() || undefined,
            createdBy: tag.createdBy,
            updatedBy: tag.updatedBy,
            deletedBy: tag.deletedBy
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private toTagRuleVO(rule: any, tag?: Tag): any {
        return {
            id: rule.id || '00000000-0000-0000-0000-000000000000',
            tag: tag ? this.toTagVOWithoutCurrentVersion(tag) : null,
            ruleType: rule.ruleType || '',
            ruleContent: rule.ruleContent || '',
            dataModelIds: rule.dataModelIds ?? [],
            feature: (rule.feature ?? {}) as unknown as FeatureJsonValue,
            isDeleted: rule.isDeleted ?? false,
            createTime: rule.createTime ? rule.createTime.toISOString() : new Date(0).toISOString(),
            updateTime: rule.updateTime?.toISOString() || undefined,
            deleteTime: rule.deleteTime?.toISOString() || undefined,
            createdBy: rule.createdBy,
            updatedBy: rule.updatedBy,
            deletedBy: rule.deletedBy
        };
    }

    private toTagVOWithoutCurrentVersion(tag: Tag): TagVO {
        const categoryVO = tag.category ? this.toCategoryVO(tag.category) : {
            id: tag.categoryId || '00000000-0000-0000-0000-000000000000',
            name: '',
            parent: null,
            path: '',
            orderIndex: 0,
            tagCount: 0,
            feature: {},
            isDeleted: false,
            createTime: '',
            children: []
        };

        return {
            id: tag.id,
            name: tag.name,
            description: tag.description,
            category: categoryVO,
            dataType: tag.dataType,
            status: tag.status,
            updateCycle: (tag.updateCycle as UpdateCycle) || UpdateCycle.DAILY,
            isPublic: tag.isPublic ?? true,
            ownedBy: tag.ownedBy,
            feature: (tag.feature ?? {}) as unknown as FeatureJsonValue,
            currentVersion: undefined,
            bitConfig: tag.bitConfig ? {
                bitmapTableId: tag.bitConfig.bitmapTableId,
                bitPosition: tag.bitConfig.bitPosition,
            } : undefined,
            isDeleted: tag.isDeleted || false,
            createTime: tag.createTime?.toISOString() || '',
            updateTime: tag.updateTime?.toISOString() || undefined,
            deleteTime: tag.deleteTime?.toISOString() || undefined,
            createdBy: tag.createdBy,
            updatedBy: tag.updatedBy,
            deletedBy: tag.deletedBy
        };
    }
}
