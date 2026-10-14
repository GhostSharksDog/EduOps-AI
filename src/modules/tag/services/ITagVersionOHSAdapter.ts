import {TagVersion} from '@/modules/tag/domain/entities/TagVersion';
import {Tag} from '@/modules/tag/domain/entities/Tag';
import {TagVersionVO} from '@/modules/tag/contracts/schemas/response/tag/index';

/**
 * 标签版本OHS适配器接口
 * @description 负责TagVersion实体与DTO之间的转换
 */
export interface ITagVersionOHSAdapter {
    /**
     * 将TagVersion实体转换为TagVersionVO
     * @param version 实体
     * @param tag 关联的Tag实体（可选，用于构建完整的嵌套结构）
     * @returns TagVersionVO
     */
    fromTagVersionToTagVersionVO(version: TagVersion, tag?: Tag): TagVersionVO;

    /**
     * 批量转换TagVersion实体列表为TagVersionVO列表
     * @param versions 实体数组
     * @param tags Tag实体映射（可选）
     * @returns TagVersionVO[]
     */
    fromTagVersionListToTagVersionVOList(versions: TagVersion[], tags?: Map<string, Tag>): TagVersionVO[];
}
