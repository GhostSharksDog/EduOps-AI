import {TagCategory} from '@/modules/tag/domain/entities/TagCategory';
import {TagCategoryPO} from '@/modules/tag/repositories/persistence/TagCategoryPO';
import {TagCategoryVO} from '@/modules/tag/contracts/schemas/response/tag-category/tagCategorySchema';

/**
 * 标签分类适配器接口
 */
export interface TagCategoryAdapter {
    /**
     * 将标签分类持久化对象转换为领域实体
     * @param tagCategoryPO 标签分类持久化对象
     * @param tagCount 标签数量（可选，用于VO）
     * @returns 标签分类领域实体
     */
    fromPOToTagCategoryEntity(tagCategoryPO: TagCategoryPO, tagCount?: number): TagCategory;

    /**
     * 将标签分类领域实体转换为持久化对象
     * @param tagCategory 标签分类领域实体
     * @returns 标签分类持久化对象
     */
    fromTagCategoryEntityToPO(tagCategory: TagCategory): TagCategoryPO;

    /**
     * 将领域实体转换为 VO (Value Object) 格式
     * 匹配 src/shared/schemas/response/tag-category.ts 中的 tagCategorySchema
     * @param tagCategory 标签分类领域实体
     * @param children 子分类列表（可选）
     * @returns VO 格式的对象
     */
    fromTagCategoryEntityToTagCategoryVO(tagCategory: TagCategory, children?: TagCategory[]): TagCategoryVO;
}
