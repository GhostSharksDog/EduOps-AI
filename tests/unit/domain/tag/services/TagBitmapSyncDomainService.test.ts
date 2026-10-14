import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { TagBitmapSyncDomainServiceImpl } from '@/modules/tag/domain/services/TagBitmapSyncDomainServiceImpl';
import { ITagBitmapSyncStateRepository } from '@/modules/tag/domain/ports/ITagBitmapSyncStateRepository';
import { ITagStorageConfigRepository } from '@/modules/tag/domain/ports/ITagStorageConfigRepository';
import { IClickHouseClientAdapter } from '@/platform/database/interface/IClickHouseClientAdapter';
import { TagRepository } from '@/modules/tag/domain/ports/TagRepository';
import { ITargetTableRepository } from '@/modules/tag/domain/ports/ITargetTableRepository';
import type { SyncState } from '@/modules/tag/domain/services/dto/TagBitmapSyncDto';

// Mock logger to prevent console noise
vi.mock('@/platform/logger', () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

type MockSyncStateRepo = {
  [K in keyof ITagBitmapSyncStateRepository]: Mock;
};

type MockStorageConfigRepo = {
  [K in keyof ITagStorageConfigRepository]: Mock;
};

type MockClickHouse = {
  [K in keyof IClickHouseClientAdapter]: Mock;
};

type MockTagRepo = {
  [K in keyof TagRepository]: Mock;
};

type MockTargetTableRepo = {
  [K in keyof ITargetTableRepository]: Mock;
};

function makeSyncState(overrides: Partial<SyncState> = {}): SyncState {
  return {
    id: 'sync-1',
    tagId: 'tag-1',
    syncStatus: 'PENDING',
    lastSyncTime: null,
    lastSyncedCount: null,
    lastFullSyncTime: null,
    mvLastRefreshTime: null,
    tagVersion: 'v1',
    errorMessage: null,
    retryCount: 0,
    ...overrides,
  };
}

describe('TagBitmapSyncDomainServiceImpl', () => {
  let service: TagBitmapSyncDomainServiceImpl;
  let mockSyncStateRepo: MockSyncStateRepo;
  let mockStorageConfigRepo: MockStorageConfigRepo;
  let mockClickHouse: MockClickHouse;
  let mockTagRepo: MockTagRepo;
  let mockTargetTableRepo: MockTargetTableRepo;

  beforeEach(() => {
    mockSyncStateRepo = {
      findByTagId: vi.fn(),
      findByStatus: vi.fn(),
      findNeedsIncrementalSync: vi.fn(),
      findByTagVersionMismatch: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      findDistinctOwnedBy: vi.fn(),
    };

    mockStorageConfigRepo = {
      findByTagId: vi.fn(),
      findByBitmapIdAndBitPosition: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findAnyByTagId: vi.fn(),
      findAllByTagId: vi.fn(async (id: string) => {
        const config = await mockStorageConfigRepo.findByTagId(id);
        return config ? [config] : [];
      }),
      findAnyByTagIdAndEnumValue: vi.fn(),
      findAnyByBitmapIdAndBitPosition: vi.fn(),
      update: vi.fn(),
    };

    mockClickHouse = {
      testConnection: vi.fn(),
      query: vi.fn(),
      execute: vi.fn(),
      createMaterializedView: vi.fn(),
      createTable: vi.fn(),
      convertToLocalNonReplicated: vi.fn(),
      createBitmapMaterializedView: vi.fn(),
      createEnumBitmapTable: vi.fn(),
      createEnumBitmapMaterializedView: vi.fn(),
      getMvTargetTable: vi.fn(),
      dropMaterializedView: vi.fn(),
      dropTable: vi.fn(),
      stopView: vi.fn(),
      startView: vi.fn(),
      getRefreshStatus: vi.fn(),
      checkTableExists: vi.fn(),
      resetBitmapBit: vi.fn(),
      syncTagBitmap: vi.fn(),
    };

    mockTagRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createVersion: vi.fn(),
      findVersionById: vi.fn(),
      findVersionsByTagId: vi.fn(),
      countVersionsByTagId: vi.fn(),
      maxVersionByTagId: vi.fn(),
      deleteVersionById: vi.fn(),
      updateVersion: vi.fn(),
      createCategory: vi.fn(),
      findCategoryById: vi.fn(),
      findAllCategories: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
      countTagsByCategoryId: vi.fn(),
      countTagsByCategoryIds: vi.fn(),
      countChildCategories: vi.fn(),
      countCategories: vi.fn(),
      findByName: vi.fn(),
      restore: vi.fn(),
    };

    mockTargetTableRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByTableName: vi.fn(),
      findAnyByTableName: vi.fn(),
      restore: vi.fn(),
      findByTagId: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateStatus: vi.fn(),
      linkTag: vi.fn(),
      unlinkTag: vi.fn(),
      updateStats: vi.fn(),
    };

    service = new TagBitmapSyncDomainServiceImpl(
      mockSyncStateRepo as unknown as ITagBitmapSyncStateRepository,
      mockStorageConfigRepo as unknown as ITagStorageConfigRepository,
      mockClickHouse as unknown as IClickHouseClientAdapter,
      mockTagRepo as unknown as TagRepository,
      mockTargetTableRepo as unknown as ITargetTableRepository,
    );
  });

  describe('全量同步 — PENDING → SYNCING → SYNCED', () => {
    it('从 PENDING 状态完成全量同步', async () => {
      const tagId = 'tag-1';
      const ownedBy = 'tenant-1';

      // 存储配置
      mockStorageConfigRepo.findByTagId.mockResolvedValue({
        id: 'config-1',
        tagId,
        bitmapTableName: 'tag_bitmap',
        bitPosition: 5,
        storageType: 'BITMAP',
        ownedBy,
        createTime: new Date(),
      });

      // TargetTable 查询
      mockTargetTableRepo.findByTagId.mockResolvedValue({
        id: 'target-table-1',
        tableName: 'user_behavior_v1',
        entityType: 'USER',
        entityTypeId: 'entity-1',
        ownedBy,
        createTableSql: '...',
        tableType: 'PHYSICAL_TABLE',
        tagId,
        tagVersionId: 'v1',
        status: 'ACTIVE',
        isDeleted: false,
        createTime: new Date(),
      });

      // 已存在的 PENDING 同步状态
      const pendingState = makeSyncState({ syncStatus: 'PENDING' });
      mockSyncStateRepo.findByTagId.mockResolvedValue(pendingState);

      // 标签存在，版本一致
      mockTagRepo.findById.mockResolvedValue({ id: tagId, currentVersionId: 'v1' });

      // ClickHouse 同步成功
      mockClickHouse.syncTagBitmap.mockResolvedValue({ affectedRows: 100, syncType: 'FULL' });
      mockClickHouse.getRefreshStatus.mockResolvedValue(null);

      const result = await service.syncTagBitmap(tagId, ownedBy);

      // 验证状态转换：PENDING → SYNCING → SYNCED
      expect(mockSyncStateRepo.update).toHaveBeenCalledWith('sync-1', expect.objectContaining({
        syncStatus: 'SYNCING',
      }));
      expect(mockSyncStateRepo.update).toHaveBeenCalledWith('sync-1', expect.objectContaining({
        syncStatus: 'SYNCED',
      }));

      // 验证 ClickHouse 被调用为全量同步
      expect(mockClickHouse.syncTagBitmap).toHaveBeenCalledWith(
        expect.objectContaining({
          bitmapTableName: 'tag_bitmap',
          sourceTableName: 'user_behavior_v1',
          bitPosition: 5,
          incremental: false,
        }),
      );

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(100);
      expect(result.syncType).toBe('FULL');
    });
  });

  describe('增量同步 — SYNCED → SYNCING → SYNCED', () => {
    it('从 SYNCED 状态执行增量同步', async () => {
      const tagId = 'tag-2';
      const ownedBy = 'tenant-1';
      const lastSync = new Date('2025-01-01T00:00:00Z');

      mockStorageConfigRepo.findByTagId.mockResolvedValue({
        id: 'config-2',
        tagId,
        bitmapTableName: 'tag_bitmap',
        bitPosition: 3,
        storageType: 'BITMAP',
        ownedBy,
        createTime: new Date(),
      });

      const syncedState = makeSyncState({
        id: 'sync-2',
        tagId,
        syncStatus: 'SYNCED',
        lastSyncTime: lastSync,
        tagVersion: 'v1',
      });
      mockSyncStateRepo.findByTagId.mockResolvedValue(syncedState);

      mockTagRepo.findById.mockResolvedValue({ id: tagId, currentVersionId: 'v1' });

      mockTargetTableRepo.findByTagId.mockResolvedValue({
        id: 'target-table-2',
        tableName: 'user_actions_v1',
        entityType: 'USER',
        entityTypeId: 'entity-2',
        ownedBy,
        createTableSql: '...',
        tableType: 'PHYSICAL_TABLE',
        tagId,
        tagVersionId: 'v1',
        status: 'ACTIVE',
        isDeleted: false,
        createTime: new Date(),
      });

      mockClickHouse.syncTagBitmap.mockResolvedValue({ affectedRows: 50, syncType: 'INCREMENTAL' });
      mockClickHouse.getRefreshStatus.mockResolvedValue(null);

      const result = await service.syncTagBitmap(tagId, ownedBy);

      expect(result.success).toBe(true);
      expect(result.syncType).toBe('INCREMENTAL');
      expect(result.syncedCount).toBe(50);

      // 增量同步应传 lastSyncTime
      expect(mockClickHouse.syncTagBitmap).toHaveBeenCalledWith(
        expect.objectContaining({
          incremental: true,
          lastSyncTime: lastSync,
        }),
      );
    });
  });

  describe('同步失败 — SYNCING → FAILED', () => {
    it('ClickHouse 同步异常时状态转为 FAILED', async () => {
      const tagId = 'tag-3';
      const ownedBy = 'tenant-1';

      mockStorageConfigRepo.findByTagId.mockResolvedValue({
        id: 'config-3',
        tagId,
        bitmapTableName: 'tag_bitmap',
        bitPosition: 2,
        storageType: 'BITMAP',
        ownedBy,
        createTime: new Date(),
      });

      const pendingState = makeSyncState({ id: 'sync-3', tagId, syncStatus: 'PENDING', tagVersion: 'v1' });
      mockSyncStateRepo.findByTagId.mockResolvedValue(pendingState);

      mockTagRepo.findById.mockResolvedValue({ id: tagId, currentVersionId: 'v1' });

      mockTargetTableRepo.findByTagId.mockResolvedValue({
        id: 'target-table-3',
        tableName: 'user_actions_v1',
        entityType: 'USER',
        entityTypeId: 'entity-3',
        ownedBy,
        createTableSql: '...',
        tableType: 'PHYSICAL_TABLE',
        tagId,
        tagVersionId: 'v1',
        status: 'ACTIVE',
        isDeleted: false,
        createTime: new Date(),
      });

      // ClickHouse 抛出异常
      mockClickHouse.syncTagBitmap.mockRejectedValue(new Error('ClickHouse connection lost'));

      // 查找同步状态（catch 块中再次查找）
      const syncingState = makeSyncState({ id: 'sync-3', tagId, syncStatus: 'SYNCING', retryCount: 0 });
      mockSyncStateRepo.findByTagId
        .mockResolvedValueOnce(pendingState)   // 第一次调用（正常流程）
        .mockResolvedValueOnce(syncingState);   // 第二次调用（catch 块）

      const result = await service.syncTagBitmap(tagId, ownedBy);

      expect(result.success).toBe(false);
      expect(result.error).toBe('ClickHouse connection lost');

      // 验证状态转为 FAILED
      expect(mockSyncStateRepo.update).toHaveBeenCalledWith('sync-3', expect.objectContaining({
        syncStatus: 'FAILED',
        errorMessage: 'ClickHouse connection lost',
        retryCount: 1,
      }));
    });
  });

  describe('重试成功 — FAILED → SYNCING → SYNCED', () => {
    it('从 FAILED 状态重试同步成功', async () => {
      const tagId = 'tag-4';
      const ownedBy = 'tenant-1';

      mockStorageConfigRepo.findByTagId.mockResolvedValue({
        id: 'config-4',
        tagId,
        bitmapTableName: 'tag_bitmap',
        bitPosition: 7,
        storageType: 'BITMAP',
        ownedBy,
        createTime: new Date(),
      });

      const failedState = makeSyncState({
        id: 'sync-4',
        tagId,
        syncStatus: 'FAILED',
        retryCount: 1,
        errorMessage: 'previous error',
        tagVersion: 'v1',
      });
      mockSyncStateRepo.findByTagId.mockResolvedValue(failedState);

      mockTagRepo.findById.mockResolvedValue({ id: tagId, currentVersionId: 'v1' });

      mockTargetTableRepo.findByTagId.mockResolvedValue({
        id: 'target-table-4',
        tableName: 'user_data_v1',
        entityType: 'USER',
        entityTypeId: 'entity-4',
        ownedBy,
        createTableSql: '...',
        tableType: 'PHYSICAL_TABLE',
        tagId,
        tagVersionId: 'v1',
        status: 'ACTIVE',
        isDeleted: false,
        createTime: new Date(),
      });

      mockClickHouse.syncTagBitmap.mockResolvedValue({ affectedRows: 200, syncType: 'FULL' });
      mockClickHouse.getRefreshStatus.mockResolvedValue(null);

      const result = await service.syncTagBitmap(tagId, ownedBy);

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(200);
      expect(result.syncType).toBe('FULL');

      // 失败重试走全量同步（incremental: false）
      expect(mockClickHouse.syncTagBitmap).toHaveBeenCalledWith(
        expect.objectContaining({
          incremental: false,
        }),
      );
    });
  });

  describe('超过最大重试 — FAILED 保持，日志告警', () => {
    it('超过最大重试次数后同步失败仍返回错误结果', async () => {
      const tagId = 'tag-5';
      const ownedBy = 'tenant-1';

      mockStorageConfigRepo.findByTagId.mockResolvedValue({
        id: 'config-5',
        tagId,
        bitmapTableName: 'tag_bitmap',
        bitPosition: 1,
        storageType: 'BITMAP',
        ownedBy,
        createTime: new Date(),
      });

      // FAILED 状态，retryCount = 3（等于 MAX_RETRIES）
      const failedState = makeSyncState({
        id: 'sync-5',
        tagId,
        syncStatus: 'FAILED',
        retryCount: 3,
        tagVersion: 'v1',
      });
      mockSyncStateRepo.findByTagId.mockResolvedValue(failedState);

      mockTagRepo.findById.mockResolvedValue({ id: tagId, currentVersionId: 'v1' });

      mockTargetTableRepo.findByTagId.mockResolvedValue({
        id: 'target-table-5',
        tableName: 'user_data_v1',
        entityType: 'USER',
        entityTypeId: 'entity-5',
        ownedBy,
        createTableSql: '...',
        tableType: 'PHYSICAL_TABLE',
        tagId,
        tagVersionId: 'v1',
        status: 'ACTIVE',
        isDeleted: false,
        createTime: new Date(),
      });

      // ClickHouse 再次失败
      mockClickHouse.syncTagBitmap.mockRejectedValue(new Error('still failing'));

      const syncingState = makeSyncState({ id: 'sync-5', tagId, syncStatus: 'SYNCING', retryCount: 3 });
      mockSyncStateRepo.findByTagId
        .mockResolvedValueOnce(failedState)
        .mockResolvedValueOnce(syncingState);

      const result = await service.syncTagBitmap(tagId, ownedBy);

      expect(result.success).toBe(false);
      expect(result.error).toBe('still failing');

      // retryCount 递增到 4
      expect(mockSyncStateRepo.update).toHaveBeenCalledWith('sync-5', expect.objectContaining({
        syncStatus: 'FAILED',
        retryCount: 4,
      }));
    });
  });

  describe('并发防护 — SYNCING 状态跳过', () => {
    it('SYNCING 状态时跳过同步', async () => {
      const tagId = 'tag-6';
      const ownedBy = 'tenant-1';

      mockStorageConfigRepo.findByTagId.mockResolvedValue({
        id: 'config-6',
        tagId,
        bitmapTableName: 'tag_bitmap',
        bitPosition: 0,
        storageType: 'BITMAP',
        ownedBy,
        createTime: new Date(),
      });

      mockTargetTableRepo.findByTagId.mockResolvedValue({
        id: 'target-table-6',
        tableName: 'user_behavior_v1',
        entityType: 'USER',
        entityTypeId: 'entity-6',
        ownedBy,
        createTableSql: '...',
        tableType: 'PHYSICAL_TABLE',
        tagId,
        tagVersionId: 'v1',
        status: 'ACTIVE',
        isDeleted: false,
        createTime: new Date(),
      });

      const syncingState = makeSyncState({
        id: 'sync-6',
        tagId,
        syncStatus: 'SYNCING',
      });
      mockSyncStateRepo.findByTagId.mockResolvedValue(syncingState);

      const result = await service.syncTagBitmap(tagId, ownedBy);

      expect(result.success).toBe(false);
      expect(result.error).toBe('正在同步中');

      // 不应该调用 ClickHouse
      expect(mockClickHouse.syncTagBitmap).not.toHaveBeenCalled();
    });
  });

  describe('版本变更 — 检测到版本不匹配 → markObsolete → new PENDING', () => {
    it('版本漂移时标记旧状态 OBSOLETE 并创建新 PENDING', async () => {
      const tagId = 'tag-7';
      const ownedBy = 'tenant-1';

      mockStorageConfigRepo.findByTagId.mockResolvedValue({
        id: 'config-7',
        tagId,
        bitmapTableName: 'tag_bitmap',
        bitPosition: 10,
        storageType: 'BITMAP',
        ownedBy,
        createTime: new Date(),
      });

      // 旧版本同步状态
      const oldState = makeSyncState({
        id: 'sync-7-old',
        tagId,
        syncStatus: 'SYNCED',
        tagVersion: 'v1',
        lastSyncTime: new Date('2025-01-01T00:00:00Z'),
      });
      mockSyncStateRepo.findByTagId.mockResolvedValue(oldState);

      // 标签版本已变更
      mockTagRepo.findById.mockResolvedValue({ id: tagId, currentVersionId: 'v2' });

      mockTargetTableRepo.findByTagId.mockResolvedValue({
        id: 'target-table-7',
        tableName: 'user_events_v1',
        entityType: 'USER',
        entityTypeId: 'entity-7',
        ownedBy,
        createTableSql: '...',
        tableType: 'PHYSICAL_TABLE',
        tagId,
        tagVersionId: 'v2',
        status: 'ACTIVE',
        isDeleted: false,
        createTime: new Date(),
      });

      // 新 PENDING 状态
      const newPendingState = makeSyncState({
        id: 'sync-7-new',
        tagId,
        syncStatus: 'PENDING',
        tagVersion: 'v2',
      });
      mockSyncStateRepo.create.mockResolvedValue(newPendingState);

      // ClickHouse 全量同步
      mockClickHouse.syncTagBitmap.mockResolvedValue({ affectedRows: 300, syncType: 'FULL' });
      mockClickHouse.getRefreshStatus.mockResolvedValue(null);

      const result = await service.syncTagBitmap(tagId, ownedBy);

      expect(result.success).toBe(true);

      // 旧状态标记为 OBSOLETE
      expect(mockSyncStateRepo.update).toHaveBeenCalledWith('sync-7-old', expect.objectContaining({
        syncStatus: 'OBSOLETE',
      }));

      // 创建新 PENDING 状态
      expect(mockSyncStateRepo.create).toHaveBeenCalledWith({
        tagId,
        tagVersion: 'v2',
        ownedBy,
        syncStatus: 'PENDING',
      });
    });
  });

  describe('OBSOLETE 状态跳过', () => {
    it('OBSOLETE 状态跳过同步', async () => {
      const tagId = 'tag-8';
      const ownedBy = 'tenant-1';

      mockStorageConfigRepo.findByTagId.mockResolvedValue({
        id: 'config-8',
        tagId,
        bitmapTableName: 'tag_bitmap',
        bitPosition: 4,
        storageType: 'BITMAP',
        ownedBy,
        createTime: new Date(),
      });

      mockTargetTableRepo.findByTagId.mockResolvedValue({
        id: 'target-table-8',
        tableName: 'user_data_v1',
        entityType: 'USER',
        entityTypeId: 'entity-8',
        ownedBy,
        createTableSql: '...',
        tableType: 'PHYSICAL_TABLE',
        tagId,
        tagVersionId: 'v1',
        status: 'ACTIVE',
        isDeleted: false,
        createTime: new Date(),
      });

      const obsoleteState = makeSyncState({
        id: 'sync-8',
        tagId,
        syncStatus: 'OBSOLETE',
      });
      mockSyncStateRepo.findByTagId.mockResolvedValue(obsoleteState);

      const result = await service.syncTagBitmap(tagId, ownedBy);

      expect(result.success).toBe(false);
      expect(result.error).toBe('状态已过期');

      expect(mockClickHouse.syncTagBitmap).not.toHaveBeenCalled();
    });
  });

  describe('缺少 TagStorageConfig → 错误', () => {
    it('标签无存储配置时抛出错误', async () => {
      const tagId = 'tag-9';
      const ownedBy = 'tenant-1';

      // 无存储配置
      mockStorageConfigRepo.findByTagId.mockResolvedValue(null);

      const result = await service.syncTagBitmap(tagId, ownedBy);

      expect(result.success).toBe(false);
      expect(result.error).toBe(`标签未配置存储: ${tagId}`);

      expect(mockClickHouse.syncTagBitmap).not.toHaveBeenCalled();
    });

    it('标签未分配 Bit 位置时抛出错误', async () => {
      const tagId = 'tag-10';
      const ownedBy = 'tenant-1';

      mockStorageConfigRepo.findByTagId.mockResolvedValue({
        id: 'config-10',
        tagId,
        bitmapTableName: 'tag_bitmap',
        bitPosition: null,
        storageType: 'BITMAP',
        ownedBy,
        createTime: new Date(),
      });

      const result = await service.syncTagBitmap(tagId, ownedBy);

      expect(result.success).toBe(false);
      expect(result.error).toBe(`标签未分配 Bit 位置: ${tagId}`);
    });
  });

  describe('createSyncState', () => {
    it('创建新的同步状态', async () => {
      const command = {
        tagId: 'tag-new',
        tagVersion: 'v1',
        ownedBy: 'tenant-1',
      };

      mockSyncStateRepo.findByTagId.mockResolvedValue(null);

      const createdState = makeSyncState({
        id: 'sync-new',
        tagId: 'tag-new',
        syncStatus: 'PENDING',
        tagVersion: 'v1',
      });
      mockSyncStateRepo.create.mockResolvedValue(createdState);

      const result = await service.createSyncState(command);

      expect(result.id).toBe('sync-new');
      expect(result.syncStatus).toBe('PENDING');
      expect(mockSyncStateRepo.create).toHaveBeenCalledWith({
        tagId: 'tag-new',
        tagVersion: 'v1',
        ownedBy: 'tenant-1',
        syncStatus: 'PENDING',
      });
    });

    it('已存在时返回已有记录', async () => {
      const command = {
        tagId: 'tag-existing',
        tagVersion: 'v1',
        ownedBy: 'tenant-1',
      };

      const existing = makeSyncState({ tagId: 'tag-existing' });
      mockSyncStateRepo.findByTagId.mockResolvedValue(existing);

      const result = await service.createSyncState(command);

      expect(result).toBe(existing);
      expect(mockSyncStateRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('markObsolete', () => {
    it('从 SYNCED 状态标记 OBSOLETE', async () => {
      const syncState = makeSyncState({ syncStatus: 'SYNCED' });
      mockSyncStateRepo.findByTagId.mockResolvedValue(syncState);

      await service.markObsolete('tag-1', 'tenant-1');

      expect(mockSyncStateRepo.update).toHaveBeenCalledWith('sync-1', expect.objectContaining({
        syncStatus: 'OBSOLETE',
      }));
    });

    it('从 PENDING 状态标记 OBSOLETE', async () => {
      const syncState = makeSyncState({ syncStatus: 'PENDING' });
      mockSyncStateRepo.findByTagId.mockResolvedValue(syncState);

      await service.markObsolete('tag-1', 'tenant-1');

      expect(mockSyncStateRepo.update).toHaveBeenCalledWith('sync-1', expect.objectContaining({
        syncStatus: 'OBSOLETE',
      }));
    });

    it('从 FAILED 状态标记 OBSOLETE', async () => {
      const syncState = makeSyncState({ syncStatus: 'FAILED' });
      mockSyncStateRepo.findByTagId.mockResolvedValue(syncState);

      await service.markObsolete('tag-1', 'tenant-1');

      expect(mockSyncStateRepo.update).toHaveBeenCalledWith('sync-1', expect.objectContaining({
        syncStatus: 'OBSOLETE',
      }));
    });

    it('从 SYNCING 状态标记 OBSOLETE 应抛出异常', async () => {
      const syncState = makeSyncState({ syncStatus: 'SYNCING' });
      mockSyncStateRepo.findByTagId.mockResolvedValue(syncState);

      await expect(service.markObsolete('tag-1', 'tenant-1')).rejects.toThrow(
        '非法状态转换: SYNCING → OBSOLETE',
      );
    });

    it('同步状态不存在时跳过', async () => {
      mockSyncStateRepo.findByTagId.mockResolvedValue(null);

      await service.markObsolete('tag-unknown', 'tenant-1');

      expect(mockSyncStateRepo.update).not.toHaveBeenCalled();
    });

    it('已经是 OBSOLETE 时跳过', async () => {
      const obsoleteState = makeSyncState({ syncStatus: 'OBSOLETE' });
      mockSyncStateRepo.findByTagId.mockResolvedValue(obsoleteState);

      await service.markObsolete('tag-1', 'tenant-1');

      expect(mockSyncStateRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('getSyncState', () => {
    it('返回同步状态', async () => {
      const state = makeSyncState();
      mockSyncStateRepo.findByTagId.mockResolvedValue(state);

      const result = await service.getSyncState('tag-1', 'tenant-1');

      expect(result).toBe(state);
    });

    it('不存在时返回 null', async () => {
      mockSyncStateRepo.findByTagId.mockResolvedValue(null);

      const result = await service.getSyncState('tag-unknown', 'tenant-1');

      expect(result).toBeNull();
    });
  });

  describe('syncTagBitmaps（批量同步）', () => {
    it('批量同步多个标签', async () => {
      // 简化：让 syncTagBitmap 返回成功
      mockStorageConfigRepo.findByTagId.mockResolvedValue({
        id: 'config-batch',
        tagId: 'tag-batch',
        bitmapTableName: 'tag_bitmap',
        bitPosition: 1,
        storageType: 'BITMAP',
        ownedBy: 'tenant-1',
        createTime: new Date(),
      });

      const pendingState = makeSyncState({ syncStatus: 'PENDING', tagVersion: 'v1' });
      mockSyncStateRepo.findByTagId.mockResolvedValue(pendingState);
      mockTagRepo.findById.mockResolvedValue({ id: 'tag-batch', currentVersionId: 'v1' });
      mockTargetTableRepo.findByTagId.mockResolvedValue({
        id: 'target-table-batch',
        tableName: 'batch_data_v1',
        entityType: 'USER',
        entityTypeId: 'entity-batch',
        ownedBy: 'tenant-1',
        createTableSql: '...',
        tableType: 'PHYSICAL_TABLE',
        tagId: 'tag-batch',
        tagVersionId: 'v1',
        status: 'ACTIVE',
        isDeleted: false,
        createTime: new Date(),
      });
      mockClickHouse.syncTagBitmap.mockResolvedValue({ affectedRows: 10, syncType: 'FULL' });
      mockClickHouse.getRefreshStatus.mockResolvedValue(null);

      const result = await service.syncTagBitmaps(['tag-a', 'tag-b'], 'tenant-1');

      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(2);
    });
  });
});
