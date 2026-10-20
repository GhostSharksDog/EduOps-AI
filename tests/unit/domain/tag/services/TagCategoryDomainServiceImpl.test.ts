import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { TagCategoryDomainServiceImpl } from '@/modules/tag/domain/services/TagCategoryDomainServiceImpl';
import { TagRepository } from '@/modules/tag/domain/ports/TagRepository';
import { ITagFactory } from '@/modules/tag/domain/index';
import { TagCategory } from '@/modules/tag/domain/entities/TagCategory';
import { MockFactory } from '../../../../helpers/mock-factory';
import { generateTestUuid } from '../../../../helpers/constants';
import {useCompanyUnitFixture} from '@/tests/helpers/company-unit-fixture';
const companyId=useCompanyUnitFixture();

describe('TagCategoryDomainServiceImpl', () => {
  let service: TagCategoryDomainServiceImpl;
  let mockRepository: TagRepository;
  let mockFactory: ITagFactory;

  beforeEach(() => {
    mockRepository = {
      findCategoryById: vi.fn() as Mock,
      createCategory: vi.fn() as Mock,
      updateCategory: vi.fn() as Mock,
      deleteCategory: vi.fn() as Mock,
      findAllCategories: vi.fn() as Mock,
      countTagsByCategoryId: vi.fn() as Mock,
      countChildCategories: vi.fn() as Mock,
      countCategories: vi.fn() as Mock
    } as unknown as TagRepository;
    
    mockFactory = {
      createTag: vi.fn() as Mock,
      createTagVersion: vi.fn() as Mock,
      createTagCategory: vi.fn() as Mock
    };
    
    service = new TagCategoryDomainServiceImpl(mockRepository, mockFactory);
  });

  describe('createCategory', () => {
    it('should create and save a new category', async () => {
      const parentId = generateTestUuid();
      const categoryId = generateTestUuid();
      const command = {
        name: 'Test Category',
        parentId,
        description: 'Test description',
        orderIndex: 1,
        createdBy: generateTestUuid(),
        ownedBy: companyId
      };

      const mockCategory = MockFactory.createTagCategoryVO({
        id: categoryId,
        name: 'Test Category',
        orderIndex: 1
      }) as unknown as TagCategory;

      mockFactory.createTagCategory = vi.fn().mockReturnValue(mockCategory);
      mockRepository.createCategory = vi.fn().mockResolvedValue(mockCategory);
      mockRepository.findCategoryById = vi.fn().mockResolvedValue({id: parentId} as TagCategory);

      const result = await service.createCategory(command);

      expect(result.name).toBe('Test Category');
      expect(mockFactory.createTagCategory).toHaveBeenCalledWith(command);
      expect(mockRepository.findCategoryById).toHaveBeenCalledWith(parentId,{tenantId:command.ownedBy});
      expect(mockRepository.createCategory).toHaveBeenCalledWith(mockCategory);
    });

    it('rejects an inaccessible parent before constructing or saving a new category',async()=>{
      const command={name:'新子分类',parentId:generateTestUuid(),description:'',orderIndex:0,createdBy:generateTestUuid(),ownedBy:companyId};
      mockRepository.findCategoryById=vi.fn().mockResolvedValue(null);

      await expect(service.createCategory(command)).rejects.toThrow('分类不存在');
      expect(mockRepository.findCategoryById).toHaveBeenCalledWith(command.parentId,{tenantId:command.ownedBy});
      expect(mockFactory.createTagCategory).not.toHaveBeenCalled();
      expect(mockRepository.createCategory).not.toHaveBeenCalled();
    });

    it('should create category without parent', async () => {
      const categoryId = generateTestUuid();
      const command = {
        name: 'Root Category',
        description: 'Root level',
        orderIndex: 0,
        createdBy: generateTestUuid(),
        ownedBy: companyId
      };

      const mockCategory = MockFactory.createTagCategoryVO({
        id: categoryId,
        name: 'Root Category',
        parent: null,
        orderIndex: 0
      }) as unknown as TagCategory;

      mockFactory.createTagCategory = vi.fn().mockReturnValue(mockCategory);
      mockRepository.createCategory = vi.fn().mockResolvedValue(mockCategory);

      const result = await service.createCategory(command);

      expect(result.parent).toBeNull();
    });
  });

  describe('getCategory', () => {
    it('should return category when found', async () => {
      const categoryId = generateTestUuid();
      const mockCategory = MockFactory.createTagCategoryVO({
        id: categoryId,
        name: 'Test Category',
        orderIndex: 1
      }) as unknown as TagCategory;

      mockRepository.findCategoryById = vi.fn().mockResolvedValue(mockCategory);

      const result = await service.getCategory(categoryId);

      expect(result.id).toBe(categoryId);
      expect(result.name).toBe('Test Category');
      expect(mockRepository.findCategoryById).toHaveBeenCalledWith(categoryId, undefined);
    });

    it('should throw error when category not found', async () => {
      mockRepository.findCategoryById = vi.fn().mockResolvedValue(null);

      const nonexistentId = generateTestUuid();
      await expect(service.getCategory(nonexistentId)).rejects.toThrow(`分类不存在: ${nonexistentId}`);
    });
  });

  describe('updateCategory', () => {
    it('should update category name', async () => {
      const categoryId = generateTestUuid();
      const mockCategory = MockFactory.createTagCategoryVO({
        id: categoryId,
        name: 'Old Name',
        description: 'Description',
        parent: null,
        orderIndex: 0
      }) as unknown as TagCategory;

      mockRepository.findCategoryById = vi.fn().mockResolvedValue(mockCategory);
      mockRepository.updateCategory = vi.fn().mockResolvedValue(mockCategory);

      const command = {
        categoryId,
        name: 'New Name',
        updatedBy: generateTestUuid()
      };

      const result = await service.updateCategory(categoryId, command);

      expect(mockCategory.name).toBe('New Name');
      expect(mockRepository.updateCategory).toHaveBeenCalledWith(mockCategory, undefined);
    });

    it('should update category description', async () => {
      const categoryId = generateTestUuid();
      const mockCategory = MockFactory.createTagCategoryVO({
        id: categoryId,
        name: 'Test',
        description: 'Old description',
        parent: null,
        orderIndex: 0
      }) as unknown as TagCategory;

      mockRepository.findCategoryById = vi.fn().mockResolvedValue(mockCategory);
      mockRepository.updateCategory = vi.fn().mockResolvedValue(mockCategory);

      const command = {
        categoryId,
        description: 'New description',
        updatedBy: generateTestUuid()
      };

      await service.updateCategory(categoryId, command);

      expect(mockCategory.description).toBe('New description');
    });

    it('should update category orderIndex', async () => {
      const categoryId = generateTestUuid();
      const mockCategory = MockFactory.createTagCategoryVO({
        id: categoryId,
        name: 'Test',
        description: undefined,
        parent: null,
        orderIndex: 0
      }) as unknown as TagCategory;

      mockRepository.findCategoryById = vi.fn().mockResolvedValue(mockCategory);
      mockRepository.updateCategory = vi.fn().mockResolvedValue(mockCategory);

      const command = {
        categoryId,
        orderIndex: 5,
        updatedBy: generateTestUuid()
      };

      await service.updateCategory(categoryId, command);

      expect(mockCategory.orderIndex).toBe(5);
    });

    it('should throw error when category not found', async () => {
      mockRepository.findCategoryById = vi.fn().mockResolvedValue(null);

      const nonexistentId = generateTestUuid();
      const command = { 
        categoryId: nonexistentId, 
        name: 'New Name',
        updatedBy: generateTestUuid()
      };

      await expect(service.updateCategory(nonexistentId, command)).rejects.toThrow('不存在');
    });
  });

  describe('deleteCategory', () => {
    it('should delete category by command', async () => {
      const categoryId = generateTestUuid();
      const mockCategory = MockFactory.createTagCategoryVO({
        id: categoryId,
        name: 'Test Category'
      }) as unknown as TagCategory;

      mockRepository.findCategoryById = vi.fn().mockResolvedValue(mockCategory);
      mockRepository.deleteCategory = vi.fn().mockResolvedValue(undefined);

      const command = {
        categoryId,
        deletedBy: generateTestUuid(),
        ownedBy: companyId
      };

      await service.deleteCategory(command);

      expect(mockRepository.deleteCategory).toHaveBeenCalledWith(command);
    });
  });

  describe('listCategories', () => {
    it.each([undefined, '00000000-0000-4000-8000-000000000101'])('keeps tenant filtering with parent %s and pagination', async (parentId) => {
      const tenantFilter = {tenantId: generateTestUuid()};
      mockRepository.findAllCategories = vi.fn().mockResolvedValue([]);

      await service.listCategories(parentId, {page: 2, pageSize: 5, keyword: '风险'}, tenantFilter);

      expect(mockRepository.findAllCategories).toHaveBeenCalledWith({
        tenantFilter, ...(parentId ? {parentId} : {}), skip: 5, take: 5, keyword: '风险',
      });
    });

    it('should return all categories when no parentId filter', async () => {
      const mockCategories = [
        MockFactory.createTagCategoryVO({ name: 'Category 1', orderIndex: 0 }) as unknown as TagCategory,
        MockFactory.createTagCategoryVO({ name: 'Category 2', orderIndex: 1 }) as unknown as TagCategory
      ];

      mockRepository.findAllCategories = vi.fn().mockResolvedValue(mockCategories);

      const result = await service.listCategories();

      expect(result).toHaveLength(2);
      expect(mockRepository.findAllCategories).toHaveBeenCalledWith({});
    });

    it('should return child categories when parentId provided', async () => {
      const parentId = generateTestUuid();
      const mockCategories = [
        MockFactory.createTagCategoryVO({ name: 'Child 1' }) as unknown as TagCategory,
        MockFactory.createTagCategoryVO({ name: 'Child 2' }) as unknown as TagCategory
      ];

      mockRepository.findAllCategories = vi.fn().mockResolvedValue(mockCategories);

      const result = await service.listCategories(parentId);

      expect(result).toHaveLength(2);
      expect(mockRepository.findAllCategories).toHaveBeenCalledWith({ parentId });
    });
  });

  describe('reorderCategories', () => {
    it('rejects the entire reorder before writing when a later category is outside the tenant',async()=>{
      const firstId=generateTestUuid(),otherId=generateTestUuid(),tenantFilter={tenantId:generateTestUuid()};
      const first={id:firstId,orderIndex:7} as TagCategory;
      mockRepository.findCategoryById=vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(null);

      await expect(service.reorderCategories([firstId,otherId],[1,2],tenantFilter)).rejects.toThrow('分类不存在');

      expect(mockRepository.findCategoryById).toHaveBeenNthCalledWith(1,firstId,tenantFilter);
      expect(mockRepository.findCategoryById).toHaveBeenNthCalledWith(2,otherId,tenantFilter);
      expect(mockRepository.updateCategory).not.toHaveBeenCalled();
      expect(first.orderIndex).toBe(7);
    });

    it('should reorder categories', async () => {
      const cat1Id = generateTestUuid();
      const cat2Id = generateTestUuid();
      const mockCategory1 = MockFactory.createTagCategoryVO({ id: cat1Id, orderIndex: 0 }) as unknown as TagCategory;
      const mockCategory2 = MockFactory.createTagCategoryVO({ id: cat2Id, orderIndex: 1 }) as unknown as TagCategory;

      mockRepository.findCategoryById = vi.fn()
        .mockResolvedValueOnce(mockCategory1)
        .mockResolvedValueOnce(mockCategory2);
      mockRepository.updateCategory = vi.fn().mockResolvedValue(undefined);

      const categoryIds = [cat1Id, cat2Id];
      const orderIndex = [1, 0];
      const tenantFilter={tenantId:generateTestUuid()};

      await service.reorderCategories(categoryIds, orderIndex,tenantFilter);

      expect(mockCategory1.orderIndex).toBe(1);
      expect(mockCategory2.orderIndex).toBe(0);
      expect(mockRepository.updateCategory).toHaveBeenCalledTimes(2);
      expect(mockRepository.findCategoryById).toHaveBeenNthCalledWith(1,cat1Id,tenantFilter);
      expect(mockRepository.findCategoryById).toHaveBeenNthCalledWith(2,cat2Id,tenantFilter);
      expect(mockRepository.updateCategory).toHaveBeenNthCalledWith(1,mockCategory1,tenantFilter);
      expect(mockRepository.updateCategory).toHaveBeenNthCalledWith(2,mockCategory2,tenantFilter);
      expect((mockRepository.findCategoryById as Mock).mock.invocationCallOrder[1]).toBeLessThan((mockRepository.updateCategory as Mock).mock.invocationCallOrder[0]);
    });

    it('should throw error when array lengths do not match', async () => {
      const cat1Id = generateTestUuid();
      const cat2Id = generateTestUuid();
      const categoryIds = [cat1Id, cat2Id];
      const orderIndex = [1];

      await expect(service.reorderCategories(categoryIds, orderIndex)).rejects.toThrow(
        '分类ID数组和排序索引数组长度必须一致'
      );
    });
  });

  describe('父分类变更权限',()=>{
    it.each(['move','update'] as const)('%s rejects an inaccessible parent before any mutation',async(operation)=>{
      const categoryId=generateTestUuid(),parentId=generateTestUuid(),tenantFilter={tenantId:generateTestUuid()};
      const category={id:categoryId,name:'原分类',parentId:undefined} as TagCategory;
      mockRepository.findCategoryById=vi.fn().mockResolvedValueOnce(category).mockResolvedValueOnce(null);
      const change=operation==='move'
        ? service.moveCategory(categoryId,parentId,tenantFilter)
        : service.updateCategory(categoryId,{categoryId,parentId,name:'不应写入',updatedBy:generateTestUuid()},tenantFilter);

      await expect(change).rejects.toThrow('分类不存在');
      expect(mockRepository.findCategoryById).toHaveBeenNthCalledWith(2,parentId,tenantFilter);
      expect(mockRepository.updateCategory).not.toHaveBeenCalled();
      expect(category.name).toBe('原分类');
      expect(category.parentId).toBeUndefined();
    });

    it.each(['move','update'] as const)('%s verifies source and parent with the same tenant before writing',async(operation)=>{
      const categoryId=generateTestUuid(),parentId=generateTestUuid(),tenantFilter={tenantId:generateTestUuid()};
      const category={id:categoryId,parentId:undefined} as TagCategory,parent={id:parentId} as TagCategory;
      mockRepository.findCategoryById=vi.fn().mockResolvedValueOnce(category).mockResolvedValueOnce(parent);
      mockRepository.updateCategory=vi.fn().mockResolvedValue(category);

      if(operation==='move')await service.moveCategory(categoryId,parentId,tenantFilter);
      else await service.updateCategory(categoryId,{categoryId,parentId,updatedBy:generateTestUuid()},tenantFilter);

      expect(mockRepository.findCategoryById).toHaveBeenNthCalledWith(1,categoryId,tenantFilter);
      expect(mockRepository.findCategoryById).toHaveBeenNthCalledWith(2,parentId,tenantFilter);
      expect(mockRepository.updateCategory).toHaveBeenCalledWith(category,tenantFilter);
      expect(category.parentId).toBe(parentId);
    });

    it('moving to the root permits an empty parent without looking up an empty id',async()=>{
      const id=generateTestUuid(),tenantFilter={tenantId:generateTestUuid()},category={id,parentId:generateTestUuid()} as TagCategory;
      mockRepository.findCategoryById=vi.fn().mockResolvedValue(category);
      mockRepository.updateCategory=vi.fn().mockResolvedValue(category);
      await service.moveCategory(id,'',tenantFilter);
      expect(mockRepository.findCategoryById).toHaveBeenCalledTimes(1);
      expect(mockRepository.findCategoryById).toHaveBeenCalledWith(id,tenantFilter);
      expect(mockRepository.updateCategory).toHaveBeenCalledWith(category,tenantFilter);
      expect(category.parentId).toBeUndefined();
    });
  });

  describe('canDeleteCategory', () => {
    it('should return true when category has no tags or children', async () => {
      const categoryId = generateTestUuid();
      const mockCategory = MockFactory.createTagCategoryVO({
        id: categoryId,
        name: 'Test Category'
      }) as unknown as TagCategory;

      mockRepository.findCategoryById = vi.fn().mockResolvedValue(mockCategory);
      mockRepository.countTagsByCategoryId = vi.fn().mockResolvedValue(0);
      mockRepository.countChildCategories = vi.fn().mockResolvedValue(0);

      const result = await service.canDeleteCategory(categoryId);

      expect(result).toBe(true);
    });

    it('should return false when category has tags', async () => {
      const categoryId = generateTestUuid();
      const mockCategory = MockFactory.createTagCategoryVO({
        id: categoryId,
        name: 'Test Category'
      }) as unknown as TagCategory;

      mockRepository.findCategoryById = vi.fn().mockResolvedValue(mockCategory);
      mockRepository.countTagsByCategoryId = vi.fn().mockResolvedValue(3);
      mockRepository.countChildCategories = vi.fn().mockResolvedValue(0);

      const result = await service.canDeleteCategory(categoryId);

      expect(result).toBe(false);
    });

    it('should return false when category has child categories', async () => {
      const categoryId = generateTestUuid();
      const mockCategory = MockFactory.createTagCategoryVO({
        id: categoryId,
        name: 'Test Category'
      }) as unknown as TagCategory;

      mockRepository.findCategoryById = vi.fn().mockResolvedValue(mockCategory);
      mockRepository.countTagsByCategoryId = vi.fn().mockResolvedValue(0);
      mockRepository.countChildCategories = vi.fn().mockResolvedValue(2);

      const result = await service.canDeleteCategory(categoryId);

      expect(result).toBe(false);
    });
  });

  describe('countCategories', () => {
    it.each([undefined, '00000000-0000-4000-8000-000000000101'])('counts only the permitted tenant with parent %s', async (parentId) => {
      const tenantFilter = {tenantId: generateTestUuid()};
      mockRepository.countCategories = vi.fn().mockResolvedValue(2);

      expect(await service.countCategories(parentId, '风险', tenantFilter)).toBe(2);
      expect(mockRepository.countCategories).toHaveBeenCalledWith({
        tenantFilter, ...(parentId ? {parentId} : {}), keyword: '风险',
      });
    });

    it('should return total count when no parentId', async () => {
      mockRepository.countCategories = vi.fn().mockResolvedValue(10);

      const result = await service.countCategories();

      expect(result).toBe(10);
      expect(mockRepository.countCategories).toHaveBeenCalledWith({});
    });

    it('should return child count when parentId provided', async () => {
      const parentId = generateTestUuid();
      mockRepository.countCategories = vi.fn().mockResolvedValue(3);

      const result = await service.countCategories(parentId);

      expect(result).toBe(3);
      expect(mockRepository.countCategories).toHaveBeenCalledWith({ parentId });
    });
  });
});
