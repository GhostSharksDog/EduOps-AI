import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { SegmentDomainServiceImpl } from '@/modules/segment/domain/services/SegmentDomainServiceImpl';
import { SegmentRepository } from '@/modules/segment/domain/ports/SegmentRepository';
import { SegmentFactory } from '@/modules/segment/domain/factories/index';
import { TagQueryDomainService } from '@/modules/tag/domain/services/ports/TagQueryDomainService';
import { Segment } from '@/modules/segment/domain/entities/Segment';
import { SegmentCreateCommand, SegmentUpdateCommand } from '@/modules/segment/contracts/commands/index';
import { SegmentDeleteCommand } from '@/modules/segment/domain/commands/SegmentDeleteCommand';
import { SegmentStatus, SegmentType, ConditionOperator, SegmentCalculationType } from '@/shared/enums/index';
import { MockFactory } from '../../../../helpers/mock-factory';
import { TEST_USER_ID, generateTestUuid } from '../../../../helpers/constants';

describe('SegmentDomainServiceImpl', () => {
  let service: SegmentDomainServiceImpl;
  let mockRepository: SegmentRepository;
  let mockFactory: SegmentFactory;
  let mockTagQueryService: TagQueryDomainService;

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn() as Mock,
      findByName: vi.fn() as Mock,
      findByStatus: vi.fn() as Mock,
      save: vi.fn() as Mock,
      remove: vi.fn() as Mock,
      findAll: vi.fn() as Mock
    };
    mockFactory = {
      createSegment: vi.fn() as Mock,
      createCondition: vi.fn() as Mock,
      createConditionGroup: vi.fn() as Mock,
      createSegmentMember: vi.fn() as Mock
    };
    mockTagQueryService = {
      getTagsByIds: vi.fn() as Mock,
      searchTags: vi.fn() as Mock,
      getTagsByCategory: vi.fn() as Mock,
      getTagsByStatus: vi.fn() as Mock,
      countTagsByCriteria: vi.fn() as Mock,
      countTagsByCategoryIds: vi.fn() as Mock
    };
    service = new SegmentDomainServiceImpl(mockRepository, mockFactory, mockTagQueryService);
  });

  describe('createSegment', () => {
    it('should create and save a new segment', async () => {
      const command: SegmentCreateCommand = {
        name: 'New Segment',
        type: SegmentType.STATIC,
        calculationType: SegmentCalculationType.OFFLINE,
        conditionGroup: {
          operator: ConditionOperator.AND,
          conditions: []
        },
        createdBy: TEST_USER_ID
      };

      const mockSegment = MockFactory.createSegmentVO({
        name: 'New Segment',
        entityType: SegmentType.STATIC,
        computeType: SegmentCalculationType.OFFLINE,
        ownedBy: TEST_USER_ID
      }) as unknown as Segment;

      mockRepository.findByName = vi.fn().mockResolvedValue(null);
      mockFactory.createSegment = vi.fn().mockReturnValue(mockSegment);
      mockRepository.save = vi.fn().mockResolvedValue(undefined);

      const result = await service.createSegment(command);

      expect(result.name).toBe('New Segment');
      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockRepository.findByName).toHaveBeenCalledWith('New Segment');
    });

    it('should throw error when segment name already exists', async () => {
      const existingSegment = MockFactory.createSegmentVO({
        name: 'Existing Segment',
        ownedBy: TEST_USER_ID
      }) as unknown as Segment;

      mockRepository.findByName = vi.fn().mockResolvedValue(existingSegment);

      const command: SegmentCreateCommand = {
        name: 'Existing Segment',
        type: SegmentType.STATIC,
        calculationType: SegmentCalculationType.OFFLINE,
        conditionGroup: {
          operator: ConditionOperator.AND,
          conditions: []
        },
        createdBy: TEST_USER_ID
      };

      await expect(service.createSegment(command)).rejects.toThrow('已存在');
    });
  });

  describe('updateSegment', () => {
    it('should update segment name', async () => {
      const segmentId = generateTestUuid();
      const segment = MockFactory.createSegmentVO({
        id: segmentId,
        name: 'Old Name',
        description: 'Old Description',
        ownedBy: TEST_USER_ID
      }) as unknown as Segment;

      mockRepository.findById = vi.fn().mockResolvedValue(segment);
      mockRepository.findByName = vi.fn().mockResolvedValue(null);
      mockRepository.save = vi.fn().mockResolvedValue(undefined);

      const command: SegmentUpdateCommand = {
        id: segmentId,
        name: 'New Name',
        updatedBy: TEST_USER_ID
      };

      const result = await service.updateSegment(command);

      expect(result.name).toBe('New Name');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should update segment description', async () => {
      const segmentId = generateTestUuid();
      const segment = MockFactory.createSegmentVO({
        id: segmentId,
        name: 'Test Segment',
        description: 'Old Description',
        ownedBy: TEST_USER_ID
      }) as unknown as Segment;

      mockRepository.findById = vi.fn().mockResolvedValue(segment);
      mockRepository.save = vi.fn().mockResolvedValue(undefined);

      const command: SegmentUpdateCommand = {
        id: segmentId,
        description: 'New Description',
        updatedBy: TEST_USER_ID
      };

      const result = await service.updateSegment(command);

      expect(result.description).toBe('New Description');
    });

    it('should throw error when segment not found', async () => {
      mockRepository.findById = vi.fn().mockResolvedValue(null);

      const command: SegmentUpdateCommand = {
        id: generateTestUuid(),
        name: 'New Name',
        updatedBy: TEST_USER_ID
      };

      await expect(service.updateSegment(command)).rejects.toThrow('不存在');
    });

    it('should throw error when updating to existing name', async () => {
      const segmentId = generateTestUuid();
      const segment = MockFactory.createSegmentVO({
        id: segmentId,
        name: 'Old Name',
        ownedBy: TEST_USER_ID
      }) as unknown as Segment;

      const existingSegment = MockFactory.createSegmentVO({
        name: 'Existing Name',
        ownedBy: TEST_USER_ID
      }) as unknown as Segment;

      mockRepository.findById = vi.fn().mockResolvedValue(segment);
      mockRepository.findByName = vi.fn().mockResolvedValue(existingSegment);

      const command: SegmentUpdateCommand = {
        id: segmentId,
        name: 'Existing Name',
        updatedBy: TEST_USER_ID
      };

      await expect(service.updateSegment(command)).rejects.toThrow('已存在');
    });
  });

  describe('deleteSegment', () => {
    it('should delete segment when it exists', async () => {
      const segmentId = generateTestUuid();
      const segment = MockFactory.createSegmentVO({
        id: segmentId,
        name: 'Test Segment',
        ownedBy: TEST_USER_ID
      }) as unknown as Segment;

      mockRepository.findById = vi.fn().mockResolvedValue(segment);
      mockRepository.remove = vi.fn().mockResolvedValue(undefined);

      const command: SegmentDeleteCommand = {
        id: segmentId,
        deletedBy: TEST_USER_ID
      };

      await service.deleteSegment(command);

      expect(mockRepository.remove).toHaveBeenCalledWith(segmentId);
    });

    it('should throw error when segment not found', async () => {
      mockRepository.findById = vi.fn().mockResolvedValue(null);

      const command: SegmentDeleteCommand = {
        id: generateTestUuid(),
        deletedBy: TEST_USER_ID
      };

      await expect(service.deleteSegment(command)).rejects.toThrow('不存在');
    });
  });

  describe('activateSegment', () => {
    it('should set segment status to ACTIVE', async () => {
      const segmentId = generateTestUuid();
      const segment = MockFactory.createSegmentVO({
        id: segmentId,
        status: SegmentStatus.DRAFT,
        ownedBy: TEST_USER_ID
      }) as unknown as Segment;

      mockRepository.findById = vi.fn().mockResolvedValue(segment);
      mockRepository.save = vi.fn().mockResolvedValue(undefined);

      const result = await service.activateSegment(segmentId);

      expect(result.status).toBe(SegmentStatus.ACTIVE);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw error when segment not found', async () => {
      mockRepository.findById = vi.fn().mockResolvedValue(null);

      await expect(service.activateSegment(generateTestUuid())).rejects.toThrow('不存在');
    });
  });

  describe('deactivateSegment', () => {
    it('should set segment status to INACTIVE', async () => {
      const segmentId = generateTestUuid();
      const segment = MockFactory.createSegmentVO({
        id: segmentId,
        status: SegmentStatus.ACTIVE,
        ownedBy: TEST_USER_ID
      }) as unknown as Segment;

      mockRepository.findById = vi.fn().mockResolvedValue(segment);
      mockRepository.save = vi.fn().mockResolvedValue(undefined);

      const result = await service.deactivateSegment(segmentId);

      expect(result.status).toBe(SegmentStatus.INACTIVE);
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });
});
