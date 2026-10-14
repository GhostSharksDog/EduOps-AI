import {TagValue} from '@/modules/tag/domain/entities/TagValue';
import {EntityTagValueVO, TagValueVO} from '@/modules/tag/contracts/schemas/response/tag/index';

/**
 * 标签值OHS适配器接口
 * @description 负责将TagValue实体转换为响应schema，遵循OHS架构的输出规范
 */
export interface ITagValueOHSAdapter {
    /**
     * 将TagValue实体转换为TagValueVO（通过schema验证的类型）
     * @param tagValue 实体
     * @param tagName 标签名称（实体中不包含，需外部传入）
     * @returns TagValueVO
     */
    fromTagValueToTagValueVO(tagValue: TagValue, tagName: string): TagValueVO;

    /**
     * 批量转换TagValue实体列表为TagValueVO列表
     * @param tagValues 实体数组
     * @param tagNames 标签ID到名称的映射
     * @returns TagValueVO[]
     */
    fromTagValueListToTagValueVOList(tagValues: TagValue[], tagNames: Map<string, string>): TagValueVO[];

    /**
     * 将TagValue实体转换为实体维度的标签值响应（通过schema验证的类型）
     * @param tagValue 实体
     * @param tagName 标签名称
     * @returns EntityTagValueVO
     */
    fromTagValueToEntityTagValueVO(tagValue: TagValue, tagName: string): EntityTagValueVO;
}
