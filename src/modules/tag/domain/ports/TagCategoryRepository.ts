import { TagCategory } from '@/modules/tag/domain/entities/TagCategory';

/**
 * TagCategory Repository 接口
 * 
 * 架构说明:
 * 1. 定义标签分类持久化操作
 * 2. 隶属于 ACL 层的 Port (接口)
 */
export interface TagCategoryRepository {
  /**
   * 保存标签分类
   */
  save(category: TagCategory): Promise<TagCategory>;

  /**
   * 根据 ID 查找标签分类
   */
  findById(id: string): Promise<TagCategory | null>;

  /**
   * 查找所有标签分类
   */
  findAll(): Promise<TagCategory[]>;

  /**
   * 根据名称查找标签分类
   */
  findByName(name: string): Promise<TagCategory | null>;

  /**
   * 更新标签分类
   */
  update(category: TagCategory): Promise<TagCategory>;

  /**
   * 删除标签分类
   */
  delete(id: string): Promise<void>;
}
