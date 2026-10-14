import { describe, it, expect } from 'vitest';
import { TagVersion } from '@/modules/tag/domain/entities/TagVersion';

describe('TagVersion Entity', () => {
  describe('constructor', () => {
    it('should create tag version with required fields', () => {
      const version = new TagVersion(
        'version-001',
        'tag-001',
        'user-001',
        new Date(),
        'user-001',
        1
      );

      expect(version.id).toBe('version-001');
      expect(version.tagId).toBe('tag-001');
      expect(version.ownedBy).toBe('user-001');
      expect(version.version).toBe(1);
      expect(version.isDeleted).toBe(false);
      expect(version.isCurrent).toBe(false);
    });

    it('should set optional fields', () => {
      const version = new TagVersion(
        'version-001',
        'tag-001',
        'user-001',
        new Date(),
        'user-001',
        1,
        'Version Name',
        'Version Description',
        false,
        { customProp: 'value' }
      );

      expect(version.name).toBe('Version Name');
      expect(version.description).toBe('Version Description');
      expect(version.feature).toEqual({ customProp: 'value' });
    });

    it('should set isCurrent flag', () => {
      const version = new TagVersion(
        'version-001',
        'tag-001',
        'user-001',
        new Date(),
        'user-001',
        1,
        undefined,
        undefined,
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      );

      expect(version.isCurrent).toBe(true);
    });
  });
});
