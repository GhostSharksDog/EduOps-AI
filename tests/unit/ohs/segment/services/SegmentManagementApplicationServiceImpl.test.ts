import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { SegmentManagementApplicationServiceImpl } from '@/modules/segment/services/SegmentManagementApplicationServiceImpl';
import { SegmentRepository } from '@/modules/segment/domain/ports/SegmentRepository';
import { SegmentDomainService } from '@/modules/segment/domain/services/ports/SegmentDomainService';
import { SegmentOHSAdapter } from '@/modules/segment/services/SegmentOHSAdapter';
import { SegmentStatus, SegmentType, SegmentCalculationType } from '@/shared/enums/index';

describe('SegmentManagementApplicationServiceImpl', () => {
  let service: SegmentManagementApplicationServiceImpl;
  let mockRepository: SegmentRepository;
  let mockDomainService: SegmentDomainService;
  let mockOHSAdapter: SegmentOHSAdapter;

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn() as Mock,
      findByName: vi.fn() as Mock,
      save: vi.fn() as Mock,
      remove: vi.fn() as Mock,
      findAll: vi.fn() as Mock,
      findByStatus: vi.fn() as Mock
    };
    mockDomainService = {
      createSegment: vi.fn() as Mock,
      updateSegment: vi.fn() as Mock,
      deleteSegment: vi.fn() as Mock,
      activateSegment: vi.fn() as Mock,
      deactivateSegment: vi.fn() as Mock
    };
    mockOHSAdapter = {
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
    service = new SegmentManagementApplicationServiceImpl(
      mockRepository,
      mockDomainService,
      mockOHSAdapter
    );
  });

  describe('createSegment', () => {
    it('should create segment and return VO', async () => {
      const dto = {
        name: 'Test Segment',
        entityType: SegmentType.USER,
        calculationType: SegmentCalculationType.OFFLINE,
        ownedBy: 'user-123',
        description: 'Test description',
        rules: [],
        createdBy: 'user-123'
      };

      const mockSegment = {
        id: 'segment-123',
        name: 'Test Segment',
        description: 'Test description'
      };

      const mockVO = {
        id: 'segment-123',
        name: 'Test Segment',
        description: 'Test description',
        createTime: '2024-01-01T00:00:00.000Z'
      };

      mockDomainService.createSegment = vi.fn().mockResolvedValue(mockSegment);
      mockOHSAdapter.fromSegmentToSegmentVO = vi.fn().mockReturnValue(mockVO);

      const result = await service.createSegment(dto);

      expect(result.id).toBe('segment-123');
      expect(result.name).toBe('Test Segment');
      expect(mockDomainService.createSegment).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Segment',
          type: 'USER',
          calculationType: 'OFFLINE',
          conditionGroup: {},
          description: 'Test description',
          createdBy: 'user-123'
        })
      );
      expect(mockOHSAdapter.fromSegmentToSegmentVO).toHaveBeenCalledWith(mockSegment);
    });
  });

  describe('updateSegment', () => {
    it('should update segment and return VO', async () => {
    const dto = {
      id: 'segment-123',
      name: 'Updated Name',
      description: 'Updated description',
      ownedBy: 'user-123',
      updatedBy: 'user-456',
      rules: []
    };

    const mockSegment = {
      id: 'segment-123',
      name: 'Updated Name',
      description: 'Updated description'
    };

    const mockVO = {
      id: 'segment-123',
      name: 'Updated Name',
      description: 'Updated description'
    };

    mockDomainService.updateSegment = vi.fn().mockResolvedValue(mockSegment);
    mockOHSAdapter.fromSegmentToSegmentVO = vi.fn().mockReturnValue(mockVO);

    const result = await service.updateSegment(dto);

    expect(result.name).toBe('Updated Name');
    expect(mockDomainService.updateSegment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'segment-123',
        name: 'Updated Name',
        description: 'Updated description',
        updatedBy: 'user-456'
      })
    );
  });

  it('should use owner as updater when updatedBy not provided', async () => {
    const dto = {
      id: 'segment-123',
      name: 'Updated Name',
      ownedBy: 'user-123',
      rules: []
    };

    const mockSegment = { id: 'segment-123', name: 'Updated Name' };
    const mockVO = { id: 'segment-123', name: 'Updated Name' };

    mockDomainService.updateSegment = vi.fn().mockResolvedValue(mockSegment);
    mockOHSAdapter.fromSegmentToSegmentVO = vi.fn().mockReturnValue(mockVO);

    await service.updateSegment(dto);

    expect(mockDomainService.updateSegment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'segment-123',
        name: 'Updated Name',
        description: undefined,
        updatedBy: 'user-123'
      })
    );
  });
  });

  describe('deleteSegment', () => {
    it('should delete segment', async () => {
    const dto = {
      id: 'segment-123',
      deletedBy: 'user-123'
    };

    mockDomainService.deleteSegment = vi.fn().mockResolvedValue(undefined);

    await service.deleteSegment(dto);

    expect(mockDomainService.deleteSegment).toHaveBeenCalledWith({
      id: 'segment-123',
      deletedBy: 'user-123'
    });
  });
  });

  describe('changeStatus', () => {
    it('should activate segment when status is ACTIVE', async () => {
    const dto = {
      id: 'segment-123',
      status: SegmentStatus.ACTIVE
    };

    mockDomainService.activateSegment = vi.fn().mockResolvedValue(undefined);

    await service.changeStatus(dto);

    expect(mockDomainService.activateSegment).toHaveBeenCalledWith('segment-123');
    expect(mockDomainService.deactivateSegment).not.toHaveBeenCalled();
  });

  it('should deactivate segment when status is not ACTIVE', async () => {
    const dto = {
      id: 'segment-123',
      status: SegmentStatus.INACTIVE
    };

    mockDomainService.deactivateSegment = vi.fn().mockResolvedValue(undefined);

    await service.changeStatus(dto);

    expect(mockDomainService.deactivateSegment).toHaveBeenCalledWith('segment-123');
    expect(mockDomainService.activateSegment).not.toHaveBeenCalled();
  });

  it('should handle DRAFT status as deactivate', async () => {
    const dto = {
      id: 'segment-123',
      status: SegmentStatus.DRAFT
    };

    mockDomainService.deactivateSegment = vi.fn().mockResolvedValue(undefined);

    await service.changeStatus(dto);

    expect(mockDomainService.deactivateSegment).toHaveBeenCalledWith('segment-123');
  });
  });

});
