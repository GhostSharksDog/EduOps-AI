import {TagValue} from '@/modules/tag/domain/entities/TagValue';
import {TagValuePO} from '@/modules/tag/repositories/persistence/TagValuePO';

/**
 * 标签值适配器接口
 */
export interface TagValueAdapter {
    /**
     * 将标签值持久化对象转换为标签值领域实体
     * @param tagValuePO 标签值持久化对象
     * @returns 标签值领域实体
     */
    fromTagValuePOToTagValueEntity(tagValuePO: TagValuePO): TagValue;

    /**
     * 将标签值领域实体转换为标签值持久化对象
     * @param tagValue 标签值领域实体
     * @returns 标签值持久化对象
     */
    fromTagValueEntityToTagValuePO(tagValue: TagValue): TagValuePO;
}
