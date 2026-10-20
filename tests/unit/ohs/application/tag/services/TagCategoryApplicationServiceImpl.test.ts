import {useCompanyUnitFixture} from '@/tests/helpers/company-unit-fixture';
const companyId=useCompanyUnitFixture();
import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { TagCategoryApplicationServiceImpl } from '@/modules/tag/services/TagCategoryApplicationServiceImpl';
import { TagCategoryDomainService } from '@/modules/tag/domain/services/ports/TagCategoryDomainService';
import { TagQueryDomainService } from '@/modules/tag/domain/services/ports/TagQueryDomainService';
import { ITagCategoryOHSAdapter } from '@/modules/tag/services/ITagCategoryOHSAdapter';
import { TagCategory } from '@/modules/tag/domain/index';
import { TagCategoryVO } from '@/modules/tag/contracts/schemas/response/tag-category/index';

type MockTagCategoryDomainService = {
  [K in keyof TagCategoryDomainService]: Mock;
};

type MockTagQueryDomainService = {
  [K in keyof TagQueryDomainService]: Mock;
};

type MockITagCategoryOHSAdapter = {
  [K in keyof ITagCategoryOHSAdapter]: Mock;
};

describe('TagCategoryApplicationServiceImpl', () => {
  let service: TagCategoryApplicationServiceImpl;
  let mockDomainService: MockTagCategoryDomainService;
  let mockTagQueryDomainService: MockTagQueryDomainService;
  let mockAdapter: MockITagCategoryOHSAdapter;

  beforeEach(() => {
    mockDomainService = {
      createCategory: vi.fn(),
      getCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
      moveCategory: vi.fn(),
      reorderCategories: vi.fn(),
      canDeleteCategory: vi.fn(),
      listCategories: vi.fn(),
      countCategories: vi.fn()
    };
    mockTagQueryDomainService = {
      countTagsByCriteria: vi.fn(),
      searchTags: vi.fn(),
      getTagsByIds: vi.fn(),
      getTagsByCategory: vi.fn(),
      getTagsByStatus: vi.fn(),
      countTagsByCategoryIds: vi.fn()
    };
    mockAdapter = {
      fromEntityToTagCategoryVO: vi.fn(),
      fromEntityListToTagCategoryVOTree: vi.fn(),
      fromRequestToListCategoriesQuery: vi.fn(),
      fromRequestToGetCategoryQuery: vi.fn(),
      fromRequestToCreateCategoryCommand: vi.fn(),
      fromRequestToUpdateCategoryCommand: vi.fn(),
      fromRequestToDeleteCategoryCommand: vi.fn(),
      fromRequestToMoveCategoryCommand: vi.fn(),
      fromRequestToReorderCategoriesCommand: vi.fn(),
      fromRequestToBatchDeleteCommand: vi.fn(),
      fromDTOToTagCategoryEntity: vi.fn()
    };
    service = new TagCategoryApplicationServiceImpl(
      mockDomainService as unknown as TagCategoryDomainService,
      mockTagQueryDomainService as unknown as TagQueryDomainService,
      mockAdapter as unknown as ITagCategoryOHSAdapter
    );
  });

  describe('createCategory', () => {
    it('should create category and return VO', async () => {
      const mockCategory = { id: 'cat-123', name: 'Test Category' } as TagCategory;
      const mockVO = { id: 'cat-123', name: 'Test Category' } as TagCategoryVO;
      
      mockDomainService.createCategory.mockResolvedValue(mockCategory);
      mockAdapter.fromEntityToTagCategoryVO.mockReturnValue(mockVO);

      const command = { name: 'Test Category', description: '', orderIndex: 0, createdBy: 'user-123', ownedBy: companyId };
      const result = await service.createCategory(command);

      expect(mockDomainService.createCategory).toHaveBeenCalledWith(command);
      expect(mockAdapter.fromEntityToTagCategoryVO).toHaveBeenCalledWith(mockCategory);
      expect(result.id).toBe('cat-123');
    });
  });

  describe('getCategory', () => {
    it('should get category with tag count', async () => {
      const mockCategory = { id: 'cat-123', name: 'Test Category' } as TagCategory;
      const mockVO = { id: 'cat-123', name: 'Test Category', tagCount: 5 } as TagCategoryVO;
      
      mockDomainService.getCategory.mockResolvedValue(mockCategory);
      mockTagQueryDomainService.countTagsByCriteria.mockResolvedValue(5);
      mockAdapter.fromEntityToTagCategoryVO.mockReturnValue(mockVO);

      const query = { categoryId: 'cat-123' };
      const result = await service.getCategory(query);

      expect(mockDomainService.getCategory).toHaveBeenCalledWith('cat-123', undefined);
      expect(mockTagQueryDomainService.countTagsByCriteria).toHaveBeenCalledWith({ categoryId: 'cat-123' });
      expect(result.tagCount).toBe(5);
    });
  });

  describe('updateCategory', () => {
    it('should update category and return VO', async () => {
      const mockCategory = { id: 'cat-123', name: 'Updated Category' } as TagCategory;
      const mockVO = { id: 'cat-123', name: 'Updated Category' } as TagCategoryVO;
      
      mockDomainService.updateCategory.mockResolvedValue(mockCategory);
      mockAdapter.fromEntityToTagCategoryVO.mockReturnValue(mockVO);

      const command = { categoryId: 'cat-123', name: 'updated Category', updatedBy: 'user-123', ownedBy: companyId };
      const result = await service.updateCategory(command);

      expect(mockDomainService.updateCategory).toHaveBeenCalledWith('cat-123', command, { tenantId: companyId });
      expect(result.name).toBe('Updated Category');
    });
  });

  describe('deleteCategory', () => {
    it('should delete category when canDelete is true', async () => {
      mockDomainService.canDeleteCategory.mockResolvedValue(true);
      mockDomainService.deleteCategory.mockResolvedValue(undefined);

      const command = { categoryId: 'cat-123', deletedBy: 'user-123', ownedBy: companyId };
      await service.deleteCategory(command);

      expect(mockDomainService.canDeleteCategory).toHaveBeenCalledWith('cat-123', { tenantId: companyId });
      expect(mockDomainService.deleteCategory).toHaveBeenCalledWith(command, { tenantId: companyId });
    });

    it('should throw error when category cannot be deleted', async () => {
      mockDomainService.canDeleteCategory.mockResolvedValue(false);

      const command = { categoryId: 'cat-123', deletedBy: 'user-123' };
      await expect(service.deleteCategory(command)).rejects.toThrow(
        '无法删除该分类：分类下存在子分类或标签'
      );

      expect(mockDomainService.deleteCategory).not.toHaveBeenCalled();
    });
  });

  describe('listCategories', () => {
    it('should return category tree when no parentId', async () => {
      const mockCategories = [
        { id: 'cat-1', name: 'Root Category', children: [] }
      ] as unknown as TagCategory[];
      const mockVO = { id: 'cat-1', name: 'Root Category' } as TagCategoryVO;
      
      mockDomainService.listCategories.mockResolvedValue(mockCategories);
      mockDomainService.countCategories.mockResolvedValue(1);
      mockTagQueryDomainService.countTagsByCriteria.mockResolvedValue(0);
      mockAdapter.fromEntityListToTagCategoryVOTree.mockReturnValue([mockVO]);

      const query = {};
      const result = await service.listCategories(query);

      expect(result.items).toHaveLength(1);
      expect(mockDomainService.listCategories).toHaveBeenCalled();
    });
  });

  describe('moveCategory', () => {
    it('should move category and return VO', async () => {
      const mockCategory = { id: 'cat-123', parentId: 'parent-1' } as TagCategory;
      const mockVO = { id: 'cat-123', parent: { id: 'parent-1', name: 'Parent' } } as unknown as TagCategoryVO;
      
      mockDomainService.moveCategory.mockResolvedValue(mockCategory);
      mockAdapter.fromEntityToTagCategoryVO.mockReturnValue(mockVO);

      const command = { categoryId: 'cat-123', newParentId: 'parent-1', updatedBy: 'user-123', ownedBy: companyId };
      const result = await service.moveCategory(command);

      expect(mockDomainService.moveCategory).toHaveBeenCalledWith('cat-123', 'parent-1', { tenantId: companyId });
      expect(result.parent?.id).toBe('parent-1');
    });
  });

  describe('reorderCategories', () => {
    it('should reorder categories', async () => {
      mockDomainService.reorderCategories.mockResolvedValue(undefined);

      const command = { categoryIds: ['cat-1', 'cat-2', 'cat-3'], orderIndex: [0, 1, 2], updatedBy: 'user-123' };
      await service.reorderCategories(command);

      expect(mockDomainService.reorderCategories).toHaveBeenCalledWith(['cat-1', 'cat-2', 'cat-3'], [0, 1, 2], {tenantId:companyId});
    });
  });
});
