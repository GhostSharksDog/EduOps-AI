import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TagRefreshMonitorServiceImpl } from '@/modules/tag/services/TagRefreshMonitorServiceImpl';
import { TagDomainService } from '@/modules/tag/domain/services/ports/TagDomainService';
import { IMaterializedViewDomainService } from '@/modules/tag/domain/services/ports/IMaterializedViewDomainService';
import { ITagRefreshLogRepository, TagRefreshLogData } from '@/modules/tag/domain/ports/ITagRefreshLogRepository';
import { MockFactory } from '../../../../helpers/mock-factory';

/**
 * TagRefreshMonitorService 单元测试
 *
 * 测试覆盖:
 * - checkAllRefreshStatus: 检测所有活跃标签的 MV 刷新状态
 * - checkRefreshStatus: 检测单个标签的 MV 刷新状态
 * - scheduledCheck: 定时任务入口
 * - getUnresolvedErrors: 获取未解决的异常列表
 * - markErrorResolved: 标记异常为已解决
 */
import { IMaterializedViewConfigRepository } from '@/modules/tag/domain/ports/IMaterializedViewConfigRepository';

describe('TagRefreshMonitorService', () => {
  let service: TagRefreshMonitorServiceImpl;
  let mockTagDomainService: TagDomainService;
  let mockMvDomainService: IMaterializedViewDomainService;
  let mockRefreshLogRepository: ITagRefreshLogRepository;
  let mockMvConfigRepository: IMaterializedViewConfigRepository;

  beforeEach(() => {
    mockTagDomainService = {
      createTag: vi.fn(),
      getTag: vi.fn(),
      updateTag: vi.fn(),
      updateTagStatus: vi.fn(),
      deleteTag: vi.fn(),
      createTagVersion: vi.fn(),
      deleteTagVersion: vi.fn(),
      setCurrentVersion: vi.fn(),
      findTagByName: vi.fn(),
    };

    mockMvDomainService = {
      createMv: vi.fn(),
      deleteMv: vi.fn(),
      deleteMvOnly: vi.fn(),
      stopMv: vi.fn(),
      startMv: vi.fn(),
      getRefreshStatus: vi.fn(),
      isSevereError: vi.fn(),
      getAllMvStatuses: vi.fn(),
    };

    mockRefreshLogRepository = {
      create: vi.fn(),
      findByTagId: vi.fn(),
      findUnresolved: vi.fn(),
      findRecent: vi.fn(),
      markResolved: vi.fn(),
      markResolvedBatch: vi.fn(),
      markResolvedByTagAndMv: vi.fn(),
      deleteByTagId: vi.fn(),
      deleteOlderThan: vi.fn(),
      hasUnresolvedError: vi.fn(),
    };

    mockMvConfigRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByTagId: vi.fn(),
      findByTagIdAndVersionId: vi.fn(),
      findByMvName: vi.fn(),
      findAllWithTagName: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteByTagId: vi.fn(),
    };

    service = new TagRefreshMonitorServiceImpl(
      mockTagDomainService,
      mockMvDomainService,
      mockRefreshLogRepository,
      mockMvConfigRepository
    );
  });

  describe('checkAllRefreshStatus', () => {
    it('limits status reports to the verified organization before querying views',async()=>{
      const tenantFilter={tenantId:'00000000-0000-4000-8000-000000000301'};
      const owned={...MockFactory.createMaterializedViewConfigData({tagId:'own-tag',ownedBy:tenantFilter.tenantId,mvName:'own-mv'}),tagName:'本机构标签'};
      const foreign={...MockFactory.createMaterializedViewConfigData({tagId:'foreign-tag',ownedBy:'00000000-0000-4000-8000-000000000302',mvName:'foreign-mv'}),tagName:'外机构标签'};
      vi.mocked(mockMvConfigRepository.findAllWithTagName).mockResolvedValue([owned,foreign]);
      vi.mocked(mockTagDomainService.getTag).mockResolvedValue(MockFactory.createTagPO({id:'own-tag'}) as never);
      vi.mocked(mockMvDomainService.getRefreshStatus).mockResolvedValue(null);
      const reports=await service.checkAllRefreshStatus(tenantFilter);
      expect(reports.map(row=>row.tagId)).toEqual(['own-tag']);
      expect(mockMvConfigRepository.findAllWithTagName).toHaveBeenCalledWith(tenantFilter);
      expect(mockTagDomainService.getTag).toHaveBeenCalledWith('own-tag',tenantFilter);
      expect(mockMvDomainService.getRefreshStatus).toHaveBeenCalledTimes(1);
      expect(mockMvDomainService.getRefreshStatus).toHaveBeenCalledWith('own-mv');
    });

    it('should return empty array when no configs exist', async () => {
      vi.mocked(mockMvConfigRepository.findAllWithTagName).mockResolvedValue([]);

      const reports = await service.checkAllRefreshStatus();

      expect(reports).toEqual([]);
    });

    it('should not throw errors', async () => {
      vi.mocked(mockMvConfigRepository.findAllWithTagName).mockResolvedValue([]);

      await expect(service.checkAllRefreshStatus()).resolves.not.toThrow();
    });
  });

  describe('checkRefreshStatus', () => {
    it('should return healthy status for active tag with fresh MV', async () => {
      const tenantFilter={tenantId:'00000000-0000-4000-8000-000000000301'};
      const mockTag = MockFactory.createTagPO({
        id: 'tag-1',
        name: 'Test Tag',
        currentVersionId: 'version-1',
        currentVersion: { id: 'version-1', version: 1 },
      });
      const mockMvConfig = MockFactory.createMaterializedViewConfigData({
        id: 'mvc-1',
        tagId: 'tag-1',
        versionId: 'version-1',
        mvName: 'mv_tag_tag-1_v1',
      });
      vi.mocked(mockTagDomainService.getTag).mockResolvedValue(mockTag as any);
      vi.mocked(mockMvConfigRepository.findByTagId).mockResolvedValue([mockMvConfig]);
      vi.mocked(mockMvDomainService.getRefreshStatus).mockResolvedValue({
        name: 'mv_tag_tag-1_v1',
        lastRefreshTime: new Date(),
        lastException: undefined,
        isStale: false,
      });

      const report = await service.checkRefreshStatus('tag-1',tenantFilter);

      expect(mockTagDomainService.getTag).toHaveBeenCalledWith('tag-1',tenantFilter);
      expect(mockMvConfigRepository.findByTagId).toHaveBeenCalledWith('tag-1',tenantFilter);
      expect(report.tagId).toBe('tag-1');
      expect(report.mvName).toBe('mv_tag_tag-1_v1');
      expect(report.status).toBe('healthy');
      expect(report.lastException).toBeUndefined();
      expect(report.isStale).toBe(false);
      expect(report.needsAttention()).toBe(false);
    });

    it('should return error status for stale MV', async () => {
      const mockTag = MockFactory.createTagPO({
        id: 'tag-1',
        name: 'Test Tag',
        currentVersionId: 'version-1',
        currentVersion: { id: 'version-1', version: 1 },
      });
      const mockMvConfig = MockFactory.createMaterializedViewConfigData({
        id: 'mvc-1',
        tagId: 'tag-1',
        versionId: 'version-1',
        mvName: 'mv_tag_tag-1_v1',
      });
      vi.mocked(mockTagDomainService.getTag).mockResolvedValue(mockTag as any);
      vi.mocked(mockMvConfigRepository.findByTagId).mockResolvedValue([mockMvConfig]);
      vi.mocked(mockMvDomainService.getRefreshStatus).mockResolvedValue({
        name: 'mv_tag_tag-1_v1',
        lastRefreshTime: new Date(),
        lastException: undefined,
        isStale: true,
      });

      const report = await service.checkRefreshStatus('tag-1');

      expect(report.status).toBe('error');
      expect(report.lastException).toBe('物化视图处于 stale 状态');
      expect(report.isStale).toBe(true);
      expect(report.needsAttention()).toBe(true);
    });

    it('should return error status for MV with lastException', async () => {
      const mockTag = MockFactory.createTagPO({
        id: 'tag-1',
        name: 'Test Tag',
        currentVersionId: 'version-1',
        currentVersion: { id: 'version-1', version: 1 },
      });
      const mockMvConfig = MockFactory.createMaterializedViewConfigData({
        id: 'mvc-1',
        tagId: 'tag-1',
        versionId: 'version-1',
        mvName: 'mv_tag_tag-1_v1',
      });
      vi.mocked(mockTagDomainService.getTag).mockResolvedValue(mockTag as any);
      vi.mocked(mockMvConfigRepository.findByTagId).mockResolvedValue([mockMvConfig]);
      vi.mocked(mockMvDomainService.getRefreshStatus).mockResolvedValue({
        name: 'mv_tag_tag-1_v1',
        lastRefreshTime: new Date(),
        lastException: 'Connection timeout',
        isStale: false,
      });

      const report = await service.checkRefreshStatus('tag-1');

      expect(report.status).toBe('error');
      expect(report.lastException).toBe('Connection timeout');
      expect(report.needsAttention()).toBe(true);
    });

    it('should return warning status for overdue refresh', async () => {
      const mockTag = MockFactory.createTagPO({
        id: 'tag-1',
        name: 'Test Tag',
        currentVersionId: 'version-1',
        currentVersion: { id: 'version-1', version: 1 },
      });
      const mockMvConfig = MockFactory.createMaterializedViewConfigData({
        id: 'mvc-1',
        tagId: 'tag-1',
        versionId: 'version-1',
        mvName: 'mv_tag_tag-1_v1',
      });
      vi.mocked(mockTagDomainService.getTag).mockResolvedValue(mockTag as any);
      vi.mocked(mockMvConfigRepository.findByTagId).mockResolvedValue([mockMvConfig]);
      const lastRefreshTime = new Date(Date.now() - 3 * 60 * 60 * 1000);
      vi.mocked(mockMvDomainService.getRefreshStatus).mockResolvedValue({
        name: 'mv_tag_tag-1_v1',
        lastRefreshTime,
        lastException: undefined,
        isStale: false,
      });

      const report = await service.checkRefreshStatus('tag-1');

      expect(report.status).toBe('warning');
      expect(report.lastException).toContain('刷新超时');
      expect(report.needsAttention()).toBe(true);
    });

    it('should return error status for non-existent MV', async () => {
      const mockTag = MockFactory.createTagPO({
        id: 'tag-1',
        name: 'Test Tag',
        currentVersionId: 'version-1',
        currentVersion: { id: 'version-1', version: 1 },
      });
      const mockMvConfig = MockFactory.createMaterializedViewConfigData({
        id: 'mvc-1',
        tagId: 'tag-1',
        versionId: 'version-1',
        mvName: 'mv_tag_tag-1_v1',
      });
      vi.mocked(mockTagDomainService.getTag).mockResolvedValue(mockTag as any);
      vi.mocked(mockMvConfigRepository.findByTagId).mockResolvedValue([mockMvConfig]);
      vi.mocked(mockMvDomainService.getRefreshStatus).mockResolvedValue(null);

      const report = await service.checkRefreshStatus('tag-1');

      expect(report.status).toBe('error');
      expect(report.lastException).toBe('物化视图不存在');
    });

    it('should return error status for non-existent tag', async () => {
      vi.mocked(mockTagDomainService.getTag).mockResolvedValue(null as any);

      const report = await service.checkRefreshStatus('non-existent');

      expect(report.status).toBe('error');
      expect(report.lastException).toBe('标签不存在');
    });

    it('should return error status for tag without MV config', async () => {
      const mockTag = MockFactory.createTagPO({
        id: 'tag-1',
        name: 'Test Tag',
        currentVersionId: 'version-1',
        currentVersion: { id: 'version-1', version: 1 },
      });
      vi.mocked(mockTagDomainService.getTag).mockResolvedValue(mockTag as any);
      vi.mocked(mockMvConfigRepository.findByTagId).mockResolvedValue([]);

      const report = await service.checkRefreshStatus('tag-1');

      expect(report.status).toBe('error');
      expect(report.lastException).toBe('物化视图不存在');
    });

    it('should handle exceptions gracefully', async () => {
      vi.mocked(mockTagDomainService.getTag).mockRejectedValue(new Error('Database error'));

      const report = await service.checkRefreshStatus('tag-1');

      expect(report.status).toBe('error');
      expect(report.lastException).toBe('Database error');
    });

    it('should handle non-Error exceptions', async () => {
      vi.mocked(mockTagDomainService.getTag).mockRejectedValue('String error');

      const report = await service.checkRefreshStatus('tag-1');

      expect(report.status).toBe('error');
      expect(report.lastException).toBe('检查失败');
    });

    it('should record error log when status is not healthy', async () => {
      const mockTag = MockFactory.createTagPO({
        id: 'tag-1',
        name: 'Test Tag',
        currentVersionId: 'version-1',
        currentVersion: { id: 'version-1', version: 1 },
      });
      const mockMvConfig = MockFactory.createMaterializedViewConfigData({
        id: 'mvc-1',
        tagId: 'tag-1',
        versionId: 'version-1',
        mvName: 'mv_tag_tag-1_v1',
      });
      vi.mocked(mockTagDomainService.getTag).mockResolvedValue(mockTag as any);
      vi.mocked(mockMvConfigRepository.findByTagId).mockResolvedValue([mockMvConfig]);
      vi.mocked(mockMvDomainService.getRefreshStatus).mockResolvedValue({
        name: 'mv_tag_tag-1_v1',
        lastRefreshTime: new Date(),
        lastException: 'Some error',
        isStale: false,
      });
      vi.mocked(mockRefreshLogRepository.create).mockResolvedValue(
        MockFactory.createTagRefreshLogData({
          tagId: 'tag-1',
          mvName: 'mv_tag_tag-1_v1',
        })
      );

      await service.checkRefreshStatus('tag-1');

      expect(mockRefreshLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tagId: 'tag-1',
          mvName: 'mv_tag_tag-1_v1',
          errorMessage: 'Some error',
          isResolved: false,
        })
      );
    });

    it('should not record error log when status is healthy', async () => {
      const mockTag = MockFactory.createTagPO({
        id: 'tag-1',
        name: 'Test Tag',
        currentVersionId: 'version-1',
        currentVersion: { id: 'version-1', version: 1 },
      });
      const mockMvConfig = MockFactory.createMaterializedViewConfigData({
        id: 'mvc-1',
        tagId: 'tag-1',
        versionId: 'version-1',
        mvName: 'mv_tag_tag-1_v1',
      });
      vi.mocked(mockTagDomainService.getTag).mockResolvedValue(mockTag as any);
      vi.mocked(mockMvConfigRepository.findByTagId).mockResolvedValue([mockMvConfig]);
      vi.mocked(mockMvDomainService.getRefreshStatus).mockResolvedValue({
        name: 'mv_tag_tag-1_v1',
        lastRefreshTime: new Date(),
        isStale: false,
      });

      await service.checkRefreshStatus('tag-1');

      expect(mockRefreshLogRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('recordStatusChange (trl transitions)', () => {
    const setupHealthyTag = () => {
      const mockTag = MockFactory.createTagPO({
        id: 'tag-1',
        name: 'Test Tag',
        currentVersionId: 'version-1',
        currentVersion: { id: 'version-1', version: 1 },
      });
      const mockMvConfig = MockFactory.createMaterializedViewConfigData({
        id: 'mvc-1',
        tagId: 'tag-1',
        versionId: 'version-1',
        mvName: 'mv_tag_tag-1_v1',
      });
      vi.mocked(mockTagDomainService.getTag).mockResolvedValue(mockTag as any);
      vi.mocked(mockMvConfigRepository.findByTagId).mockResolvedValue([mockMvConfig]);
    };

    it('healthy→error: creates a new trl entry when no unresolved exists', async () => {
      setupHealthyTag();
      vi.mocked(mockMvDomainService.getRefreshStatus).mockResolvedValue({
        name: 'mv_tag_tag-1_v1',
        lastRefreshTime: new Date(),
        lastException: 'Connection failed',
        isStale: false,
      });
      vi.mocked(mockRefreshLogRepository.hasUnresolvedError).mockResolvedValue(false);
      vi.mocked(mockRefreshLogRepository.create).mockResolvedValue(
        MockFactory.createTagRefreshLogData({ tagId: 'tag-1', mvName: 'mv_tag_tag-1_v1' })
      );

      await service.checkRefreshStatus('tag-1');

      expect(mockRefreshLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tagId: 'tag-1',
          mvName: 'mv_tag_tag-1_v1',
          errorMessage: 'Connection failed',
          isResolved: false,
        })
      );
      expect(mockRefreshLogRepository.markResolvedByTagAndMv).not.toHaveBeenCalled();
    });

    it('error→error (持续): skips create when unresolved already exists (dedup)', async () => {
      setupHealthyTag();
      vi.mocked(mockMvDomainService.getRefreshStatus).mockResolvedValue({
        name: 'mv_tag_tag-1_v1',
        lastRefreshTime: new Date(),
        lastException: 'Still failing',
        isStale: false,
      });
      vi.mocked(mockRefreshLogRepository.hasUnresolvedError).mockResolvedValue(true);

      await service.checkRefreshStatus('tag-1');

      expect(mockRefreshLogRepository.create).not.toHaveBeenCalled();
      expect(mockRefreshLogRepository.markResolvedByTagAndMv).not.toHaveBeenCalled();
    });

    it('error→healthy: marks existing unresolved as resolved', async () => {
      setupHealthyTag();
      vi.mocked(mockMvDomainService.getRefreshStatus).mockResolvedValue({
        name: 'mv_tag_tag-1_v1',
        lastRefreshTime: new Date(),
        isStale: false,
      });
      vi.mocked(mockRefreshLogRepository.hasUnresolvedError).mockResolvedValue(true);
      vi.mocked(mockRefreshLogRepository.markResolvedByTagAndMv).mockResolvedValue(1);

      await service.checkRefreshStatus('tag-1');

      expect(mockRefreshLogRepository.markResolvedByTagAndMv).toHaveBeenCalledWith(
        'tag-1',
        'mv_tag_tag-1_v1'
      );
      expect(mockRefreshLogRepository.create).not.toHaveBeenCalled();
    });

    it('healthy→healthy: does not write or resolve anything', async () => {
      setupHealthyTag();
      vi.mocked(mockMvDomainService.getRefreshStatus).mockResolvedValue({
        name: 'mv_tag_tag-1_v1',
        lastRefreshTime: new Date(),
        isStale: false,
      });
      vi.mocked(mockRefreshLogRepository.hasUnresolvedError).mockResolvedValue(false);

      await service.checkRefreshStatus('tag-1');

      expect(mockRefreshLogRepository.create).not.toHaveBeenCalled();
      expect(mockRefreshLogRepository.markResolvedByTagAndMv).not.toHaveBeenCalled();
    });
  });

  describe('CH + trl data passthrough (no merging)', () => {
    const setupTagWithMv = (mvStatus: any) => {
      const mockTag = MockFactory.createTagPO({
        id: 'tag-1',
        name: 'Test Tag',
        currentVersionId: 'version-1',
        currentVersion: { id: 'version-1', version: 1 },
      });
      const mockMvConfig = MockFactory.createMaterializedViewConfigData({
        id: 'mvc-1',
        tagId: 'tag-1',
        versionId: 'version-1',
        mvName: 'mv_tag_tag-1_v1',
      });
      vi.mocked(mockTagDomainService.getTag).mockResolvedValue(mockTag as any);
      vi.mocked(mockMvConfigRepository.findByTagId).mockResolvedValue([mockMvConfig]);
      vi.mocked(mockMvDomainService.getRefreshStatus).mockResolvedValue(mvStatus);
      vi.mocked(mockRefreshLogRepository.hasUnresolvedError).mockResolvedValue(false);
    };

    it('passes CH lastRefreshTime and lastException through unchanged', async () => {
      const chTime = new Date('2025-06-17T12:00:00Z');
      setupTagWithMv({
        name: 'mv_tag_tag-1_v1',
        lastRefreshTime: chTime,
        lastException: 'CH error',
        isStale: false,
      });

      const report = await service.checkRefreshStatus('tag-1');

      expect(report.lastRefreshTime).toEqual(chTime);
      expect(report.lastException).toBe('CH error');
    });
  });

  describe('scheduledCheck', () => {
    it('should return MonitorCheckResult with aggregated counts', async () => {
      vi.mocked(mockMvConfigRepository.findAllWithTagName).mockResolvedValue([]);

      const result = await service.scheduledCheck();

      expect(result.totalChecked).toBe(0);
      expect(result.healthyCount).toBe(0);
      expect(result.warningCount).toBe(0);
      expect(result.errorCount).toBe(0);
      expect(result.checkDuration).toBeGreaterThanOrEqual(0);
      expect(result.summary).toContain('检测 0 个标签');
    });

    it('should have valid summary format', async () => {
      vi.mocked(mockMvConfigRepository.findAllWithTagName).mockResolvedValue([]);

      const result = await service.scheduledCheck();

      expect(result.summary).toMatch(/检测 \d+ 个标签: \d+ 正常, \d+ 警告, \d+ 错误 \(\d+ms\)/);
    });

    it('should not throw errors', async () => {
      vi.mocked(mockMvConfigRepository.findAllWithTagName).mockResolvedValue([]);

      await expect(service.scheduledCheck()).resolves.not.toThrow();
    });
  });

  describe('getUnresolvedErrors', () => {
    it('should return list of unresolved errors', async () => {
      const mockLogs = [
        MockFactory.createTagRefreshLogData({ id: 'log-1', errorMessage: 'Error 1' }),
        MockFactory.createTagRefreshLogData({ id: 'log-2', errorMessage: 'Error 2' }),
      ];
      vi.mocked(mockRefreshLogRepository.findUnresolved).mockResolvedValue(mockLogs);

      const result = await service.getUnresolvedErrors();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('log-1');
      expect(result[0].errorMessage).toBe('Error 1');
      expect(result[1].id).toBe('log-2');
    });

    it('should respect limit parameter', async () => {
      const mockLogs = [MockFactory.createTagRefreshLogData({ id: 'log-1' })];
      vi.mocked(mockRefreshLogRepository.findUnresolved).mockResolvedValue(mockLogs);

      await service.getUnresolvedErrors(50);

      expect(mockRefreshLogRepository.findUnresolved).toHaveBeenCalledWith(50, undefined);
    });

    it('should use default limit of 100', async () => {
      vi.mocked(mockRefreshLogRepository.findUnresolved).mockResolvedValue([]);

      await service.getUnresolvedErrors();

      expect(mockRefreshLogRepository.findUnresolved).toHaveBeenCalledWith(100, undefined);
    });

    it('passes the verified organization to the repository',async()=>{
      const tenantFilter={tenantId:'00000000-0000-4000-8000-000000000301'};
      vi.mocked(mockRefreshLogRepository.findUnresolved).mockResolvedValue([]);
      await service.getUnresolvedErrors(50,tenantFilter);
      expect(mockRefreshLogRepository.findUnresolved).toHaveBeenCalledWith(50,tenantFilter);
    });

    it('should return empty array when no unresolved errors', async () => {
      vi.mocked(mockRefreshLogRepository.findUnresolved).mockResolvedValue([]);

      const result = await service.getUnresolvedErrors();

      expect(result).toEqual([]);
    });

    it('should properly map log data to TagRefreshLog entities', async () => {
      const mockLog = MockFactory.createTagRefreshLogData({
        id: 'log-custom',
        tagId: 'tag-custom',
        mvName: 'mv_custom',
        errorMessage: 'Custom error message',
        occurredAt: new Date('2025-01-10T08:30:00Z'),
        isResolved: false,
        createTime: new Date('2025-01-10T08:00:00Z'),
      });
      vi.mocked(mockRefreshLogRepository.findUnresolved).mockResolvedValue([mockLog]);

      const result = await service.getUnresolvedErrors();

      expect(result[0].id).toBe('log-custom');
      expect(result[0].tagId).toBe('tag-custom');
      expect(result[0].mvName).toBe('mv_custom');
      expect(result[0].errorMessage).toBe('Custom error message');
      expect(result[0].occurredAt).toEqual(new Date('2025-01-10T08:30:00Z'));
      expect(result[0].isResolved).toBe(false);
      expect(result[0].createTime).toEqual(new Date('2025-01-10T08:00:00Z'));
    });
  });

  describe('markErrorResolved', () => {
    it('should mark error as resolved', async () => {
      vi.mocked(mockRefreshLogRepository.markResolved).mockResolvedValue();
      const tenantFilter={tenantId:'00000000-0000-4000-8000-000000000301'};

      await service.markErrorResolved('log-1',tenantFilter);

      expect(mockRefreshLogRepository.markResolved).toHaveBeenCalledWith('log-1',tenantFilter);
    });

    it('should handle successful resolution', async () => {
      vi.mocked(mockRefreshLogRepository.markResolved).mockResolvedValue();

      await expect(service.markErrorResolved('log-1')).resolves.not.toThrow();
    });

    it('should propagate repository errors', async () => {
      vi.mocked(mockRefreshLogRepository.markResolved).mockRejectedValue(
        new Error('Log not found')
      );

      await expect(service.markErrorResolved('non-existent')).rejects.toThrow('Log not found');
    });
  });

  describe('MvRefreshStatusReport helper methods', () => {
    it('needsAttention should return true for warning status', async () => {
      const mockTag = MockFactory.createTagPO({
        id: 'tag-1',
        name: 'Test Tag',
        currentVersionId: 'version-1',
        currentVersion: { id: 'version-1', version: 1 },
      });
      const mockMvConfig = MockFactory.createMaterializedViewConfigData({
        id: 'mvc-1',
        tagId: 'tag-1',
        versionId: 'version-1',
        mvName: 'mv_tag_tag-1_v1',
      });
      vi.mocked(mockTagDomainService.getTag).mockResolvedValue(mockTag as any);
      vi.mocked(mockMvConfigRepository.findByTagId).mockResolvedValue([mockMvConfig]);
      const lastRefreshTime = new Date(Date.now() - 3 * 60 * 60 * 1000);
      vi.mocked(mockMvDomainService.getRefreshStatus).mockResolvedValue({
        name: 'mv_tag_tag-1_v1',
        lastRefreshTime,
        isStale: false,
      });

      const report = await service.checkRefreshStatus('tag-1');

      expect(report.status).toBe('warning');
      expect(report.needsAttention()).toBe(true);
    });

    it('needsAttention should return true for error status', async () => {
      vi.mocked(mockTagDomainService.getTag).mockResolvedValue(null as any);

      const report = await service.checkRefreshStatus('tag-1');

      expect(report.status).toBe('error');
      expect(report.needsAttention()).toBe(true);
    });

    it('getStatusDescription should return correct descriptions', async () => {
      const mockTag = MockFactory.createTagPO({
        id: 'tag-1',
        name: 'Test Tag',
        currentVersionId: 'version-1',
        currentVersion: { id: 'version-1', version: 1 },
      });
      const mockMvConfig = MockFactory.createMaterializedViewConfigData({
        id: 'mvc-1',
        tagId: 'tag-1',
        versionId: 'version-1',
        mvName: 'mv_tag_tag-1_v1',
      });
      vi.mocked(mockTagDomainService.getTag).mockResolvedValue(mockTag as any);
      vi.mocked(mockMvConfigRepository.findByTagId).mockResolvedValue([mockMvConfig]);
      vi.mocked(mockMvDomainService.getRefreshStatus).mockResolvedValue({
        name: 'mv_tag_tag-1_v1',
        lastRefreshTime: new Date(),
        isStale: false,
      });

      let report = await service.checkRefreshStatus('tag-1');
      expect(report.getStatusDescription()).toBe('运行正常');

      vi.mocked(mockMvDomainService.getRefreshStatus).mockResolvedValue({
        name: 'mv_tag_tag-1_v1',
        isStale: true,
      });

      report = await service.checkRefreshStatus('tag-1');
      expect(report.getStatusDescription()).toBe('刷新失败');

      const oldTime = new Date(Date.now() - 3 * 60 * 60 * 1000);
      vi.mocked(mockMvDomainService.getRefreshStatus).mockResolvedValue({
        name: 'mv_tag_tag-1_v1',
        lastRefreshTime: oldTime,
        isStale: false,
      });

      report = await service.checkRefreshStatus('tag-1');
      expect(report.getStatusDescription()).toBe('刷新延迟');
    });

    it('generateAlertMessage should return empty string for healthy status', async () => {
      const mockTag = MockFactory.createTagPO({
        id: 'tag-1',
        name: 'Test Tag',
        currentVersionId: 'version-1',
        currentVersion: { id: 'version-1', version: 1 },
      });
      const mockMvConfig = MockFactory.createMaterializedViewConfigData({
        id: 'mvc-1',
        tagId: 'tag-1',
        versionId: 'version-1',
        mvName: 'mv_tag_tag-1_v1',
      });
      vi.mocked(mockTagDomainService.getTag).mockResolvedValue(mockTag as any);
      vi.mocked(mockMvConfigRepository.findByTagId).mockResolvedValue([mockMvConfig]);
      vi.mocked(mockMvDomainService.getRefreshStatus).mockResolvedValue({
        name: 'mv_tag_tag-1_v1',
        lastRefreshTime: new Date(),
        isStale: false,
      });

      const report = await service.checkRefreshStatus('tag-1');
      expect(report.generateAlertMessage()).toBe('');
    });

    it('generateAlertMessage should contain relevant info for error status', async () => {
      const mockTag = MockFactory.createTagPO({
        id: 'tag-1',
        name: 'Test Tag',
        currentVersionId: 'version-1',
        currentVersion: { id: 'version-1', version: 1 },
      });
      const mockMvConfig = MockFactory.createMaterializedViewConfigData({
        id: 'mvc-1',
        tagId: 'tag-1',
        versionId: 'version-1',
        mvName: 'mv_tag_tag-1_v1',
      });
      vi.mocked(mockTagDomainService.getTag).mockResolvedValue(mockTag as any);
      vi.mocked(mockMvConfigRepository.findByTagId).mockResolvedValue([mockMvConfig]);
      vi.mocked(mockMvDomainService.getRefreshStatus).mockResolvedValue({
        name: 'mv_tag_tag-1_v1',
        lastRefreshTime: new Date(),
        lastException: 'Connection refused',
        isStale: false,
      });

      const report = await service.checkRefreshStatus('tag-1');
      const alertMessage = report.generateAlertMessage();

      expect(alertMessage).toContain('tag-1');
      expect(alertMessage).toContain('mv_tag_tag-1_v1');
      expect(alertMessage).toContain('Connection refused');
      expect(alertMessage).toContain('刷新失败');
    });
  });

  describe('MonitorCheckResult', () => {
    it('should have correct summary format', async () => {
      vi.mocked(mockMvConfigRepository.findAllWithTagName).mockResolvedValue([]);

      const result = await service.scheduledCheck();

      expect(result.summary).toContain('检测');
      expect(result.summary).toContain('正常');
      expect(result.summary).toContain('警告');
      expect(result.summary).toContain('错误');
      expect(result.summary).toMatch(/\d+ms\)/);
    });

    it('should track check duration', async () => {
      vi.mocked(mockMvConfigRepository.findAllWithTagName).mockResolvedValue([]);

      const result = await service.scheduledCheck();

      expect(result.checkDuration).toBeTypeOf('number');
      expect(result.checkDuration).toBeGreaterThanOrEqual(0);
    });

    it('should have checkTime', async () => {
      vi.mocked(mockMvConfigRepository.findAllWithTagName).mockResolvedValue([]);

      const result = await service.scheduledCheck();

      expect(result.checkTime).toBeInstanceOf(Date);
    });
  });
});
