import {TagValue} from '@/modules/tag/domain/entities/TagValue';
import {EntityTagValueVO, TagValueVO} from '@/modules/tag/contracts/schemas/response/tag/index';
import {ITagValueOHSAdapter} from '@/modules/tag/services/ITagValueOHSAdapter';

/**
 * 标签值OHS适配器实现
 * @description 将TagValue实体转换为响应schema，遵循OHS架构的输出规范
 */
export class TagValueOHSAdapterImpl implements ITagValueOHSAdapter {
    /**
     * 将TagValue实体转换为TagValueVO（通过schema验证的类型）
     * @param tagValue 实体
     * @param tagName 标签名称
     * @returns TagValueVO
     */
    public fromTagValueToTagValueVO(tagValue: TagValue, tagName: string): TagValueVO {
        return {
            id: tagValue.id,
            tagId: tagValue.tagId,
            tagName: tagName,
            entityId: tagValue.entityId,
            value: tagValue.value,
            calculatedAt: tagValue.calculatedAt,
            calculatedVersion: tagValue.calculatedVersion,
            status: tagValue.status,
        };
    }

    /**
     * 批量转换TagValue实体列表为TagValueVO列表
     * @param tagValues 实体数组
     * @param tagNames 标签ID到名称的映射
     * @returns TagValueVO[]
     */
    public fromTagValueListToTagValueVOList(tagValues: TagValue[], tagNames: Map<string, string>): TagValueVO[] {
        return tagValues.map(tv => this.fromTagValueToTagValueVO(tv, tagNames.get(tv.tagId) || 'Unknown Tag'));
    }

    /**
     * 将TagValue实体转换为实体维度的标签值响应（通过schema验证的类型）
     * @param tagValue 实体
     * @param tagName 标签名称
     * @returns EntityTagValueVO
     */
    public fromTagValueToEntityTagValueVO(tagValue: TagValue, tagName: string): EntityTagValueVO {
        return {
            entityId: tagValue.entityId,
            tags: [{
                id: tagValue.id,
                tagId: tagValue.tagId,
                tagName: tagName,
                entityId: tagValue.entityId,
                value: tagValue.value,
                calculatedAt: tagValue.calculatedAt,
                calculatedVersion: tagValue.calculatedVersion,
                status: tagValue.status,
            }]
        };
    }
}
