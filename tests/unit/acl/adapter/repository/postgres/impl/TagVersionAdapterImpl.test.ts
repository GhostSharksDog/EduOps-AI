import { describe, it, expect, beforeEach } from 'vitest';
import { TagVersionAdapterImpl } from '@/modules/tag/repositories/TagVersionAdapterImpl';
import { TagVersion } from '@/modules/tag/domain/index';

describe('TagVersionAdapterImpl', () => {
  let adapter: TagVersionAdapterImpl;

  beforeEach(() => {
    adapter = new TagVersionAdapterImpl();
  });

  describe('fromPOToTagVersionEntity', () => {
    it('should convert PO to TagVersion entity with all fields', () => {
      const po = {
        id: 'version-123',
        tagId: 'tag-123',
        ownedBy: 'user-123',
        createTime: new Date('2024-01-01T00:00:00Z'),
        createdBy: 'user-123',
        version: 1,
        name: 'Version 1',
        description: 'Test version',
        isDeleted: false,
        feature: 'default',
        updateTime: new Date('2024-01-02T00:00:00Z'),
        deleteTime: null,
        updatedBy: null,
        deletedBy: null,
        isCurrent: true,
        calculationRule: JSON.stringify({ ruleType: 'SQL', expression: 'SELECT 1' })
      };

      const entity = adapter.fromPOToTagVersionEntity(po as any);

      expect(entity.id).toBe('version-123');
      expect(entity.tagId).toBe('tag-123');
      expect(entity.ownedBy).toBe('user-123');
      expect(entity.version).toBe(1);
      expect(entity.name).toBe('Version 1');
      expect(entity.description).toBe('Test version');
      expect(entity.isDeleted).toBe(false);
      expect(entity.isCurrent).toBe(true);
    });

    it('should handle null optional fields', () => {
      const po = {
        id: 'version-123',
        tagId: 'tag-123',
        ownedBy: 'user-123',
        createTime: new Date('2024-01-01T00:00:00Z'),
        createdBy: 'user-123',
        version: 1,
        name: null,
        description: null,
        isDeleted: false,
        feature: 'default',
        updateTime: null,
        deleteTime: null,
        updatedBy: null,
        deletedBy: null,
        isCurrent: false,
        calculationRule: null
      };

      const entity = adapter.fromPOToTagVersionEntity(po as any);

      expect(entity.name).toBeUndefined();
      expect(entity.description).toBeUndefined();
      expect(entity.isCurrent).toBe(false);
    });

    it('should parse calculation rule JSON', () => {
      const rule = { ruleType: 'SQL', expression: 'SELECT * FROM users' };
      const po = {
        id: 'version-123',
        tagId: 'tag-123',
        ownedBy: 'user-123',
        createTime: new Date(),
        createdBy: 'user-123',
        version: 1,
        isDeleted: false,
        feature: 'default',
        isCurrent: true,
        calculationRule: JSON.stringify(rule)
      };

      const entity = adapter.fromPOToTagVersionEntity(po as any);

      expect(entity.calculationRule).toEqual(JSON.stringify(rule));
    });

    it('should default isCurrent to false when not specified', () => {
      const po = {
        id: 'version-123',
        tagId: 'tag-123',
        ownedBy: 'user-123',
        createTime: new Date(),
        createdBy: 'user-123',
        version: 1,
        isDeleted: false,
        feature: 'default'
      };

      const entity = adapter.fromPOToTagVersionEntity(po as any);

      expect(entity.isCurrent).toBe(false);
    });
  });

  describe('fromTagVersionEntityToPO', () => {
    it('should convert TagVersion entity to PO', () => {
      const entity = new TagVersion(
        'version-123',
        'tag-123',
        'user-123',
        new Date('2024-01-01T00:00:00Z'),
        'user-123',
        1,
        'Version 1',
        'Test version',
        false,
        'default',
        new Date('2024-01-02T00:00:00Z'),
        undefined,
        undefined,
        undefined,
        true,
        { ruleType: 'SQL', ruleContent: 'SELECT 1' }
      );

      const po = adapter.fromTagVersionEntityToPO(entity);

      expect(po.id).toBe('version-123');
      expect(po.tagId).toBe('tag-123');
      expect(po.version).toBe(1);
      expect(po.name).toBe('Version 1');
      expect(po.description).toBe('Test version');
      expect(po.isDeleted).toBe(false);
      expect(po.isCurrent).toBe(true);
    });

    it('should handle null values in entity', () => {
      const entity = new TagVersion(
        'version-123',
        'tag-123',
        'user-123',
        new Date('2024-01-01T00:00:00Z'),
        'user-123',
        1,
        undefined,
        undefined,
        false,
        'default',
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        undefined
      );

      const po = adapter.fromTagVersionEntityToPO(entity);

      expect(po.name).toBeNull();
      expect(po.description).toBeNull();
      // updateTime may be undefined, not null
    });
  });
});
