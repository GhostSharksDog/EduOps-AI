import { MvConfig } from '@/modules/tag/domain/value-objects/MaterializedViewConfig';

/**
 * 标签数据（简化接口）
 */
export interface TagData {
  id: string;
  updateCycle: string;
}

/**
 * 标签版本数据（简化接口）
 */
export interface TagVersionData {
  id: string;
  version: number;
  calculationRule: string;
}

/**
 * 物化视图领域服务接口
 *
 * 架构说明:
 * 1. 封装物化视图的核心操作
 * 2. 支持创建、删除、暂停、恢复 MV
 * 3. 支持级联 MV 管理
 */
export interface IMaterializedViewDomainService {
  /**
   * 创建物化视图
   * @param config MV 配置
   * @param sql 查询 SQL（单步骤时使用）
   * @throws {Error} 创建失败时抛出
   */
  createMv(config: MvConfig, sql?: string): Promise<void>;

  /**
   * 删除物化视图（包括级联 MV 和目标表）
   */
  deleteMv(config: MvConfig): Promise<void>;

  /**
   * 只删除物化视图，保留目标表
   */
  deleteMvOnly(config: MvConfig): Promise<void>;

  /**
   * 暂停物化视图刷新
   */
  stopMv(mvNames: string[]): Promise<void>;

  /**
   * 恢复物化视图刷新
   */
  startMv(mvNames: string[]): Promise<void>;

  /**
   * 查询 MV 刷新状态
   */
  getRefreshStatus(mvName: string): Promise<{
    name: string;
    lastRefreshTime?: Date;
    lastException?: string;
    isStale: boolean;
  } | null>;

  /**
   * 批量查询 MV 刷新状态
   */
  getAllMvStatuses(mvNames: string[]): Promise<Map<string, {
    lastRefreshTime?: Date;
    lastException?: string;
    isStale: boolean;
  }>>;

  /**
   * 判断错误是否严重
   */
  isSevereError(errorMessage: string): boolean;
}

