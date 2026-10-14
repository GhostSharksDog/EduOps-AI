import { ITagBitmapSyncDomainService } from '@/modules/tag/domain/services/ports/ITagBitmapSyncDomainService';
import { ITagBitmapSyncStateRepository } from '@/modules/tag/domain/ports/ITagBitmapSyncStateRepository';
import { ITagStorageConfigRepository } from '@/modules/tag/domain/ports/ITagStorageConfigRepository';
import { IClickHouseClientAdapter } from '@/platform/database/interface/IClickHouseClientAdapter';
import { TagRepository } from '@/modules/tag/domain/ports/TagRepository';
import { ITargetTableRepository } from '@/modules/tag/domain/ports/ITargetTableRepository';
import { log } from '@/platform/logger';
import type {
  SyncState,
  SyncResult,
  BatchSyncResult,
  SyncStatus,
  SyncType,
  CreateSyncStateCommand,
  CreateSyncStateData,
} from '@/modules/tag/domain/services/dto/TagBitmapSyncDto';

/**
 * 状态机：合法的状态转换
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  'PENDING': ['SYNCING', 'OBSOLETE'],
  'SYNCING': ['SYNCED', 'FAILED'],
  'SYNCED': ['SYNCING', 'OBSOLETE'],      // MV 刷新后 → 重新同步
  'FAILED': ['SYNCING', 'OBSOLETE'],      // 重试
  'OBSOLETE': [],             // 终止态，不可转换
};

/** 最大重试次数 */
const MAX_RETRIES = 3;

/**
 * Tag Bitmap 同步领域服务实现
 *
 * 职责：
 * 1. 管理 tag_value → tag_bitmap 的同步流程
 * 2. 支持全量同步和增量同步
 * 3. 状态机驱动的同步状态管理
 * 4. 版本漂移检测
 */
export class TagBitmapSyncDomainServiceImpl implements ITagBitmapSyncDomainService {
  constructor(
    private readonly syncStateRepository: ITagBitmapSyncStateRepository,
    private readonly tagStorageConfigRepository: ITagStorageConfigRepository,
    private readonly clickHouseClient: IClickHouseClientAdapter,
    private readonly tagRepository: TagRepository,
    private readonly targetTableRepository: ITargetTableRepository,
  ) {}

  /**
   * 同步单个标签的 bitmap
   * 根据当前状态自动判断全量/增量同步
   */
  async syncTagBitmap(tagId: string, ownedBy: string): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      // 1. 获取标签存储配置（BOOLEAN: 1条, ENUM: N条）
      const storageConfigs = await this.tagStorageConfigRepository.findAllByTagId(tagId);
      if (!storageConfigs || storageConfigs.length === 0) {
        throw new Error(`标签未配置存储: ${tagId}`);
      }

      // BOOLEAN/NUMBER/DATE/STRING: 只同步第一条配置
      const primaryConfig = storageConfigs[0];
      if (primaryConfig.bitPosition === null || primaryConfig.bitPosition === undefined) {
        throw new Error(`标签未分配 Bit 位置: ${tagId}`);
      }

      const { bitmapTableName, bitPosition } = primaryConfig;

      // 2.5 获取关联的 TargetTable
      const targetTable = await this.targetTableRepository.findByTagId(tagId);
      if (!targetTable) {
        throw new Error(`标签未关联目标表: ${tagId}`);
      }
      const sourceTableName = targetTable.tableName;

      // 2. 获取或创建同步状态
      let syncState = await this.syncStateRepository.findByTagId(tagId, ownedBy);
      if (!syncState) {
        // 获取标签当前版本
        const tag = await this.tagRepository.findById(tagId);
        const tagVersion = tag?.currentVersionId ?? '';

        syncState = await this.syncStateRepository.create({
          tagId,
          tagVersion,
          ownedBy,
          syncStatus: 'PENDING',
        });
        log.info('创建同步状态', { tagId, tagVersion });
      }

      // 3. 状态检查
      if (syncState.syncStatus === 'SYNCING') {
        log.warn('标签正在同步中，跳过', { tagId });
        return {
          success: false,
          tagId,
          syncedCount: 0,
          syncType: 'FULL',
          durationMs: Date.now() - startTime,
          error: '正在同步中',
        };
      }

      if (syncState.syncStatus === 'OBSOLETE') {
        log.warn('标签同步状态已过期，跳过', { tagId });
        return {
          success: false,
          tagId,
          syncedCount: 0,
          syncType: 'FULL',
          durationMs: Date.now() - startTime,
          error: '状态已过期',
        };
      }

      // 4. 版本漂移检测
      const tag = await this.tagRepository.findById(tagId);
      if (!tag) {
        throw new Error(`标签不存在: ${tagId}`);
      }
      const currentVersionId = tag.currentVersionId ?? '';
      if (syncState.tagVersion !== currentVersionId && currentVersionId !== '') {
        log.info('检测到版本漂移，标记过时', {
          tagId,
          oldVersion: syncState.tagVersion,
          newVersion: currentVersionId,
        });
        // 通过 markObsolete 统一走状态机验证
        await this.markObsolete(tagId, ownedBy);
        // 创建新的 PENDING 状态
        syncState = await this.syncStateRepository.create({
          tagId,
          tagVersion: currentVersionId,
          ownedBy,
          syncStatus: 'PENDING',
        });
      }

      // 5. 判断全量/增量
      const { incremental, lastSyncTime } = this.determineSyncType(syncState);
      const syncType: SyncType = incremental ? 'INCREMENTAL' : 'FULL';

      // 6. 状态转换：→ SYNCING
      this.validateTransition(syncState.syncStatus, 'SYNCING');
      await this.syncStateRepository.update(syncState.id, {
        syncStatus: 'SYNCING',
      });
      log.info('开始同步标签 bitmap', { tagId, syncType, bitPosition });

      // 7. 执行 ClickHouse 同步
      const result = await this.clickHouseClient.syncTagBitmap({
        bitmapTableName,
        sourceTableName,
        bitPosition: bitPosition!,
        incremental,
        lastSyncTime: lastSyncTime ?? undefined,
      });

      // 8. 获取 MV 刷新状态
      const mvName = `tag_mv_${tagId}`;
      let mvLastRefreshTime: Date | null = null;
      try {
        const refreshStatus = await this.clickHouseClient.getRefreshStatus(mvName);
        if (refreshStatus?.last_refresh_time) {
          mvLastRefreshTime = new Date(refreshStatus.last_refresh_time);
        }
      } catch (e) {
        log.warn('获取 MV 刷新状态失败', { tagId, mvName, error: e });
      }

      // 9. 更新状态：成功 → SYNCED
      await this.syncStateRepository.update(syncState.id, {
        syncStatus: 'SYNCED',
        lastSyncTime: new Date(),
        lastSyncedCount: result.affectedRows,
        lastFullSyncTime: incremental ? (syncState.lastFullSyncTime ?? undefined) : new Date(),
        mvLastRefreshTime: mvLastRefreshTime ?? undefined,
        tagVersion: currentVersionId,
        errorMessage: undefined,
        retryCount: 0,
      });

      const durationMs = Date.now() - startTime;
      log.info('标签 bitmap 同步完成', {
        tagId,
        syncType: result.syncType,
        affectedRows: result.affectedRows,
        durationMs,
      });

      return {
        success: true,
        tagId,
        syncedCount: result.affectedRows,
        syncType: result.syncType,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : '同步失败';

      // 尝试更新状态为 FAILED
      try {
        const syncState = await this.syncStateRepository.findByTagId(tagId, ownedBy);
        if (syncState && syncState.syncStatus === 'SYNCING') {
          const newRetryCount = syncState.retryCount + 1;
          await this.syncStateRepository.update(syncState.id, {
            syncStatus: 'FAILED',
            errorMessage: errorMsg,
            retryCount: newRetryCount,
          });
          log.error('标签 bitmap 同步失败', {
            tagId,
            error: errorMsg,
            retryCount: newRetryCount,
            durationMs,
          });
        }
      } catch (updateError) {
        log.error('更新同步失败状态异常', {
          tagId,
          originalError: errorMsg,
          updateError: updateError instanceof Error ? updateError.message : String(updateError),
        });
      }

      return {
        success: false,
        tagId,
        syncedCount: 0,
        syncType: 'FULL',
        durationMs,
        error: errorMsg,
      };
    }
  }

  /**
   * 批量同步多个标签
   * 按顺序执行，收集结果
   */
  async syncTagBitmaps(tagIds: string[], ownedBy: string): Promise<BatchSyncResult> {
    log.info('开始批量同步标签 bitmap', { total: tagIds.length, ownedBy });

    const results: SyncResult[] = [];

    for (const tagId of tagIds) {
      const result = await this.syncTagBitmap(tagId, ownedBy);
      results.push(result);
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    log.info('批量同步完成', {
      total: tagIds.length,
      succeeded,
      failed,
    });

    return {
      total: tagIds.length,
      succeeded,
      failed,
      results,
    };
  }

  /**
   * 获取标签的同步状态
   */
  async getSyncState(tagId: string, ownedBy: string): Promise<SyncState | null> {
    return this.syncStateRepository.findByTagId(tagId, ownedBy);
  }

  /**
   * 创建同步状态记录
   * 在标签激活时调用
   */
  async createSyncState(command: CreateSyncStateCommand): Promise<SyncState> {
    const existing = await this.syncStateRepository.findByTagId(command.tagId, command.ownedBy);
    if (existing) {
      log.info('同步状态已存在，返回已有记录', { tagId: command.tagId });
      return existing;
    }

    const data: CreateSyncStateData = {
      tagId: command.tagId,
      tagVersion: command.tagVersion,
      ownedBy: command.ownedBy,
      syncStatus: 'PENDING',
    };

    const state = await this.syncStateRepository.create(data);
    log.info('创建同步状态', { tagId: command.tagId, tagVersion: command.tagVersion });
    return state;
  }

  /**
   * 标记为过时
   * 将状态设为 OBSOLETE，终止态不可转换
   */
  async markObsolete(tagId: string, ownedBy: string): Promise<void> {
    const syncState = await this.syncStateRepository.findByTagId(tagId, ownedBy);
    if (!syncState) {
      log.warn('同步状态不存在，跳过标记过时', { tagId });
      return;
    }

    if (syncState.syncStatus === 'OBSOLETE') {
      log.info('同步状态已经是过时，跳过', { tagId });
      return;
    }

    this.validateTransition(syncState.syncStatus, 'OBSOLETE');
    await this.syncStateRepository.update(syncState.id, {
      syncStatus: 'OBSOLETE',
    });
    log.info('同步状态已标记为过时', { tagId, previousStatus: syncState.syncStatus });
  }

  /**
   * 判断同步类型：全量 or 增量
   */
  private determineSyncType(syncState: SyncState): {
    incremental: boolean;
    lastSyncTime: Date | null;
  } {
    // PENDING 或 FAILED → 全量同步
    if (syncState.syncStatus === 'PENDING' || syncState.syncStatus === 'FAILED') {
      return { incremental: false, lastSyncTime: null };
    }

    // SYNCED → 增量同步（如果有过同步记录）
    if (syncState.syncStatus === 'SYNCED' && syncState.lastSyncTime) {
      return { incremental: true, lastSyncTime: syncState.lastSyncTime };
    }

    // 默认全量
    return { incremental: false, lastSyncTime: null };
  }

  /**
   * 验证状态转换合法性
   */
  private validateTransition(from: SyncStatus, to: SyncStatus): void {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      throw new Error(`非法状态转换: ${from} → ${to}`);
    }
  }
}
