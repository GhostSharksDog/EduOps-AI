import { TagRefreshLog } from '@/modules/tag/domain/entities/TagRefreshLog';
import type {TenantFilterOptions} from '@/platform/get-current-tenant';

/**
 * MV 刷新状态报告
 */
export class MvRefreshStatusReport {
  constructor(
    public readonly tagId: string,
    public readonly tagName: string,
    public readonly mvName: string,
    public readonly status: 'healthy' | 'warning' | 'error',
    public readonly lastRefreshTime?: Date,
    public readonly lastException?: string,
    public readonly isStale?: boolean,
    public readonly checkTime: Date = new Date()
  ) {}

  /**
   * 是否需要关注
   */
  needsAttention(): boolean {
    return this.status !== 'healthy';
  }

  /**
   * 获取状态描述
   */
  getStatusDescription(): string {
    switch (this.status) {
      case 'healthy':
        return '运行正常';
      case 'warning':
        return '刷新延迟';
      case 'error':
        return '刷新失败';
    }
  }

  /**
   * 生成告警消息
   */
  generateAlertMessage(): string {
    if (this.status === 'healthy') return '';

    const parts = [`标签 ${this.tagName}(${this.tagId}) 的物化视图 ${this.mvName} ${this.getStatusDescription()}`];

    if (this.lastRefreshTime) {
      const delay = Date.now() - this.lastRefreshTime.getTime();
      const hours = Math.floor(delay / (1000 * 60 * 60));
      const minutes = Math.floor((delay % (1000 * 60 * 60)) / (1000 * 60));
      parts.push(`距离上次刷新: ${hours}小时${minutes}分钟`);
    }

    if (this.lastException) {
      parts.push(`错误信息: ${this.lastException}`);
    }

    return parts.join('\n');
  }
}

/**
 * 监控检查结果
 */
export class MonitorCheckResult {
  constructor(
    public readonly totalChecked: number,
    public readonly healthyCount: number,
    public readonly warningCount: number,
    public readonly errorCount: number,
    public readonly checkDuration: number,
    public readonly checkTime: Date = new Date()
  ) {}

  get summary(): string {
    return (
      `检测 ${this.totalChecked} 个标签: ` +
      `${this.healthyCount} 正常, ` +
      `${this.warningCount} 警告, ` +
      `${this.errorCount} 错误 ` +
      `(${this.checkDuration}ms)`
    );
  }
}

/**
 * 标签刷新监控服务接口
 *
 * 架构说明:
 * 1. 检测 MV 刷新状态
 * 2. 记录异常日志
 * 3. 支持定时任务调度
 */
export interface ITagRefreshMonitorService {
  /**
   * 检测所有活跃标签的 MV 刷新状态
   */
  checkAllRefreshStatus(tenantFilter?: TenantFilterOptions): Promise<MvRefreshStatusReport[]>;

  /**
   * 检测单个标签的 MV 刷新状态
   */
  checkRefreshStatus(tagId: string, tenantFilter?: TenantFilterOptions): Promise<MvRefreshStatusReport>;

  /**
   * 定时任务入口
   */
  scheduledCheck(): Promise<MonitorCheckResult>;

  /**
   * 获取未解决的异常列表
   */
  getUnresolvedErrors(limit?: number, tenantFilter?: TenantFilterOptions): Promise<TagRefreshLog[]>;

  /**
   * 标记异常为已解决
   */
  markErrorResolved(logId: string, tenantFilter?: TenantFilterOptions): Promise<void>;

  isSevereError(errorMessage: string): boolean;
}


