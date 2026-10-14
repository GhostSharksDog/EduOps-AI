import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { TagActivationApplicationServiceImpl } from '@/modules/tag/services/TagActivationApplicationServiceImpl';
import { ActivateTagCommand } from '@/modules/tag/services/TagActivationApplicationService';
import { TagStatus, UpdateCycle } from '@/shared/enums/index';
import { UpdateCycle as MVUpdateCycle } from '@/modules/tag/domain/value-objects/MaterializedViewConfig';

// 简化版本的 Tag 实体，供测试使用
type MockTag = {
  id: string;
  updateCycle: MVUpdateCycle;
  currentVersion?: { version: number; calculationRule: string } | null;
};

describe('TagActivationApplicationServiceImpl 激活逻辑', () => {
  let service: TagActivationApplicationServiceImpl;
  let mockTagDomainService: any;
  let mockMvDomainService: any;
  let mockBitmapService: any;
  let mockChClient: any;
  let mockBitmapApplicationService: any;
  let mockTargetTableRepository: any;

  beforeEach(() => {
    mockTagDomainService = {
      getTag: vi.fn(),
      updateTagStatus: vi.fn()
    };
    mockMvDomainService = {
      createMv: vi.fn()
    };
    mockBitmapService = {};
    mockChClient = {
      checkTableExists: vi.fn().mockResolvedValue(false),
    };
    mockBitmapApplicationService = {
      getTagBitAssignment: vi.fn()
    };

    const mockBitmapSyncService = {
      syncTagBitmap: vi.fn(),
      syncTagBitmaps: vi.fn(),
      createSyncState: vi.fn(),
      markObsolete: vi.fn(),
      getSyncState: vi.fn(),
    } as any;
    const mockMvConfigRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByTagId: vi.fn(),
      findByTagIdAndVersionId: vi.fn(),
      findByMvName: vi.fn(),
      findAllWithTagName: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteByTagId: vi.fn(),
    } as any;
    mockTargetTableRepository = {
      findByTagId: vi.fn(),
      findById: vi.fn(),
    };

    service = new TagActivationApplicationServiceImpl(
      mockTagDomainService,
      mockMvDomainService,
      mockBitmapService,
      mockChClient,
      mockBitmapApplicationService,
      mockBitmapSyncService,
      mockMvConfigRepository,
      mockTargetTableRepository
    );
  });

  it(' activateTag: 应该在正常输入下创建 MV 并更新状态', async () => {
    const mockTag: MockTag = {
      id: 'tag-1',
      updateCycle: MVUpdateCycle.DAILY,
      currentVersion: { version: 1, calculationRule: JSON.stringify({ ruleType: 'SQL', ruleContent: 'SELECT 1' }) }
    };
    mockTagDomainService.getTag.mockResolvedValue(mockTag);
    mockMvDomainService.createMv.mockResolvedValue(undefined);
    mockTagDomainService.updateTagStatus.mockResolvedValue(undefined);
    mockBitmapApplicationService.getTagBitAssignment.mockResolvedValue({
      tagId: 'tag-1',
      tagName: 'Test Tag',
      bitmapTableId: 'bt-1',
      bitPosition: 0
    });
    mockTargetTableRepository.findByTagId.mockResolvedValue({
      id: 'tt-1',
      tableName: 'target_table_1',
    });

    const cmd = new ActivateTagCommand('tag-1', 'user-1');
    const res = await service.activateTag(cmd);

    expect(mockTagDomainService.getTag).toHaveBeenCalledWith('tag-1');
    expect(mockMvDomainService.createMv).toHaveBeenCalled();
    expect(mockTagDomainService.updateTagStatus).toHaveBeenCalledWith('tag-1', TagStatus.ACTIVE);
    expect(res.success).toBe(true);
    expect(res.mvNames[0]).toBe('mv_tag_tag-1_v1');
    expect(res.targetTableNames[0]).toBe('target_table_1');
  });

  it(' activateTag: 标签不存在时返回错误', async () => {
    mockTagDomainService.getTag.mockResolvedValue(null);
    mockBitmapApplicationService.getTagBitAssignment.mockResolvedValue({
      tagId: 'tag-1',
      tagName: 'Test Tag',
      bitmapTableId: 'bt-1',
      bitPosition: 0
    });

    const res = await service.activateTag(new ActivateTagCommand('tag-1', 'user-1'));
    expect(res.success).toBe(false);
    expect(res.error).toContain('标签不存在: tag-1');
  });

  it(' activateTag: 缺少当前版本时返回错误', async () => {
    const mockTag: any = {
      id: 'tag-1',
      currentVersion: null,
      updateCycle: MVUpdateCycle.DAILY
    };
    mockTagDomainService.getTag.mockResolvedValue(mockTag);
    mockBitmapApplicationService.getTagBitAssignment.mockResolvedValue({
      tagId: 'tag-1',
      tagName: 'Test Tag',
      bitmapTableId: 'bt-1',
      bitPosition: 0
    });

    const res = await service.activateTag(new ActivateTagCommand('tag-1', 'user-1'));
    expect(res.success).toBe(false);
    expect(res.error).toContain('标签没有当前版本');
  });

  it(' activateTag: MV 创建失败应该返回错误信息', async () => {
    const mockTag: MockTag = {
      id: 'tag-1',
      updateCycle: UpdateCycle.DAILY,
      currentVersion: { version: 1, calculationRule: JSON.stringify({ ruleType: 'SQL', ruleContent: 'SELECT 1' }) }
    };
    mockTagDomainService.getTag.mockResolvedValue(mockTag);
    mockMvDomainService.createMv.mockRejectedValue(new Error('boom'));
    mockBitmapApplicationService.getTagBitAssignment.mockResolvedValue({
      tagId: 'tag-1',
      tagName: 'Test Tag',
      bitmapTableId: 'bt-1',
      bitPosition: 0
    });
    mockTargetTableRepository.findByTagId.mockResolvedValue({
      id: 'tt-1',
      tableName: 'target_table_1',
    });

    const res = await service.activateTag(new ActivateTagCommand('tag-1', 'user-1'));
    expect(res.success).toBe(false);
    expect(res.error).toBe('boom');
  });

  it(' activateTag: 未分配 Bit 时返回错误', async () => {
    const mockTag: MockTag = {
      id: 'tag-1',
      updateCycle: MVUpdateCycle.DAILY,
      currentVersion: { version: 1, calculationRule: JSON.stringify({ ruleType: 'SQL', ruleContent: 'SELECT 1' }) }
    };
    mockTagDomainService.getTag.mockResolvedValue(mockTag);
    mockBitmapApplicationService.getTagBitAssignment.mockResolvedValue(null);

    const res = await service.activateTag(new ActivateTagCommand('tag-1', 'user-1'));
    expect(res.success).toBe(false);
    expect(res.error).toContain('标签未分配 Bit 位置');
  });
});
