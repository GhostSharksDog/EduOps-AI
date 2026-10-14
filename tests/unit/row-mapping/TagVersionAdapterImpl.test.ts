import { describe, it, expect } from 'vitest';
import { TagVersionAdapterImpl } from '@/modules/tag/repositories/TagVersionAdapterImpl';
import { POFactory } from '../../helpers/mock-factory';

describe('TagVersionAdapterImpl', () => {
  const adapter = new TagVersionAdapterImpl();

  describe('fromPOToTagVersionEntity', () => {
    it('should convert TagVersionPO to TagVersion entity', () => {
      const versionPO = POFactory.createTagVersionPO({
        id: 'ver-1',
        tagId: 'tag-1',
      });

      const version = adapter.fromPOToTagVersionEntity(versionPO as any);

      expect(version.id).toBe('ver-1');
      expect(version.tagId).toBe('tag-1');
    });
  });
});
