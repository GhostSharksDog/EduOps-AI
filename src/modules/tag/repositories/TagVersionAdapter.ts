import {TagVersion} from '@/modules/tag/domain/entities/TagVersion';
import {TagVersionPO} from '@/modules/tag/repositories/persistence/TagVersionPO';

import {TagValueType} from '@/shared/enums/index';

/**
 * 标签版本适配器接�?
 */
export interface TagVersionAdapter {
    /**
     * 将标签版本持久化对象转换为领域实体
     * @param tagVersionPO 标签版本持久化对象
     * @param context 上下文信息(类型信息)
     * @returns 标签版本领域实体
     */
    fromPOToTagVersionEntity(tagVersionPO: TagVersionPO, context?: { valueType: TagValueType }): TagVersion;

    /**
     * 将标签版本领域实体转换为持久化对象
     * @param tagVersion 标签版本领域实体
     * @returns 标签版本持久化对象
     */
    fromTagVersionEntityToPO(tagVersion: TagVersion): TagVersionPO;
}
