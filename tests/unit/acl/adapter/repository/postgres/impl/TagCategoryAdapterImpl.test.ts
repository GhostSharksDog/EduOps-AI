import { describe, it, expect, beforeEach } from 'vitest';
import { TagCategoryAdapterImpl } from '@/modules/tag/repositories/TagCategoryAdapterImpl';
import { TagCategory } from '@/modules/tag/domain/index';

describe('TagCategoryAdapterImpl', () => {
  let adapter: TagCategoryAdapterImpl;

  beforeEach(() => {
    adapter = new TagCategoryAdapterImpl();
  });

  describe('fromPOToTagCategoryEntity', () => {
    it('should convert PO to TagCategory entity with all fields', () => {
      const po = {
        id: 'category-123',
        name: 'Test Category',
        path: '/root/category-123',
        order: 1,
        ownedBy: 'user-123',
        createTime: new Date('2024-01-01T00:00:00Z'),
        createdBy: 'user-123',
        parentId: 'parent-123',
        description: 'Test description',
        isDeleted: false,
        feature: 'default',
        updateTime: new Date('2024-01-02T00:00:00Z')
      };

      const entity = adapter.fromPOToTagCategoryEntity(po as any, 5);

      expect(entity.id).toBe('category-123');
      expect(entity.name).toBe('Test Category');
      expect(entity.path).toBe('/root/category-123');
      expect(entity.orderIndex).toBe(1);
      expect(entity.ownedBy).toBe('user-123');
      expect(entity.tagCount).toBe(5);
      expect(entity.parentId).toBe('parent-123');
      expect(entity.description).toBe('Test description');
      expect(entity.isDeleted).toBe(false);
    });

    it('should use default name when name is null', () => {
      const po = {
        id: 'category-123',
        name: null,
        path: '/root/category-123',
        order: 0,
        ownedBy: 'user-123',
        createTime: new Date(),
        createdBy: 'user-123',
        isDeleted: false,
        feature: 'default'
      };

      const entity = adapter.fromPOToTagCategoryEntity(po as any);

      expect(entity.name).toBe('Unnamed Category');
    });

    it('should default order to 0 when not specified', () => {
      const po = {
        id: 'category-123',
        name: 'Test',
        path: '/root',
        ownedBy: 'user-123',
        createTime: new Date(),
        createdBy: 'user-123',
        isDeleted: false,
        feature: 'default'
      };

      const entity = adapter.fromPOToTagCategoryEntity(po as any);

      expect(entity.orderIndex).toBe(0);
    });

    it('should default tagCount to 0 when not provided', () => {
      const po = {
        id: 'category-123',
        name: 'Test',
        path: '/root',
        order: 0,
        ownedBy: 'user-123',
        createTime: new Date(),
        createdBy: 'user-123',
        isDeleted: false,
        feature: 'default'
      };

      const entity = adapter.fromPOToTagCategoryEntity(po as any);

      expect(entity.tagCount).toBe(0);
    });

    it('should handle null parentId', () => {
      const po = {
        id: 'category-123',
        name: 'Test',
        path: '/root',
        order: 0,
        ownedBy: 'user-123',
        createTime: new Date(),
        createdBy: 'user-123',
        parentId: null,
        isDeleted: false,
        feature: 'default'
      };

      const entity = adapter.fromPOToTagCategoryEntity(po as any);

      expect(entity.parentId).toBeUndefined();
    });
  });

  describe('fromTagCategoryEntityToPO', () => {
    it('should convert TagCategory entity to PO', () => {
      const entity = new TagCategory(
        'category-123',
        'Test Category',
        '/root/category-123',
        1,
        'user-123',
        new Date('2024-01-01T00:00:00Z'),
        'user-123',
        5,
        'default',
        'parent-123',
        undefined,
        'Test description',
        [],
        false
      );

      const po = adapter.fromTagCategoryEntityToPO(entity);

      expect(po.id).toBe('category-123');
      expect(po.name).toBe('Test Category');
      expect(po.path).toBe('/root/category-123');
      expect(po.order).toBe(1);
      expect(po.parentId).toBe('parent-123');
      expect(po.description).toBe('Test description');
    });

    it('should map orderIndex to order field', () => {
      const entity = new TagCategory(
        'category-123',
        'Test',
        '/root',
        5,
        'user-123',
        new Date(),
        'user-123',
        0,
        'default',
        undefined,
        undefined,
        undefined,
        [],
        false
      );

      const po = adapter.fromTagCategoryEntityToPO(entity);

      expect(po.order).toBe(5);
    });
  });

  describe('fromTagCategoryEntityToTagCategoryVO', () => {
    it('should convert entity to VO with ISO date strings', () => {
      const entity = new TagCategory(
        'category-123',
        'Test Category',
        '/root/category-123',
        1,
        'user-123',
        new Date('2024-01-01T00:00:00.000Z'),
        'user-123',
        5,
        'default',
        'parent-123',
        undefined,
        'Test description',
        [],
        false
      );

      const vo = adapter.fromTagCategoryEntityToTagCategoryVO(entity);

      expect(vo.id).toBe('category-123');
      expect(vo.name).toBe('Test Category');
      expect(vo.createTime).toBe('2024-01-01T00:00:00.000Z');
      expect(vo.parent).toBeNull();
    });

    it('should return null parent when no parent entity provided', () => {
      const childEntity = new TagCategory(
        'child-123',
        'Child Category',
        '/root/parent-123/child-123',
        1,
        'user-123',
        new Date(),
        'user-123',
        0,
        'default',
        'parent-123',
        undefined,
        undefined,
        [],
        false
      );

      const vo = adapter.fromTagCategoryEntityToTagCategoryVO(childEntity);

      expect(vo.parent).toBeNull();
    });

    it('should recursively map children', () => {
      const childEntity = new TagCategory(
        'child-123',
        'Child Category',
        '/root/parent-123/child-123',
        1,
        'user-123',
        new Date(),
        'user-123',
        0,
        'default',
        'parent-123',
        undefined,
        undefined,
        [],
        false
      );

      const parentEntity = new TagCategory(
        'parent-123',
        'Parent Category',
        '/root/parent-123',
        0,
        'user-123',
        new Date(),
        'user-123',
        0,
        'default',
        undefined,
        undefined,
        undefined,
        [],
        false
      );

      const vo = adapter.fromTagCategoryEntityToTagCategoryVO(parentEntity, [childEntity]);

      expect(vo.children).toBeDefined();
      expect(vo.children).toHaveLength(1);
      expect(vo.children![0].id).toBe('child-123');
    });
  });
});
