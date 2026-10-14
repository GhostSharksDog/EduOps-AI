import { describe, it, expect } from 'vitest';
import { TagAdapterImpl } from '@/modules/tag/repositories/TagAdapterImpl';
import { MockFactory } from '../../helpers/mock-factory';

describe('TagAdapterImpl', () => {
  const adapter = new TagAdapterImpl();

  describe('fromPOToTagEntity', () => {
    it('should convert TagPO to Tag entity', () => {
      const tagPO = MockFactory.createTagPO({
        id: 'test-id',
        name: 'Test Tag',
      });

      const tag = adapter.fromPOToTagEntity(tagPO as any);

      expect(tag.id).toBe('test-id');
      expect(tag.name).toBe('Test Tag');
    });

    it('should handle deleted tags', () => {
      const tagPO = MockFactory.createTagPO({
        id: 'test-id',
        name: 'Deleted Tag',
        isDeleted: true,
      });

      const tag = adapter.fromPOToTagEntity(tagPO as any);

      expect(tag.isDeleted).toBe(true);
    });
  });
});
