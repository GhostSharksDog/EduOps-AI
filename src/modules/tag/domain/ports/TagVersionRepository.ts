import { TagVersion } from '@/modules/tag/domain/entities/TagVersion';

/**
 * TagVersion Repository 接口
 * 
 * 架构说明:
 * 1. 定义标签版本持久化操作
 * 2. 隶属于 ACL 层的 Port (接口)
 */
export interface TagVersionRepository {
  /**
   * 保存标签版本
   */
  save(version: TagVersion): Promise<TagVersion>;

  /**
   * 根据 ID 查找标签版本
   */
  findById(id: string): Promise<TagVersion | null>;

  /**
   * 根据标签 ID 查找所有版本
   */
  findByTagId(tagId: string): Promise<TagVersion[]>;

  /**
   * 查找标签的当前激活版本
   */
  findActiveByTagId(tagId: string): Promise<TagVersion | null>;

  /**
   * 更新标签版本
   */
  update(version: TagVersion): Promise<TagVersion>;

  /**
   * 删除标签版本
   */
  delete(id: string): Promise<void>;

  /**
   * 删除标签的所有版本
   */
  deleteByTagId(tagId: string): Promise<void>;
}
