import { SyncState, SyncResult, BatchSyncResult, CreateSyncStateCommand } from '@/modules/tag/domain/services/dto/TagBitmapSyncDto';

/**
 * Tag Bitmap 同步领域服务接口
 *
 * 负责管理 tag_value → tag_bitmap 的同步流程
 * 包含：全量同步、增量同步、状态管理、版本追踪
 */
export interface ITagBitmapSyncDomainService {
  /**
   * 同步单个标签的 bitmap
   * 根据当前状态自动判断全量/增量同步
   *
   * @param tagId 标签 ID
   * @param ownedBy 租户 ID（多租户过滤）
   * @returns 同步结果
   */
  syncTagBitmap(tagId: string, ownedBy: string): Promise<SyncResult>;

  /**
   * 批量同步多个标签
   * 按租户分组，限制并发数
   *
   * @param tagIds 标签 ID 列表
   * @param ownedBy 租户 ID
   * @returns 批量同步结果
   */
  syncTagBitmaps(tagIds: string[], ownedBy: string): Promise<BatchSyncResult>;

  /**
   * 获取标签的同步状态
   *
   * @param tagId 标签 ID
   * @param ownedBy 租户 ID
   * @returns 同步状态，不存在返回 null
   */
  getSyncState(tagId: string, ownedBy: string): Promise<SyncState | null>;

  /**
   * 创建同步状态记录
   * 在标签激活时调用，创建 PENDING 状态
   *
   * @param command 创建命令
   * @returns 创建的同步状态
   */
  createSyncState(command: CreateSyncStateCommand): Promise<SyncState>;

  /**
   * 标记为过时（版本变更/标签停用时调用）
   * 将状态设为 OBSOLETE，终止态不可转换
   *
   * @param tagId 标签 ID
   * @param ownedBy 租户 ID
   */
  markObsolete(tagId: string, ownedBy: string): Promise<void>;
}
