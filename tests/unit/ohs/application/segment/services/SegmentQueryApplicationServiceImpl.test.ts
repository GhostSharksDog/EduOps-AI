import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { SegmentQueryApplicationServiceImpl } from '@/modules/segment/services/SegmentQueryApplicationServiceImpl';
import { SegmentRepository } from '@/modules/segment/domain/ports/SegmentRepository';
import { SegmentOHSAdapter } from '@/modules/segment/services/SegmentOHSAdapter';
import { Segment } from '@/modules/segment/domain/index';
import { SegmentVO } from '@/modules/segment/contracts/schemas/response/segment/index';

describe('SegmentQueryApplicationServiceImpl', () => {
  let service: SegmentQueryApplicationServiceImpl;
  let mockRepository: SegmentRepository;
  let mockAdapter: SegmentOHSAdapter;

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn() as Mock,
      findByName: vi.fn() as Mock,
      findByStatus: vi.fn() as Mock,
      findAll: vi.fn() as Mock,
      save: vi.fn() as Mock,
      remove: vi.fn() as Mock
    };
    mockAdapter = {
      fromRequestToListSegmentsQuery: vi.fn() as Mock,
      fromRequestToGetSegmentQuery: vi.fn() as Mock,
      fromRequestToCreateSegmentCommand: vi.fn() as Mock,
      fromRequestToUpdateSegmentCommand: vi.fn() as Mock,
      fromRequestToDeleteSegmentCommand: vi.fn() as Mock,
      fromSegmentToSegmentVO: vi.fn() as Mock,
      fromSegmentListToSegmentVOList: vi.fn() as Mock,
      fromSegmentMemberToSegmentMemberVO: vi.fn() as Mock,
      fromSegmentMemberListToSegmentMemberVOList: vi.fn() as Mock
    };
    service = new SegmentQueryApplicationServiceImpl(mockRepository, mockAdapter);
  });

  describe('getSegment', () => {
    it('should get segment by id', async () => {
      const mockSegment = { id: 'seg-123', name: 'Test Segment' } as Segment;
      const mockVO = { id: 'seg-123', name: 'Test Segment' } as SegmentVO;
      
      mockRepository.findById = vi.fn().mockResolvedValue(mockSegment);
      mockAdapter.fromSegmentToSegmentVO = vi.fn().mockReturnValue(mockVO);

      const dto = { id: 'seg-123' };
      const result = await service.getSegment(dto);

      expect(mockRepository.findById).toHaveBeenCalledWith('seg-123', undefined);
      expect(result.id).toBe('seg-123');
    });

    it('should get segment by name', async () => {
      const mockSegment = { id: 'seg-123', name: 'Test Segment' } as Segment;
      const mockVO = { id: 'seg-123', name: 'Test Segment' } as SegmentVO;
      
      mockRepository.findByName = vi.fn().mockResolvedValue(mockSegment);
      mockAdapter.fromSegmentToSegmentVO = vi.fn().mockReturnValue(mockVO);

      const dto = { name: 'Test Segment' };
      const result = await service.getSegment(dto);

      expect(mockRepository.findByName).toHaveBeenCalledWith('Test Segment', undefined);
      expect(result.name).toBe('Test Segment');
    });

    it('should throw error when neither id nor name provided', async () => {
      const dto = {};
      
      await expect(service.getSegment(dto)).rejects.toThrow('必须提供 ID 或名称');
    });
  });

  describe('listSegments', () => {
    it('should list segments with pagination', async () => {
      const mockSegments = [
        { id: 'seg-1', name: 'Segment 1' },
        { id: 'seg-2', name: 'Segment 2' }
      ] as Segment[];
      const mockVO1 = { id: 'seg-1', name: 'Segment 1' } as SegmentVO;
      const mockVO2 = { id: 'seg-2', name: 'Segment 2' } as SegmentVO;
      
      mockRepository.findAll = vi.fn().mockResolvedValue({ items: mockSegments });
      mockAdapter.fromSegmentToSegmentVO = vi.fn()
        .mockReturnValueOnce(mockVO1)
        .mockReturnValueOnce(mockVO2);

      const dto = { page: 1, pageSize: 10 };
      const result = await service.listSegments(dto);

      expect(mockRepository.findAll).toHaveBeenCalled();
      expect(result.items).toHaveLength(2);
    });
  });

  describe('checkNameExists', () => {
    it('should return true when segment name exists', async () => {
      const mockSegment = { id: 'seg-123', name: 'Existing Segment' } as Segment;
      
      mockRepository.findByName = vi.fn().mockResolvedValue(mockSegment);

      const result = await service.checkNameExists('Existing Segment');

      expect(mockRepository.findByName).toHaveBeenCalledWith('Existing Segment', undefined);
      expect(result).toBe(true);
    });

    it('should return false when segment name does not exist', async () => {
      mockRepository.findByName = vi.fn().mockResolvedValue(null);

      const result = await service.checkNameExists('Non-existing Segment');

      expect(result).toBe(false);
    });
  });
});
