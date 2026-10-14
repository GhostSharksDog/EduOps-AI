import {Tag} from '@/modules/tag/domain/entities/Tag';
import {TagPO} from '@/modules/tag/repositories/persistence/TagPO';
import {TagVersionPO} from '@/modules/tag/repositories/persistence/TagVersionPO';
import {TagCategoryPO} from '@/modules/tag/repositories/persistence/TagCategoryPO';
import {TagVO} from '@/modules/tag/contracts/schemas/response/tag/tagSchema';
import {TagStorageConfigData} from '@/modules/tag/domain/ports/ITagStorageConfigRepository';

/**
 * 标签适配器接口
 */
export interface TagAdapter {
    /**
     * 将标签持久化对象转换为领域实体
     * @param tagPO 标签持久化对象
     * @param versionPOs 标签版本持久化对象数组
     * @param categoryPO 标签分类持久化对象
     * @param storageConfigPO 标签存储配置（用于 bitConfig）
     * @returns 标签领域实体
     */
    fromPOToTagEntity(tagPO: TagPO, versionPOs?: TagVersionPO[], categoryPO?: TagCategoryPO, storageConfigPO?: TagStorageConfigData | null): Tag;

    /**
     * 将标签领域实体转换为持久化对象
     * @param tag 标签领域实体
     * @returns 标签持久化对象
     */
    fromTagToTagPO(tag: Tag): TagPO;

    /**
     * 将领域实体转换为 VO (Value Object) 格式
     * 匹配 src/shared/schemas/response/tag/tagSchema.ts 中的 tagSchema
     * @param tag 标签领域实体
     * @returns VO 格式的对象
     */
    fromTagToTagVO(tag: Tag): TagVO;
}
