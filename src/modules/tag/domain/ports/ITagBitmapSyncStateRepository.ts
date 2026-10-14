/**
 * TagBitmapSyncState Repository 接口
 * 管理标签 Bitmap 同步状态追踪
 */

import { SyncState, SyncStatus, CreateSyncStateData, UpdateSyncStateData } from '@/modules/tag/domain/services/dto/TagBitmapSyncDto';

/**
 * TagBitmapSyncState 持久化操作接口
 *
 * 架构说明:
 * 1. 定义标签 Bitmap 同步状态的持久化操作
 * 2. 用于同步状态管理、增量同步检测、版本不一致发现
 *
 * 实现约束:
 * - 所有查询必须过滤 ownedBy（多租户）和 deleteTime IS NULL（软删除）
 * - 复杂查询使用 $queryRaw，简单 CRUD 使用 数据库 ORM
 */
export interface ITagBitmapSyncStateRepository {
  /**
   * 根据标签 ID 查询同步状态
   * @param tagId 标签 ID
   * @param ownedBy 租户 ID
   * @returns 同步状态，不存在则返回 null
   */
  findByTagId(tagId: string, ownedBy: string): Promise<SyncState | null>;

  /**
   * 根据同步状态查询（支持多状态）
   * @param statuses 同步状态列表
   * @param ownedBy 租户 ID
   * @returns 匹配的同步状态列表
   */
  findByStatus(statuses: SyncStatus[], ownedBy: string): Promise<SyncState[]>;

  /**
   * 查询需要增量同步的状态
   * 查找 SYNCED 状态但 MV 已刷新且刷新日志未解决的记录
   * @param ownedBy 租户 ID
   * @returns 需要增量同步的状态列表
   */
  findNeedsIncrementalSync(ownedBy: string): Promise<SyncState[]>;

  /**
   * 查询标签版本不一致的状态
   * 查找标签当前版本与同步状态记录版本不匹配的记录
   * @param ownedBy 租户 ID
   * @returns 版本不一致的状态列表
   */
  findByTagVersionMismatch(ownedBy: string): Promise<SyncState[]>;

  /**
   * 创建同步状态记录
   * @param data 创建数据
   * @returns 创建的同步状态
   */
  create(data: CreateSyncStateData): Promise<SyncState>;

  /**
   * 更新同步状态（局部更新）
   * @param id 记录 ID
   * @param data 更新数据（仅更新提供的字段）
   */
  update(id: string, data: UpdateSyncStateData): Promise<void>;

  /**
   * 软删除同步状态记录
   * @param id 记录 ID
   * @param deletedBy 删除者 ID
   */
  softDelete(id: string, deletedBy: string): Promise<void>;

  /**
   * 查询所有不重复的租户 ID
   * 用于定时任务遍历所有租户
   * @returns 租户 ID 列表
   */
  findDistinctOwnedBy(): Promise<string[]>;
}
