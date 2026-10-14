import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { TagQueryApplicationServiceImpl } from '@/modules/tag/services/TagQueryApplicationServiceImpl';
import { TagQueryDomainService } from '@/modules/tag/domain/services/ports/TagQueryDomainService';
import { ITagOHSAdapter } from '@/modules/tag/services/ITagOHSAdapter';
import { Tag } from '@/modules/tag/domain/index';
import { TagVO } from '@/modules/tag/contracts/schemas/response/tag/index';
import { TagStatus, TagValueType, UpdateCycle } from '@/shared/enums/index';

const createMockTag = (overrides: Partial<Tag> = {}): Tag => {
  return {
    id: 'tag-1',
    name: 'Test Tag',
    dataType: TagValueType.STRING,
    status: TagStatus.ACTIVE,
    updateCycle: UpdateCycle.DAILY,
    ownedBy: 'user-1',
    categoryId: 'cat-1',
    createTime: new Date(),
    createdBy: 'user-1',
    isPublic: false,
    versions: [],
    isDeleted: false,
    tagValues: [],
    ...overrides
  } as Tag;
};

const createMockTagVO = (overrides: Partial<TagVO> = {}): TagVO => {
  return {
    id: 'tag-1',
    name: 'Test Tag',
    dataType: TagValueType.STRING,
    status: TagStatus.ACTIVE,
    updateCycle: UpdateCycle.DAILY,
    isPublic: false,
    isDeleted: false,
    createTime: new Date().toISOString(),
    feature: {},
    ...overrides
  } as TagVO;
};

describe('TagQueryApplicationServiceImpl', () => {
  let service: TagQueryApplicationServiceImpl;
  let mockDomainService: TagQueryDomainService;
  let mockAdapter: ITagOHSAdapter;

  beforeEach(() => {
    mockDomainService = {
      searchTags: vi.fn() as Mock,
      countTagsByCriteria: vi.fn() as Mock,
      getTagsByCategory: vi.fn() as Mock,
      getTagsByType: vi.fn() as Mock,
      getTagsByStatus: vi.fn() as Mock
    } as unknown as TagQueryDomainService;
    mockAdapter = {
      fromTagToTagVO: vi.fn() as Mock,
      fromTagListToTagVOList: vi.fn() as Mock,
      fromDTOToTagEntity: vi.fn() as Mock,
      fromDTOToUpdateTagEntity: vi.fn() as Mock,
      fromRequestToGetTagQuery: vi.fn() as Mock,
      fromRequestToListTagsQuery: vi.fn() as Mock,
      fromRequestToListTagVersionsQuery: vi.fn() as Mock,
      fromRequestToSearchTagsQuery: vi.fn() as Mock,
      fromRequestToGetTagsByCategoryQuery: vi.fn() as Mock,
      fromRequestToGetTagsByTypeQuery: vi.fn() as Mock,
      fromRequestToGetTagsByStatusQuery: vi.fn() as Mock,
      fromRequestToCountTagsQuery: vi.fn() as Mock,
      fromRequestToExportTagsQuery: vi.fn() as Mock,
      fromRequestToCreateTagCommand: vi.fn() as Mock,
      fromRequestToUpdateTagCommand: vi.fn() as Mock,
      fromRequestToUpdateTagStatusCommand: vi.fn() as Mock,
      fromRequestToDeleteTagCommand: vi.fn() as Mock,
      fromRequestToCreateTagVersionCommand: vi.fn() as Mock,
      fromRequestToSetCurrentVersionCommand: vi.fn() as Mock
    };
    service = new TagQueryApplicationServiceImpl(mockDomainService, mockAdapter);
  });

  describe('searchTags', () => {
    it('should search tags and return paged response', async () => {
      const mockTags = [
        createMockTag({ id: 'tag-1', name: 'Tag 1' }),
        createMockTag({ id: 'tag-2', name: 'Tag 2' })
      ];
      const mockVO1 = createMockTagVO({ id: 'tag-1', name: 'Tag 1' });
      const mockVO2 = createMockTagVO({ id: 'tag-2', name: 'Tag 2' });
      
      mockDomainService.searchTags = vi.fn().mockResolvedValue(mockTags);
      mockDomainService.countTagsByCriteria = vi.fn().mockResolvedValue(25);
      mockAdapter.fromTagToTagVO = vi.fn()
        .mockReturnValueOnce(mockVO1)
        .mockReturnValueOnce(mockVO2);

      const query = { name: 'Tag', page: 2, pageSize: 10 };
      const result = await service.searchTags(query);

      expect(mockDomainService.searchTags).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Tag' }),
        expect.objectContaining({ page: 2, pageSize: 10 })
      );
      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(25);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
    });

    it('should use default pagination when not provided', async () => {
      mockDomainService.searchTags = vi.fn().mockResolvedValue([]);
      mockDomainService.countTagsByCriteria = vi.fn().mockResolvedValue(0);

      const query = { name: 'Tag' };
      const result = await service.searchTags(query);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });
  });

  describe('getTagsByCategory', () => {
    it('should get tags by category with pagination', async () => {
      const mockTags = [createMockTag({ id: 'tag-1', categoryId: 'cat-1' })];
      const mockVO = createMockTagVO({ id: 'tag-1' });
      
      mockDomainService.getTagsByCategory = vi.fn().mockResolvedValue(mockTags);
      mockDomainService.countTagsByCriteria = vi.fn().mockResolvedValue(5);
      mockAdapter.fromTagToTagVO = vi.fn().mockReturnValue(mockVO);

      const query = { categoryId: 'cat-1', page: 1, pageSize: 20 };
      const result = await service.getTagsByCategory(query);

      expect(mockDomainService.getTagsByCategory).toHaveBeenCalledWith(
        'cat-1',
        expect.objectContaining({ page: 1, pageSize: 20 })
      );
      expect(result.items).toHaveLength(1);
      expect(result.totalCount).toBe(5);
    });
  });

  describe('getTagsByType', () => {
    it('should get tags by type', async () => {
      const mockTags = [createMockTag({ id: 'tag-1' })];
      const mockVO = createMockTagVO({ id: 'tag-1' });
      
      mockDomainService.searchTags = vi.fn().mockResolvedValue(mockTags);
      mockDomainService.countTagsByCriteria = vi.fn().mockResolvedValue(3);
      mockAdapter.fromTagToTagVO = vi.fn().mockReturnValue(mockVO);

      const query = { type: 'SIMPLE' as const, page: 1, pageSize: 10 };
      const result = await service.getTagsByType(query);

      expect(result.items).toHaveLength(1);
      expect(result.totalCount).toBe(3);
    });
  });

  describe('getTagsByStatus', () => {
    it('should get tags by status', async () => {
      const mockTags = [createMockTag({ id: 'tag-1', status: TagStatus.ACTIVE })];
      const mockVO = createMockTagVO({ id: 'tag-1', status: TagStatus.ACTIVE });
      
      mockDomainService.getTagsByStatus = vi.fn().mockResolvedValue(mockTags);
      mockDomainService.countTagsByCriteria = vi.fn().mockResolvedValue(10);
      mockAdapter.fromTagToTagVO = vi.fn().mockReturnValue(mockVO);

      const query = { status: TagStatus.ACTIVE, page: 1, pageSize: 10 };
      const result = await service.getTagsByStatus(query);

      expect(mockDomainService.getTagsByStatus).toHaveBeenCalledWith(
        TagStatus.ACTIVE,
        expect.objectContaining({ page: 1, pageSize: 10, sortOrder: 'desc' })
      );
      expect(result.totalCount).toBe(10);
    });
  });

  describe('countTags', () => {
    it('should return tag count', async () => {
      mockDomainService.countTagsByCriteria = vi.fn().mockResolvedValue(42);

      const query = { name: 'test' };
      const result = await service.countTags(query);

      expect(mockDomainService.countTagsByCriteria).toHaveBeenCalled();
      expect(result).toBe(42);
    });
  });

  describe('exportTags', () => {
    it('should return export task VO', async () => {
      const query = { name: 'test', format: 'csv' };
      const result = await service.exportTags(query);

      expect(result.id).toMatch(/^task-\d+$/);
      expect(result.status).toBeDefined();
    });
  });
});
