import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { SegmentQueryDomainServiceImpl } from '@/modules/segment/domain/services/SegmentQueryDomainServiceImpl';
import { SegmentRepository } from '@/modules/segment/domain/ports/SegmentRepository';
import { Segment } from '@/modules/segment/domain/index';
import { SegmentType, SegmentStatus, SortOrder } from '@/shared/enums/index';
import { MockFactory } from '../../../../helpers/mock-factory';
import { generateTestUuid } from '../../../../helpers/constants';

describe('SegmentQueryDomainServiceImpl', () => {
  let service: SegmentQueryDomainServiceImpl;
  let mockRepository: SegmentRepository;

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn() as Mock,
      findByName: vi.fn() as Mock,
      findByStatus: vi.fn() as Mock,
      findAll: vi.fn() as Mock,
      save: vi.fn() as Mock,
      remove: vi.fn() as Mock
    };
    service = new SegmentQueryDomainServiceImpl(mockRepository);
  });

  describe('getSegment', () => {
    it('should return segment when found', async () => {
      const segmentId = generateTestUuid();
      const mockSegment = MockFactory.createSegmentVO({
        id: segmentId,
        name: 'Test Segment',
        entityType: SegmentType.STATIC
      }) as unknown as Segment;

      mockRepository.findById = vi.fn().mockResolvedValue(mockSegment);

      const result = await service.getSegment(segmentId);

      expect(result?.id).toBe(segmentId);
      expect(mockRepository.findById).toHaveBeenCalledWith(segmentId, undefined);
    });

    it('should return null when segment not found', async () => {
      mockRepository.findById = vi.fn().mockResolvedValue(null);

      const result = await service.getSegment(generateTestUuid());

      expect(result).toBeNull();
    });
  });

  describe('listSegments', () => {
    it('should return list of segments with default pagination', async () => {
      const mockSegments = [
        MockFactory.createSegmentVO({ name: 'Segment 1' }) as unknown as Segment,
        MockFactory.createSegmentVO({ name: 'Segment 2' }) as unknown as Segment
      ];

      mockRepository.findAll = vi.fn().mockResolvedValue({ items: mockSegments });

      const result = await service.listSegments();

      expect(result).toHaveLength(2);
      expect(mockRepository.findAll).toHaveBeenCalledWith({
        name: undefined,
        type: undefined,
        status: undefined,
        pagination: {
          page: 1,
          pageSize: 100,
          sortOrder: SortOrder.ASC
        },
        tenantFilter: undefined
      });
    });

    it('should apply filter parameters', async () => {
      const mockSegments = [
        MockFactory.createSegmentVO({ name: 'Active Segment', entityType: SegmentType.DYNAMIC }) as unknown as Segment
      ];

      mockRepository.findAll = vi.fn().mockResolvedValue({ items: mockSegments });

      const filter = {
        name: 'Active',
        type: SegmentType.DYNAMIC,
        status: SegmentStatus.ACTIVE,
        pagination: { page: 2, pageSize: 20, sortOrder: SortOrder.ASC }
      };

      const result = await service.listSegments(filter);

      expect(mockRepository.findAll).toHaveBeenCalledWith({
        name: 'Active',
        type: SegmentType.DYNAMIC,
        status: SegmentStatus.ACTIVE,
        pagination: {
          page: 2,
          pageSize: 20,
          sortOrder: SortOrder.ASC
        },
        tenantFilter: undefined
      });
    });

    it('should use default pagination when not provided', async () => {
      mockRepository.findAll = vi.fn().mockResolvedValue({ items: [] });

      const filter = { name: 'Test' };
      await service.listSegments(filter);

      expect(mockRepository.findAll).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Test',
        pagination: {
          page: 1,
          pageSize: 100,
          sortOrder: SortOrder.ASC
        }
      }));
    });
  });

  describe('compareSegments', () => {
    it('should compare multiple segments and return basic info', async () => {
      const segmentId1 = generateTestUuid();
      const segmentId2 = generateTestUuid();
      const mockSegments = [
        {
          id: segmentId1,
          name: 'Segment A',
          type: SegmentType.STATIC,
          conditionGroup: { conditions: [{ id: 'c1' }, { id: 'c2' }] }
        },
        {
          id: segmentId2,
          name: 'Segment B',
          type: SegmentType.DYNAMIC,
          conditionGroup: { conditions: [{ id: 'c3' }] }
        }
      ] as Segment[];

      mockRepository.findById = vi.fn()
        .mockResolvedValueOnce(mockSegments[0])
        .mockResolvedValueOnce(mockSegments[1]);

      const result = await service.compareSegments([segmentId1, segmentId2]);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: segmentId1,
        name: 'Segment A',
        type: SegmentType.STATIC,
        conditionCount: 2
      });
      expect(result[1]).toEqual({
        id: segmentId2,
        name: 'Segment B',
        type: SegmentType.DYNAMIC,
        conditionCount: 1
      });
    });

    it('should handle segment with no condition group', async () => {
      const segmentId = generateTestUuid();
      const mockSegment = {
        id: segmentId,
        name: 'Empty Segment',
        type: SegmentType.STATIC,
        conditionGroup: null
      } as unknown as Segment;

      mockRepository.findById = vi.fn().mockResolvedValue(mockSegment);

      const result = await service.compareSegments([segmentId]);

      expect(result[0].conditionCount).toBe(0);
    });

    it('should handle segment with condition group but no conditions', async () => {
      const segmentId = generateTestUuid();
      const mockSegment = {
        id: segmentId,
        name: 'Empty Segment',
        type: SegmentType.STATIC,
        conditionGroup: { conditions: [] }
      } as unknown as Segment;

      mockRepository.findById = vi.fn().mockResolvedValue(mockSegment);

      const result = await service.compareSegments([segmentId]);

      expect(result[0].conditionCount).toBe(0);
    });

    it('should skip not found segments', async () => {
      const segmentId = generateTestUuid();
      const mockSegment = {
        id: segmentId,
        name: 'Found Segment',
        type: SegmentType.STATIC,
        conditionGroup: { conditions: [] }
      } as unknown as Segment;

      mockRepository.findById = vi.fn()
        .mockResolvedValueOnce(mockSegment)
        .mockResolvedValueOnce(null);

      const result = await service.compareSegments([segmentId, generateTestUuid()]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(segmentId);
    });

    it('should return empty array when no segments found', async () => {
      mockRepository.findById = vi.fn().mockResolvedValue(null);

      const result = await service.compareSegments([generateTestUuid(), generateTestUuid()]);

      expect(result).toHaveLength(0);
    });
  });
});
