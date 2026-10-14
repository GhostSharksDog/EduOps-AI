/**
 * TagCategoryOHSAdapterImpl Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TagCategoryOHSAdapterImpl } from '@/modules/tag/services/TagCategoryOHSAdapterImpl';

describe('TagCategoryOHSAdapterImpl', () => {
  let adapter: TagCategoryOHSAdapterImpl;

  beforeEach(() => {
    adapter = new TagCategoryOHSAdapterImpl();
  });

  describe('adapter creation', () => {
    it('should create adapter instance', () => {
      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(TagCategoryOHSAdapterImpl);
    });
  });
});
