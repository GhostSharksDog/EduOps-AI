import type {TenantFilterOptions} from '@/platform/get-current-tenant';

/**
 * 标签刷新日志数据
 * 用于领域层的刷新日志数据
 */
export interface TagRefreshLogData {
  id: string;
  tagId: string;
  mvName: string;
  ownedBy: string;
  errorMessage?: string;
  occurredAt: Date;
  isResolved: boolean;
  createTime: Date;
}

/**
 * 标签刷新日志 Repository 接口
 *
 * 架构说明:
 * 1. 定义 MV 刷新异常日志的持久化操作
 * 2. 用于监控和告警功能
 *
 * 实现约束:
 * - 使用 PostgreSQL 存储
 * - 需支持按标签 ID 和解决状态查询
 */
export interface ITagRefreshLogRepository {
  /**
   * 创建刷新日志
   */
  create(data: TagRefreshLogData): Promise<TagRefreshLogData>;

  /**
   * 根据标签 ID 查询日志
   */
  findByTagId(tagId: string, limit?: number): Promise<TagRefreshLogData[]>;

  /**
   * 查询未解决的日志
   */
  findUnresolved(limit?: number, tenantFilter?: TenantFilterOptions): Promise<TagRefreshLogData[]>;

  /**
   * 检查是否存在未解决的相同错误
   */
  hasUnresolvedError(tagId: string, mvName: string): Promise<boolean>;

  /**
   * 查询最近的日志
   */
  findRecent(limit?: number): Promise<TagRefreshLogData[]>;

  /**
   * 标记为已解决
   */
  markResolved(id: string, tenantFilter?: TenantFilterOptions): Promise<void>;

  /**
   * 批量标记已解决
   */
  markResolvedBatch(ids: string[]): Promise<void>;

  /**
   * 标记某 (tagId, mvName) 的所有未解决日志为已解决（状态恢复 healthy 时调用）
   * @returns 更新的记录数
   */
  markResolvedByTagAndMv(tagId: string, mvName: string): Promise<number>;

  /**
   * 删除标签的所有日志
   */
  deleteByTagId(tagId: string): Promise<void>;

  /**
   * 清理过期日志
   * @param days 保留天数
   * @returns 删除的记录数
   */
  deleteOlderThan(days: number): Promise<number>;
}

