import { describe, it, expect } from 'vitest';
import { TagCategoryAdapterImpl } from '@/modules/tag/repositories/TagCategoryAdapterImpl';
import { MockFactory } from '../../helpers/mock-factory';

describe('TagCategoryAdapterImpl', () => {
  const adapter = new TagCategoryAdapterImpl();

  describe('fromPOToTagCategoryEntity', () => {
    it('should convert TagCategoryPO to TagCategory entity', () => {
      const categoryPO = MockFactory.createTagCategoryPO({
        id: 'cat-1',
        name: 'Test Category',
      });

      const category = adapter.fromPOToTagCategoryEntity(categoryPO as any);

      expect(category.id).toBe('cat-1');
      expect(category.name).toBe('Test Category');
    });

    it('should handle null description', () => {
      const categoryPO = MockFactory.createTagCategoryPO({
        id: 'cat-2',
        name: 'No Description Category',
        description: null,
      });

      const category = adapter.fromPOToTagCategoryEntity(categoryPO as any);

      expect(category.id).toBe('cat-2');
      expect(category.description).toBeUndefined();
    });

    it('should give an unnamed category a readable fallback', () => {
      const categoryPO = MockFactory.createTagCategoryPO({
        id: 'cat-3',
        name: '',
      });

      const category = adapter.fromPOToTagCategoryEntity(categoryPO as any);

      expect(category.name).toBe('Unnamed Category');
    });

    it('should handle deleted category', () => {
      const categoryPO = MockFactory.createTagCategoryPO({
        id: 'cat-4',
        name: 'Deleted Category',
        isDeleted: true,
      });

      const category = adapter.fromPOToTagCategoryEntity(categoryPO as any);

      expect(category.isDeleted).toBe(true);
    });

    it('should handle parent category relationship', () => {
      const categoryPO = MockFactory.createTagCategoryPO({
        id: 'cat-5',
        name: 'Child Category',
        parentId: 'parent-1',
      });

      const category = adapter.fromPOToTagCategoryEntity(categoryPO as any);

      expect(category.parentId).toBe('parent-1');
    });
  });
});

