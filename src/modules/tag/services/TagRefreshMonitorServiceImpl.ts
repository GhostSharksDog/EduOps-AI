import {
  ITagRefreshMonitorService,
  MvRefreshStatusReport,
  MonitorCheckResult,
} from '@/modules/tag/services/TagRefreshMonitorService';
import { TagRefreshLog } from '@/modules/tag/domain/entities/TagRefreshLog';
import { TagDomainService } from '@/modules/tag/domain/services/ports/TagDomainService';
import { IMaterializedViewDomainService } from '@/modules/tag/domain/services/ports/IMaterializedViewDomainService';
import { ITagRefreshLogRepository } from '@/modules/tag/domain/ports/ITagRefreshLogRepository';
import { IMaterializedViewConfigRepository } from '@/modules/tag/domain/ports/IMaterializedViewConfigRepository';
import { log } from '@/platform/logger';
import { randomUUID } from 'crypto';
import { config } from '@/platform/config/index';
import type {TenantFilterOptions} from '@/platform/get-current-tenant';

export class TagRefreshMonitorServiceImpl implements ITagRefreshMonitorService {
  constructor(
    private readonly tagDomainService: TagDomainService,
    private readonly mvDomainService: IMaterializedViewDomainService,
    private readonly refreshLogRepository: ITagRefreshLogRepository,
    private readonly mvConfigRepository: IMaterializedViewConfigRepository
  ) {}

  async checkAllRefreshStatus(tenantFilter?: TenantFilterOptions): Promise<MvRefreshStatusReport[]> {
    const reports: MvRefreshStatusReport[] = [];

    const configs = (await this.mvConfigRepository.findAllWithTagName(tenantFilter)).filter(row=>!tenantFilter?.tenantId || row.ownedBy===tenantFilter.tenantId);

    for (const config of configs) {
      try {
        // 获取标签当前版本，校正 MV 名称
        let mvName = config.mvName;
        try {
          const tag = await this.tagDomainService.getTag(config.tagId,tenantFilter);
          if (tag?.currentVersion) {
            const expectedMvName = `mv_tag_${config.tagId}_v${tag.currentVersion.version}`;
            if (mvName !== expectedMvName) {
              mvName = expectedMvName;
            }
          }
        } catch {
          // 获取标签失败则使用 DB 中存储的名称
        }

        const status = await this.mvDomainService.getRefreshStatus(mvName);

        if (!status) {
          reports.push(
            new MvRefreshStatusReport(
              config.tagId,
              config.tagName,
              mvName,
              'error',
              undefined,
              '物化视图不存在',
              false
            )
          );
          continue;
        }

        const { reportStatus, errorMsg } = this.evaluateStatus(status);

        await this.recordStatusChange(config.tagId, mvName, reportStatus, errorMsg,config.ownedBy);

        reports.push(
          new MvRefreshStatusReport(
            config.tagId,
            config.tagName,
            mvName,
            reportStatus,
            status.lastRefreshTime,
            errorMsg,
            status.isStale
          )
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '检查失败';
        log.error('检查 MV 状态失败', { mvName: config.mvName, error: errorMsg });
        reports.push(
          new MvRefreshStatusReport(
            config.tagId,
            config.tagName,
            config.mvName,
            'error',
            undefined,
            errorMsg,
            false
          )
        );
      }
    }

    return reports;
  }

  async checkRefreshStatus(tagId: string,tenantFilter?: TenantFilterOptions): Promise<MvRefreshStatusReport> {
    try {
      const tag = await this.tagDomainService.getTag(tagId,tenantFilter);
      if (!tag) {
        return new MvRefreshStatusReport(tagId, '未知标签', '未知MV', 'error', undefined, '标签不存在');
      }

      if (!tag.currentVersion) {
        return new MvRefreshStatusReport(
          tagId,
          tag.name ?? '未知标签',
          '未知MV',
          'error',
          undefined,
          '标签没有当前版本'
        );
      }

      // 用当前版本号构建正确的 MV 名称，避免 DB 中残留旧版本配置
      const expectedMvName = `mv_tag_${tagId}_v${tag.currentVersion.version}`;
      const configs = await this.mvConfigRepository.findByTagId(tagId,tenantFilter);

      // 优先使用 DB 配置中的 MV 名称，但校验版本是否匹配
      let mvName: string;
      if (configs.length > 0 && configs[0].mvName === expectedMvName) {
        mvName = configs[0].mvName;
      } else {
        // DB 配置缺失或版本不匹配，使用当前版本构建的名称
        mvName = expectedMvName;
      }

      const status = await this.mvDomainService.getRefreshStatus(mvName);

      if (!status) {
        return new MvRefreshStatusReport(
          tagId,
          tag.name ?? '未知标签',
          mvName,
          'error',
          undefined,
          '物化视图不存在'
        );
      }

      const { reportStatus, errorMsg } = this.evaluateStatus(status);

      await this.recordStatusChange(tagId, mvName, reportStatus, errorMsg,tag.ownedBy);

      return new MvRefreshStatusReport(
        tagId,
        tag.name ?? '',
        mvName,
        reportStatus,
        status.lastRefreshTime,
        errorMsg,
        status.isStale
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '检查失败';
      log.error('检查标签状态失败', { tagId, error: errorMsg });
      return new MvRefreshStatusReport(tagId, '未知标签', '未知MV', 'error', undefined, errorMsg);
    }
  }

  async scheduledCheck(): Promise<MonitorCheckResult> {
    const startTime = Date.now();

    log.info('开始定时检查 MV 刷新状态');

    const reports = await this.checkAllRefreshStatus();

    const healthyCount = reports.filter((r) => r.status === 'healthy').length;
    const warningCount = reports.filter((r) => r.status === 'warning').length;
    const errorCount = reports.filter((r) => r.status === 'error').length;

    const result = new MonitorCheckResult(
      reports.length,
      healthyCount,
      warningCount,
      errorCount,
      Date.now() - startTime
    );

    log.info(result.summary);

    if (errorCount > 0) {
      const errorReports = reports.filter((r) => r.status === 'error');
      log.error('MV 刷新错误详情', {
        errors: errorReports.map((r) => ({
          tagId: r.tagId,
          tagName: r.tagName,
          mvName: r.mvName,
          error: r.lastException,
        })),
      });
    }

    return result;
  }

  async getUnresolvedErrors(limit: number = 100,tenantFilter?: TenantFilterOptions): Promise<TagRefreshLog[]> {
    const logs = await this.refreshLogRepository.findUnresolved(limit,tenantFilter);
    return logs.map((logEntry) =>
      TagRefreshLog.fromData({
        id: logEntry.id,
        tagId: logEntry.tagId,
        mvName: logEntry.mvName,
        ownedBy: logEntry.ownedBy,
        errorMessage: logEntry.errorMessage,
        occurredAt: logEntry.occurredAt,
        isResolved: logEntry.isResolved,
        createTime: logEntry.createTime,
      })
    );
  }

  async markErrorResolved(logId: string,tenantFilter?: TenantFilterOptions): Promise<void> {
    await this.refreshLogRepository.markResolved(logId,tenantFilter);
    log.info('异常已标记为已解决', { logId });
  }

  isSevereError(errorMessage: string): boolean {
    return this.mvDomainService.isSevereError(errorMessage);
  }

  private evaluateStatus(status: {
    name: string;
    lastRefreshTime?: Date;
    lastException?: string;
    isStale: boolean;
  }): { reportStatus: 'healthy' | 'warning' | 'error'; errorMsg?: string } {
    if (status.isStale) {
      return {
        reportStatus: 'error',
        errorMsg: '物化视图处于 stale 状态',
      };
    }

    if (status.lastException) {
      return {
        reportStatus: 'error',
        errorMsg: status.lastException,
      };
    }

    if (status.lastRefreshTime) {
      const now = Date.now();
      const elapsed = now - status.lastRefreshTime.getTime();
      const timeoutThreshold = 2 * 60 * 60 * 1000;

      if (elapsed > timeoutThreshold) {
        return {
          reportStatus: 'warning',
          errorMsg: `刷新超时: ${Math.floor(elapsed / (60 * 1000))} 分钟未刷新`,
        };
      }
    }

    return { reportStatus: 'healthy' };
  }

  private async recordStatusChange(
    tagId: string,
    mvName: string,
    reportStatus: 'healthy' | 'warning' | 'error',
    errorMsg?: string,
    ownedBy?: string,
  ): Promise<void> {
    const hasUnresolved = await this.refreshLogRepository.hasUnresolvedError(tagId, mvName);
    const isUnhealthy = reportStatus !== 'healthy';

    if (isUnhealthy && !hasUnresolved) {
      const logData = {
        id: randomUUID(),
        tagId,
        mvName,
        errorMessage: errorMsg,
        occurredAt: new Date(),
        isResolved: false,
        createTime: new Date(),
        ownedBy: ownedBy??config.system.userId,
      };
      await this.refreshLogRepository.create(logData);
    } else if (!isUnhealthy && hasUnresolved) {
      await this.refreshLogRepository.markResolvedByTagAndMv(tagId, mvName);
    }
  }
}
