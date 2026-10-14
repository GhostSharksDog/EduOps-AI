import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { SegmentMemberDomainServiceImpl } from '@/modules/segment/domain/services/SegmentMemberDomainServiceImpl';
import { SegmentMemberRepository } from '@/modules/segment/domain/ports/SegmentMemberRepository';
import { SegmentMember } from '@/modules/segment/domain/index';
import { POFactory } from '../../../../helpers/mock-factory';

describe('SegmentMemberDomainServiceImpl', () => {
  let service: SegmentMemberDomainServiceImpl;
  let mockRepository: SegmentMemberRepository;

  beforeEach(() => {
    mockRepository = {
      saveMembers: vi.fn() as Mock,
      clearMembers: vi.fn() as Mock,
      findMembers: vi.fn() as Mock,
      countMembers: vi.fn() as Mock,
      isMember: vi.fn() as Mock
    };
    service = new SegmentMemberDomainServiceImpl(mockRepository);
  });

  describe('getMembers', () => {
    it('should return members with default pagination', async () => {
      const mockMembers = [
        POFactory.createSegmentMemberPO({ id: 'member-1', segmentId: 'segment-123', entityId: 'entity-1' }) as unknown as SegmentMember,
        POFactory.createSegmentMemberPO({ id: 'member-2', segmentId: 'segment-123', entityId: 'entity-2' }) as unknown as SegmentMember
      ];

      mockRepository.findMembers = vi.fn().mockResolvedValue({ items: mockMembers });

      const result = await service.exportMembers('segment-123', 'json');

      expect(result).toBeInstanceOf(Buffer);
      const content = result.toString('utf-8');
      const parsed = JSON.parse(content);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe('member-1');
    });

    it('should export members as CSV', async () => {
      const mockMembers = [
        {
          id: 'member-1',
          segmentId: 'segment-123',
          entityId: 'entity-1',
          joinMethod: 'AUTO',
          joinedAt: new Date('2024-01-15T10:30:00Z')
        },
        {
          id: 'member-2',
          segmentId: 'segment-123',
          entityId: 'entity-2',
          joinMethod: 'MANUAL',
          joinedAt: new Date('2024-01-16T11:00:00Z')
        }
      ] as unknown as SegmentMember[];

      mockRepository.findMembers = vi.fn().mockResolvedValue({ items: mockMembers });

      const result = await service.exportMembers('segment-123', 'csv');

      expect(result).toBeInstanceOf(Buffer);
      const content = result.toString('utf-8');
      const lines = content.split('\n');
      expect(lines[0]).toBe('MemberId,JoinMethod,JoinedAt');
      expect(lines[1]).toBe('member-1,AUTO,2024-01-15T10:30:00.000Z');
      expect(lines[2]).toBe('member-2,MANUAL,2024-01-16T11:00:00.000Z');
    });

    it('should fetch members with correct query parameters for export', async () => {
      mockRepository.findMembers = vi.fn().mockResolvedValue({ items: [] });

      await service.exportMembers('segment-123', 'json');

      expect(mockRepository.findMembers).toHaveBeenCalledWith('segment-123', {
        pagination: {
          page: 1,
          pageSize: 10000,
          sortOrder: 'asc'
        }
      });
    });

    it('should export empty list as JSON', async () => {
      mockRepository.findMembers = vi.fn().mockResolvedValue({ items: [] });

      const result = await service.exportMembers('segment-123', 'json');

      const content = result.toString('utf-8');
      expect(JSON.parse(content)).toEqual([]);
    });

    it('should export empty list as CSV with header only', async () => {
      mockRepository.findMembers = vi.fn().mockResolvedValue({ items: [] });

      const result = await service.exportMembers('segment-123', 'csv');

      const content = result.toString('utf-8');
      expect(content).toBe('MemberId,JoinMethod,JoinedAt\n');
    });
  });
});
