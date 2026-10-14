import { describe, it, expect, beforeEach } from 'vitest';
import { TagCategory } from '@/modules/tag/domain/entities/TagCategory';
import { createTestTagCategory } from '../../../../helpers/fixtures';

describe('TagCategory Entity', () => {
  let category: TagCategory;

  beforeEach(() => {
    category = createTestTagCategory({ id: 'cat-001', ownedBy: 'user-001' });
  });

  describe('constructor', () => {
    it('should create category with required fields', () => {
      expect(category.id).toBe('cat-001');
      expect(category.name).toBe('Test Category');
      expect(category.path).toBe('/test');
      expect(category.orderIndex).toBe(0);
      expect(category.ownedBy).toBe('user-001');
      expect(category.tagCount).toBe(0);
      expect(category.isDeleted).toBe(false);
      expect(category.children).toEqual([]);
    });
  });

  describe('updateInfo', () => {
    it('should update name', () => {
      category.updateInfo('Updated Name');
      expect(category.name).toBe('Updated Name');
      expect(category.updateTime).toBeDefined();
    });

    it('should update description if provided', () => {
      category.updateInfo('Name', 'New description');
      expect(category.description).toBe('New description');
    });

    it('should update orderIndex if provided', () => {
      category.updateInfo('Name', undefined, 10);
      expect(category.orderIndex).toBe(10);
    });
  });

  describe('moveTo', () => {
    it('should update parentId and path', () => {
      category.moveTo('parent-001', '/new/path');
      expect(category.parentId).toBe('parent-001');
      expect(category.path).toBe('/new/path');
      expect(category.updateTime).toBeDefined();
    });

    it('should allow moving to root (undefined parent)', () => {
      category.moveTo(undefined, '/');
      expect(category.parentId).toBeUndefined();
      expect(category.path).toBe('/');
    });
  });

  describe('addChild', () => {
    it('should add child category', () => {
      const child = createTestTagCategory({ id: 'cat-002', name: 'Child', path: '/test/child' });
      category.addChild(child);

      expect(category.children).toHaveLength(1);
      expect(category.children[0]).toBe(child);
    });
  });

  describe('removeChild', () => {
    it('should remove child by id', () => {
      const child = createTestTagCategory({ id: 'cat-002', name: 'Child', path: '/test/child' });
      category.addChild(child);
      category.removeChild('cat-002');

      expect(category.children).toHaveLength(0);
    });
  });

  describe('incrementTagCount', () => {
    it('should increment by 1 by default', () => {
      category.incrementTagCount();
      expect(category.tagCount).toBe(1);
      expect(category.updateTime).toBeDefined();
    });

    it('should increment by specified count', () => {
      category.incrementTagCount(5);
      expect(category.tagCount).toBe(5);
    });

    it('should increment multiple times', () => {
      category.incrementTagCount(2);
      category.incrementTagCount(3);
      expect(category.tagCount).toBe(5);
    });
  });
});
