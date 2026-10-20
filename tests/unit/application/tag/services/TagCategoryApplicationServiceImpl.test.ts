import {useCompanyUnitFixture} from '@/tests/helpers/company-unit-fixture';
const companyId=useCompanyUnitFixture();
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { TagCategoryApplicationServiceImpl } from '@/modules/tag/services/TagCategoryApplicationServiceImpl';
import type {
  CreateTagCategoryCommand,
  UpdateTagCategoryCommand,
  DeleteTagCategoryCommand,
  MoveTagCategoryCommand,
  ReorderTagCategoriesCommand
} from '@/modules/tag/contracts/commands/index';
import type { GetTagCategoryQuery, ListTagCategoriesQuery } from '@/modules/tag/contracts/queries/index';
import type { TagCategory } from '@/modules/tag/domain/entities/TagCategory';
import type { TagCategoryListVO, TagCategoryVO } from '@/modules/tag/contracts/schemas/response/tag-category/index';
import { MockFactory } from '../../../../helpers/mock-factory';
import { generateTestUuid } from '../../../../helpers/constants';

const mockTagCategoryDomainService = {
  createCategory: vi.fn(),
  getCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  canDeleteCategory: vi.fn(),
  listCategories: vi.fn(),
  countCategories: vi.fn(),
  moveCategory: vi.fn(),
  reorderCategories: vi.fn()
};

const mockTagQueryDomainService = {
  countTagsByCriteria: vi.fn(),
  countTagsByCategoryIds: vi.fn()
};

vi.mock('@/modules/tag/domain/services/ports/TagCategoryDomainService', () => ({
  TagCategoryDomainService: class {}
}));

vi.mock('@/modules/tag/domain/services/ports/TagQueryDomainService', () => ({
  TagQueryDomainService: class {}
}));

const mockTagCategoryOHSAdapter = {
  fromEntityToTagCategoryVO: vi.fn(),
  fromEntityListToTagCategoryVOTree: vi.fn()
};

function createMockCategory(overrides?: Partial<TagCategory>): TagCategory {
  const po = MockFactory.createTagCategoryPO();
  return {
    id: po.id,
    name: po.name,
    parentId: undefined,
    description: po.description as string,
    orderIndex: po.orderIndex as number,
    feature: po.feature as Record<string, unknown>,
    isDeleted: po.isDeleted as boolean,
    createTime: po.createTime as Date,
    updateTime: undefined,
    deleteTime: undefined,
    createdBy: po.createdBy as string,
    updatedBy: undefined,
    deletedBy: undefined,
    ownedBy: po.ownedBy as string,
    ...overrides
  } as TagCategory;
}

describe('TagCategoryApplicationServiceImpl', () => {
  let service: TagCategoryApplicationServiceImpl;

  beforeEach(() => {
    vi.clearAllMocks();

    service = new TagCategoryApplicationServiceImpl(
      mockTagCategoryDomainService as any,
      mockTagQueryDomainService as any,
      mockTagCategoryOHSAdapter as any
    );
  });

  describe('createCategory', () => {
    it('should create category and return VO', async () => {
      const command: CreateTagCategoryCommand = {
        name: 'Test Category',
        description: 'Test description',
        orderIndex: 0,
        createdBy: 'user-123',
        ownedBy: companyId
      };

      const mockCategory = createMockCategory();
      const expectedVO = MockFactory.createTagCategoryVO({
        id: mockCategory.id,
        name: mockCategory.name,
        description: mockCategory.description,
      });

      mockTagCategoryDomainService.createCategory.mockResolvedValue(mockCategory);
      mockTagCategoryOHSAdapter.fromEntityToTagCategoryVO.mockReturnValue(expectedVO);

      const result = await service.createCategory(command);

      expect(mockTagCategoryDomainService.createCategory).toHaveBeenCalledWith(command);
      expect(mockTagCategoryOHSAdapter.fromEntityToTagCategoryVO).toHaveBeenCalledWith(mockCategory);
      expect(result).toEqual(expectedVO);
    });

    it('should create category with parent', async () => {
      const parentId = generateTestUuid();
      const command: CreateTagCategoryCommand = {
        name: 'Child Category',
        parentId: parentId,
        description: 'Child category',
        orderIndex: 0,
        createdBy: 'user-123',
        ownedBy: companyId
      };

      const mockCategory = createMockCategory({ parentId: parentId });
      const expectedVO = MockFactory.createTagCategoryVO({ 
        id: mockCategory.id,
        parent: { 
          id: parentId,
          name: 'Parent Category',
          path: `/${parentId}`,
          orderIndex: 0,
          tagCount: 0,
          isDeleted: false,
          createTime: new Date().toISOString(),
        } 
      });

      mockTagCategoryDomainService.createCategory.mockResolvedValue(mockCategory);
      mockTagCategoryOHSAdapter.fromEntityToTagCategoryVO.mockReturnValue(expectedVO);

      const result = await service.createCategory(command);

      expect(result.parent).toHaveProperty('id', parentId);
    });
  });

  describe('getCategory', () => {
    it('should get category with tag count', async () => {
      const mockCategory = createMockCategory();
      const tenantFilter = {tenantId: generateTestUuid()};
      const query: GetTagCategoryQuery = {
        categoryId: mockCategory.id,
        tenantFilter,
      };

      const expectedVO = MockFactory.createTagCategoryVO({ tagCount: 5 });

      mockTagCategoryDomainService.getCategory.mockResolvedValue(mockCategory);
      mockTagQueryDomainService.countTagsByCriteria.mockResolvedValue(5);
      mockTagCategoryOHSAdapter.fromEntityToTagCategoryVO.mockReturnValue(expectedVO);

      const result = await service.getCategory(query);

      expect(mockTagCategoryDomainService.getCategory).toHaveBeenCalledWith(mockCategory.id, tenantFilter);
      expect(mockTagQueryDomainService.countTagsByCriteria).toHaveBeenCalledWith({categoryId: mockCategory.id, tenantFilter});
      expect(result.tagCount).toBe(5);
    });
  });

  describe('updateCategory', () => {
    it('should update category and return VO', async () => {
      const command: UpdateTagCategoryCommand = {
        categoryId: 'cat-123',
        name: 'Updated Category',
        description: 'Updated description',
        updatedBy: 'user-123',
        ownedBy: companyId
      };

      const mockCategory = createMockCategory({ name: 'Updated Category' });
      const expectedVO = MockFactory.createTagCategoryVO({ name: 'Updated Category', description: 'Updated description' });

      mockTagCategoryDomainService.updateCategory.mockResolvedValue(mockCategory);
      mockTagCategoryOHSAdapter.fromEntityToTagCategoryVO.mockReturnValue(expectedVO);

      const result = await service.updateCategory(command);

      expect(mockTagCategoryDomainService.updateCategory).toHaveBeenCalledWith('cat-123', command, { tenantId: companyId });
      expect(result.name).toBe('Updated Category');
    });
  });

  describe('deleteCategory', () => {
    it('should delete category when canDelete is true', async () => {
      const command: DeleteTagCategoryCommand = {
        categoryId: 'cat-123',
        deletedBy: 'user-123',
        ownedBy: companyId
      };

      mockTagCategoryDomainService.canDeleteCategory.mockResolvedValue(true);
      mockTagCategoryDomainService.deleteCategory.mockResolvedValue(undefined);

      await service.deleteCategory(command);

      expect(mockTagCategoryDomainService.canDeleteCategory).toHaveBeenCalledWith('cat-123', { tenantId: companyId });
      expect(mockTagCategoryDomainService.deleteCategory).toHaveBeenCalledWith(command, { tenantId: companyId });
    });

    it('should throw error when category cannot be deleted', async () => {
      const command: DeleteTagCategoryCommand = {
        categoryId: 'cat-123',
        deletedBy: 'user-123',
        ownedBy: companyId
      };

      mockTagCategoryDomainService.canDeleteCategory.mockResolvedValue(false);

      await expect(service.deleteCategory(command)).rejects.toThrow('无法删除该分类');
      expect(mockTagCategoryDomainService.deleteCategory).not.toHaveBeenCalled();
    });
  });

  describe('listCategories', () => {
    it('should list all categories as tree when no parentId', async () => {
      const tenantFilter = {tenantId: generateTestUuid()};
      const query: ListTagCategoriesQuery = {tenantFilter};

      const cat1Id = generateTestUuid();
      const cat2Id = generateTestUuid();
      const mockCategories = [
        createMockCategory({ id: cat1Id, name: 'Category 1' }),
        createMockCategory({ id: cat2Id, name: 'Category 2' })
      ];

      const mockTreeItems: TagCategoryVO[] = [
        MockFactory.createTagCategoryVO({ id: cat1Id, name: 'Category 1', tagCount: 3 }),
        MockFactory.createTagCategoryVO({ id: cat2Id, name: 'Category 2', tagCount: 2 })
      ];

      mockTagCategoryDomainService.listCategories.mockResolvedValue(mockCategories);
      mockTagCategoryDomainService.countCategories.mockResolvedValue(2);
      mockTagQueryDomainService.countTagsByCategoryIds.mockResolvedValue(new Map([[cat1Id, 3], [cat2Id, 2]]));
      mockTagCategoryOHSAdapter.fromEntityListToTagCategoryVOTree.mockReturnValue(mockTreeItems);

      const result = await service.listCategories(query);

      expect(mockTagCategoryDomainService.listCategories).toHaveBeenCalledWith(undefined, expect.any(Object), tenantFilter);
      expect(mockTagCategoryDomainService.countCategories).toHaveBeenCalledWith(undefined, undefined, tenantFilter);
      expect(mockTagQueryDomainService.countTagsByCategoryIds).toHaveBeenCalledWith([cat1Id, cat2Id], tenantFilter);
      expect(result.items).toEqual(mockTreeItems);
      expect(result.page).toBe(1);
    });

    it('should list categories with pagination when parentId is provided', async () => {
      const parentId = generateTestUuid();
      const tenantFilter = {tenantId: generateTestUuid()};
      const query: ListTagCategoriesQuery = {
        parentId: parentId,
        page: 1,
        pageSize: 10,
        tenantFilter,
      };

      const cat1Id = generateTestUuid();
      const cat2Id = generateTestUuid();
      const mockCategories = [
        createMockCategory({ id: cat1Id, name: 'Child 1', parentId: parentId }),
        createMockCategory({ id: cat2Id, name: 'Child 2', parentId: parentId })
      ];

      mockTagCategoryDomainService.listCategories.mockResolvedValue(mockCategories);
      mockTagCategoryDomainService.countCategories.mockResolvedValue(2);
      mockTagQueryDomainService.countTagsByCategoryIds.mockResolvedValue(new Map([[cat1Id, 1], [cat2Id, 1]]));
      mockTagCategoryOHSAdapter.fromEntityToTagCategoryVO.mockImplementation((cat, count) => 
        MockFactory.createTagCategoryVO({ id: cat.id, name: cat.name, tagCount: count || 0 })
      );

      const result = await service.listCategories(query);

      expect(mockTagCategoryDomainService.listCategories).toHaveBeenCalledWith(parentId, expect.any(Object), tenantFilter);
      expect(mockTagCategoryDomainService.countCategories).toHaveBeenCalledWith(parentId, undefined, tenantFilter);
      expect(mockTagQueryDomainService.countTagsByCategoryIds).toHaveBeenCalledWith([cat1Id, cat2Id], tenantFilter);
      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });
  });

  describe('moveCategory', () => {
    it('should move category to new parent', async () => {
      const newParentId = generateTestUuid();
      const command: MoveTagCategoryCommand = {
        categoryId: 'cat-123',
        newParentId: newParentId,
        updatedBy: 'user-123',
        ownedBy: companyId
      };

      const mockCategory = createMockCategory({ parentId: newParentId });
      const expectedVO = MockFactory.createTagCategoryVO({ 
        id: mockCategory.id,
        name: mockCategory.name,
        parent: { 
          id: newParentId,
          name: 'New Parent',
          path: `/${newParentId}`,
          orderIndex: 0,
          tagCount: 0,
          isDeleted: false,
          createTime: new Date().toISOString(),
        } 
      });

      mockTagCategoryDomainService.moveCategory.mockResolvedValue(mockCategory);
      mockTagCategoryOHSAdapter.fromEntityToTagCategoryVO.mockReturnValue(expectedVO);

      const result = await service.moveCategory(command);

      expect(mockTagCategoryDomainService.moveCategory).toHaveBeenCalledWith('cat-123', newParentId, { tenantId: companyId });
      // Check that parent.id matches
      expect(result.parent).toHaveProperty('id', newParentId);
    });

    it('should move category to root when newParentId is empty string', async () => {
      const command: MoveTagCategoryCommand = {
        categoryId: 'cat-123',
        newParentId: '',
        updatedBy: 'user-123',
        ownedBy: companyId
      };

      const mockCategory = createMockCategory({ parentId: undefined });
      const expectedVO = MockFactory.createTagCategoryVO({ parent: null });

      mockTagCategoryDomainService.moveCategory.mockResolvedValue(mockCategory);
      mockTagCategoryOHSAdapter.fromEntityToTagCategoryVO.mockReturnValue(expectedVO);

      const result = await service.moveCategory(command);

      expect(mockTagCategoryDomainService.moveCategory).toHaveBeenCalledWith('cat-123', '', { tenantId: companyId });
      expect(result.parent).toBeNull();
    });
  });

  describe('reorderCategories', () => {
    it('should reorder categories', async () => {
      const command: ReorderTagCategoriesCommand = {
        categoryIds: ['cat-1', 'cat-2', 'cat-3'],
        orderIndex: [0, 1, 2],
        updatedBy: 'user-123',
        ownedBy: companyId
      };

      mockTagCategoryDomainService.reorderCategories.mockResolvedValue(undefined);

      await service.reorderCategories(command);

      expect(mockTagCategoryDomainService.reorderCategories).toHaveBeenCalledWith(
        ['cat-1', 'cat-2', 'cat-3'],
        [0, 1, 2],
        {tenantId: command.ownedBy},
      );
    });
  });
});
