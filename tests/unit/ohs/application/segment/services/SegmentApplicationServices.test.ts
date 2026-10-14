import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { SegmentManagementApplicationServiceImpl } from '@/modules/segment/services/SegmentManagementApplicationServiceImpl';
import { SegmentQueryApplicationServiceImpl } from '@/modules/segment/services/SegmentQueryApplicationServiceImpl';
import { Segment } from '@/modules/segment/domain/entities/Segment';
import { SegmentStatus, SegmentType, SegmentCalculationType } from '@/shared/enums/index';

describe('SegmentApplicationServices', () => {
  describe('SegmentManagementApplicationServiceImpl', () => {
    let service: SegmentManagementApplicationServiceImpl;
    let mockRepository: any;
    let mockDomainService: any;
    let mockOHSAdapter: any;

    beforeEach(() => {
      mockRepository = {
        findById: vi.fn() as Mock,
        save: vi.fn() as Mock,
        delete: vi.fn() as Mock
      };

      mockDomainService = {
        createSegment: vi.fn() as Mock,
        updateSegment: vi.fn() as Mock,
        deleteSegment: vi.fn() as Mock,
        activateSegment: vi.fn() as Mock,
        deactivateSegment: vi.fn() as Mock
      };

      mockOHSAdapter = {
        fromSegmentToSegmentVO: vi.fn() as Mock
      };

      service = new SegmentManagementApplicationServiceImpl(mockRepository, mockDomainService, mockOHSAdapter);
    });

    it('should have createSegment method', () => {
      expect(typeof service.createSegment).toBe('function');
    });

    it('should have updateSegment method', () => {
      expect(typeof service.updateSegment).toBe('function');
    });

    it('should have deleteSegment method', () => {
      expect(typeof service.deleteSegment).toBe('function');
    });
  });

  describe('SegmentQueryApplicationServiceImpl', () => {
    let service: SegmentQueryApplicationServiceImpl;
    let mockRepository: any;
    let mockOHSAdapter: any;

    beforeEach(() => {
      mockRepository = {
        findById: vi.fn() as Mock,
        findAll: vi.fn() as Mock,
        count: vi.fn() as Mock
      };

      mockOHSAdapter = {
        fromSegmentToSegmentVO: vi.fn() as Mock
      };

      service = new SegmentQueryApplicationServiceImpl(mockRepository, mockOHSAdapter);
    });

    it('should get segment by id', async () => {
      const segment = new Segment('segment-001', 'Test Segment', 'user-001', new Date(), 'user-001');

      (mockRepository.findById as Mock).mockResolvedValue(segment);
      (mockOHSAdapter.fromSegmentToSegmentVO as Mock).mockImplementation((s) => ({
        id: s.id,
        name: s.name,
        status: 'active',
        ownedBy: s.ownedBy,
        createTime: s.createTime,
        isDeleted: false
      }));

      const result = await service.getSegment({ id: 'segment-001' });

      expect(result.name).toBe('Test Segment');
    });

    it('should list segments', async () => {
      const segments = [
        new Segment('segment-001', 'Segment 1', 'user-001', new Date(), 'user-001'),
        new Segment('segment-002', 'Segment 2', 'user-001', new Date(), 'user-001')
      ];

      (mockRepository.findAll as Mock).mockResolvedValue({
        items: segments,
        total: 2,
        page: 1,
        pageSize: 10
      });
      (mockOHSAdapter.fromSegmentToSegmentVO as Mock).mockImplementation((s) => ({
        id: s.id,
        name: s.name,
        status: 'active',
        ownedBy: s.ownedBy,
        createTime: s.createTime,
        isDeleted: false
      }));

      const result = await service.listSegments({});

      expect(result.items.length).toBe(2);
    });
  });
});
