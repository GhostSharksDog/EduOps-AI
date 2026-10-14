import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { TagRefreshMonitorServiceImpl } from '@/modules/tag/services/TagRefreshMonitorServiceImpl';
import { MvRefreshStatusReport } from '@/modules/tag/services/TagRefreshMonitorService';

describe('TagRefreshMonitorServiceImpl', () => {
  let service: TagRefreshMonitorServiceImpl;
  let mockTagDomainService: any;
  let mockMvDomainService: any;
  let mockRefreshLogRepository: any;
  let mockMvConfigRepository: any;

  beforeEach(() => {
    mockTagDomainService = { getTag: vi.fn() };
    mockMvDomainService = { getRefreshStatus: vi.fn() };
    mockRefreshLogRepository = { create: vi.fn(), findUnresolved: vi.fn(), hasUnresolvedError: vi.fn().mockResolvedValue(false) };
    mockMvConfigRepository = { findAllWithTagName: vi.fn(), findByTagId: vi.fn() };

    service = new TagRefreshMonitorServiceImpl(
      mockTagDomainService,
      mockMvDomainService,
      mockRefreshLogRepository,
      mockMvConfigRepository
    );
  });

  it('checkRefreshStatus: 标签不存在应返回 error 状态', async () => {
    mockTagDomainService.getTag.mockResolvedValue(null);

    const res = await service.checkRefreshStatus('tag-1');
    expect(res.status).toBe('error');
    expect(res.tagId).toBe('tag-1');
  });

  it('checkRefreshStatus: 正常状态应返回 healthy', async () => {
    mockTagDomainService.getTag.mockResolvedValue({ id: 'tag-1', name: 'Tag1', currentVersion: { version: 1 } });
    mockMvConfigRepository.findByTagId.mockResolvedValue([
      { tagId: 'tag-1', tagName: 'Tag1', mvName: 'mv_tag_tag-1_v1' }
    ]);
    mockMvDomainService.getRefreshStatus.mockResolvedValue({ lastRefreshTime: new Date(), isStale: false, name: 'mv_tag_tag-1_v1' } as any);

    const res = await service.checkRefreshStatus('tag-1');
    expect(res.status).toBe('healthy');
  });
});
