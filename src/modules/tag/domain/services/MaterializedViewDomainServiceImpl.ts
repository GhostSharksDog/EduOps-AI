import { IMaterializedViewDomainService, TagData, TagVersionData } from '@/modules/tag/domain/services/ports/IMaterializedViewDomainService';
import { MvConfig, RefreshInterval } from '@/modules/tag/domain/value-objects/MaterializedViewConfig';
import { IClickHouseClientAdapter } from '@/platform/database/interface/IClickHouseClientAdapter';
import { log } from '@/platform/logger';

  
  export class MaterializedViewDomainServiceImpl implements IMaterializedViewDomainService {
    constructor(private readonly chClient: IClickHouseClientAdapter) {}
  
    async createMv(config: MvConfig, sql?: string): Promise<void> {
      if (config.isCascade) {
        await this.createCascadeMv(config);
      } else {
        if (!sql) {
          throw new Error('单步骤 MV 需要提供 SQL')
        }
        await this.createSingleMv(config, sql)
      }
    }
  
    private async createSingleMv(config: MvConfig, sql: string): Promise<void> {
      log.info('创建单步骤物化视图', {
        mvName: config.mvName,
        mvResultTable: config.mvResultTable,
        isRealtime: config.isRealtime,
      })
  
      await this.chClient.createMaterializedView(
        config.mvName,
        config.mvResultTable,
        config.refreshInterval,
        sql,
        config.isRealtime,
      )
    }
  
    private async createCascadeMv(config: MvConfig): Promise<void> {
      log.info('创建级联物化视图', {
        mvName: config.mvName,
        steps: config.steps.length,
        isRealtime: config.isRealtime,
      })
  
      for (const step of config.steps) {
        const stepSql = step.applyVariableReplacements(step.sql)
  
        log.debug('创建级联步骤', {
          order: step.order,
          mvName: step.mvName,
          stepResultTable: step.stepResultTable,
        })
  
        await this.chClient.createMaterializedView(
          step.mvName,
          step.stepResultTable,
          config.refreshInterval,
          stepSql,
          config.isRealtime,
        )
      }
    }
  
    async deleteMv(config: MvConfig): Promise<void> {
      log.info('删除物化视图', {
        mvName: config.mvName,
        isCascade: config.isCascade,
      })
  
      // 倒序删除 MV（先删最后创建的)
      const mvNames = [...config.allMvNames].reverse()
      for (const mvName of mvNames) {
        try {
          await this.chClient.dropMaterializedView(mvName)
          log.debug('删除物化视图成功', { mvName })
        } catch (error) {
          // 忽略不存在的 MV
          log.warn('删除物化视图失败（可能不存在）', { mvName, error })
        }
      }
  
      // 删除目标表（倒序)
      const tableNames = [...config.allMvResultTables].reverse()
      for (const tableName of tableNames) {
        try {
          await this.chClient.dropTable(tableName)
          log.debug('删除目标表成功', { tableName })
        } catch (error) {
          log.warn('删除目标表失败（可能不存在）', { tableName, error })
        }
      }
    }

    async deleteMvOnly(config: MvConfig): Promise<void> {
      log.info('仅删除物化视图（保留目标表）', { mvName: config.mvName })

      const mvNames = [...config.allMvNames].reverse()
      for (const mvName of mvNames) {
        try {
          await this.chClient.dropMaterializedView(mvName)
          log.debug('删除物化视图成功', { mvName })
        } catch (error) {
          log.warn('删除物化视图失败（可能不存在）', { mvName, error })
        }
      }
    }

    async stopMv(mvNames: string[]): Promise<void> {
      log.info('暂停物化视图', { mvNames })
  
      for (const mvName of mvNames) {
        try {
          await this.chClient.stopView(mvName)
        } catch (error) {
          log.warn('暂停物化视图失败', { mvName, error })
        }
      }
    }
  
    async startMv(mvNames: string[]): Promise<void> {
      log.info('恢复物化视图', { mvNames })
  
      for (const mvName of mvNames) {
        try {
          await this.chClient.startView(mvName)
        } catch (error) {
          log.warn('恢复物化视图失败', { mvName, error })
        }
      }
    }
  
    async getRefreshStatus(mvName: string): Promise<{
      name: string;
      lastRefreshTime?: Date;
      lastException?: string;
      isStale: boolean;
    } | null> {
      const status = await this.chClient.getRefreshStatus(mvName)
  
      if (!status) {
        return null
      }
  
      return {
        name: status.name,
        lastRefreshTime: status.last_refresh_time ? new Date(status.last_refresh_time) : undefined,
        lastException: status.last_exception,
        isStale: Boolean(Number(status.is_stale)),
      }
    }
  
    async getAllMvStatuses(mvNames: string[]): Promise<Map<string, {
      lastRefreshTime?: Date;
      lastException?: string;
      isStale: boolean
    }>> {
      const statusMap = new Map<string, {
        lastRefreshTime?: Date;
        lastException?: string;
        isStale: boolean
      }>()
  
      for (const mvName of mvNames) {
        const status = await this.getRefreshStatus(mvName)
        if (status) {
          statusMap.set(mvName, {
            lastRefreshTime: status.lastRefreshTime,
            lastException: status.lastException,
            isStale: status.isStale
          })
        }
      }
  
      return statusMap
    }
  
    isSevereError(errorMessage: string): boolean {
      const severeKeywords = ['timeout', 'connection', 'out of memory', 'disk full']
      const lowerError = errorMessage.toLowerCase()
      return severeKeywords.some(kw => lowerError.includes(kw))
    }
  
  }
  