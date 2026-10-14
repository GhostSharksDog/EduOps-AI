import {TagCategoryAdapter} from '@/modules/tag/repositories/TagCategoryAdapter';
import {TagCategory} from '@/modules/tag/domain/entities/TagCategory';
import {TagCategoryPO} from '@/modules/tag/repositories/persistence/TagCategoryPO';
import {TagCategoryVO} from "@/shared/schemas/index";

/**
 * 标签分类适配器实现
 * 负责标签分类领域实体与持久化对象之间的转换
 */
export class TagCategoryAdapterImpl implements TagCategoryAdapter {
    /**
     * 将标签分类持久化对象转换为领域实体
     * @param tagCategoryPO 标签分类持久化对象
     * @param tagCount 标签数量（可选，用于响应体）
     * @returns 标签分类领域实体
     */
    fromPOToTagCategoryEntity(tagCategoryPO: TagCategoryPO, tagCount?: number): TagCategory {
        return new TagCategory(
            tagCategoryPO.id,
            tagCategoryPO.name || 'Unnamed Category',
            tagCategoryPO.path,
            tagCategoryPO.order || 0,  // 使用 order 字段
            tagCategoryPO.ownedBy,
            tagCategoryPO.createTime,
            tagCategoryPO.createdBy,
            tagCount || 0,
            tagCategoryPO.feature,
            tagCategoryPO.parentId || undefined,
            undefined,  // parent
            tagCategoryPO.description || undefined,
            [],  // children
            tagCategoryPO.isDeleted || false,
            tagCategoryPO.updateTime || undefined,
            tagCategoryPO.deleteTime || undefined,
            tagCategoryPO.updatedBy || undefined,
            tagCategoryPO.deletedBy || undefined
        );
    }

    /**
     * 将标签分类领域实体转换为持久化对象
     * @param tagCategory 标签分类领域实体
     * @returns 标签分类持久化对象
     */
    fromTagCategoryEntityToPO(tagCategory: TagCategory): TagCategoryPO {
        return {
            id: tagCategory.id,
            name: tagCategory.name,
            path: tagCategory.path,
            order: tagCategory.orderIndex,
            ownedBy: tagCategory.ownedBy,
            description: tagCategory.description || null,
            parentId: tagCategory.parentId || null,
            feature: tagCategory.feature || null,
            isDeleted: tagCategory.isDeleted,
            createTime: tagCategory.createTime,
            updateTime: tagCategory.updateTime || null,
            deleteTime: tagCategory.deleteTime || null,
            createdBy: tagCategory.createdBy,
            updatedBy: tagCategory.updatedBy || null,
            deletedBy: tagCategory.deletedBy || null
        };
    }

    /**
     * 将领域实体转换为 VO (Value Object) 格式
     * 匹配 src/shared/schemas/response/tag-category.ts 中的 tagCategorySchema
     * @param tagCategory 标签分类领域实体
     * @param children 子分类列表（可选）
     * @returns VO 格式的对象
     */
    fromTagCategoryEntityToTagCategoryVO(tagCategory: TagCategory, children?: TagCategory[]): TagCategoryVO {
        return {
            id: tagCategory.id,
            name: tagCategory.name,
            parent: null,
            path: tagCategory.path,
            description: tagCategory.description,
            orderIndex: tagCategory.orderIndex,
            tagCount: tagCategory.tagCount,
            feature: tagCategory.feature ?? {},
            isDeleted: tagCategory.isDeleted || false,
            createTime: tagCategory.createTime.toISOString(),
            updateTime: tagCategory.updateTime?.toISOString(),
            deleteTime: tagCategory.deleteTime?.toISOString(),
            createdBy: tagCategory.createdBy,
            updatedBy: tagCategory.updatedBy,
            deletedBy: tagCategory.deletedBy,
            children: children?.map(child => this.fromTagCategoryEntityToTagCategoryVO(child)) || []
        };
    }
}
