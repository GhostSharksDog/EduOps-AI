import { describe, it, expect, beforeEach } from 'vitest';
import { TagAdapterImpl } from '@/modules/tag/repositories/TagAdapterImpl';
import { Tag } from '@/modules/tag/domain/entities/Tag';
import { TagStatus, TagValueType, UpdateCycle } from '@/shared/enums/index';

describe('TagAdapterImpl', () => {
  let adapter: TagAdapterImpl;

  beforeEach(() => {
    adapter = new TagAdapterImpl();
  });

  describe('fromPOToTagEntity', () => {
    it('should convert PO to domain entity correctly', () => {
      const tagPO = {
        id: 'tag-123',
        name: 'Test Tag',
        description: 'Test description',
        valueType: 'BOOLEAN',
        update_cycle: 'DAILY',
        ownedBy: 'user-123',
        categoryId: 'category-1',
        currentVersionId: null,
        isDeleted: false,
        createTime: new Date('2024-01-01'),
        updateTime: new Date('2024-01-02'),
        createdBy: 'user-123',
        updatedBy: 'user-456',
        deleteTime: null,
        deletedBy: null,
        feature: {}
      };

      const entity = adapter.fromPOToTagEntity(tagPO as any);

      expect(entity.id).toBe('tag-123');
      expect(entity.name).toBe('Test Tag');
      expect(entity.description).toBe('Test description');
      expect(entity.dataType).toBe(TagValueType.BOOLEAN);
      expect(entity.updateCycle).toBe(UpdateCycle.DAILY);
      expect(entity.ownedBy).toBe('user-123');
      expect(entity.categoryId).toBe('category-1');
      expect(entity.isDeleted).toBe(false);
    });

    it('should handle null values in PO', () => {
      const tagPO = {
        id: 'tag-1',
        name: null,
        description: null,
        valueType: null,
        update_cycle: null,
        ownedBy: 'user-123',
        categoryId: null,
        currentVersionId: null,
        isDeleted: false,
        createTime: new Date(),
        createdBy: 'user-123',
        feature: null
      };

      const entity = adapter.fromPOToTagEntity(tagPO as any);

      expect(entity.id).toBe('tag-1');
      expect(entity.name).toBe('Unnamed Tag');
      expect(entity.categoryId).toBe('');
    });

    it('should include versions when provided', () => {
      const tagPO = {
        id: 'tag-123',
        name: 'Test Tag',
        valueType: 'STRING',
        ownedBy: 'user-123',
        categoryId: 'cat-1',
        currentVersionId: 'version-1',
        isDeleted: false,
        createTime: new Date(),
        createdBy: 'user-123',
        feature: null
      };

      const versionPOs = [
        {
          id: 'version-1',
          tagId: 'tag-123',
          version: 1,
          calculationRule: '{"ruleType":"SQL"}',
          createTime: new Date(),
          createdBy: 'user-123'
        }
      ];

      const entity = adapter.fromPOToTagEntity(tagPO as any, versionPOs as any);

      expect(entity.versions).toHaveLength(1);
      expect(entity.currentVersionId).toBe('version-1');
    });

    it('should include category when provided', () => {
      const tagPO = {
        id: 'tag-123',
        name: 'Test Tag',
        valueType: 'STRING',
        ownedBy: 'user-123',
        categoryId: 'cat-1',
        isDeleted: false,
        createTime: new Date(),
        createdBy: 'user-123',
        feature: null
      };

      const categoryPO = {
        id: 'cat-1',
        name: 'Test Category',
        code: 'test_category',
        createTime: new Date(),
        createdBy: 'user-123'
      };

      const entity = adapter.fromPOToTagEntity(tagPO as any, [], categoryPO as any);

      expect(entity.category).toBeDefined();
      expect(entity.category?.name).toBe('Test Category');
    });

    it('should set INACTIVE status when isDeleted is true', () => {
      const tagPO = {
        id: 'tag-1',
        name: 'Deleted Tag',
        valueType: 'STRING',
        status: TagStatus.INACTIVE,
        ownedBy: 'user-123',
        categoryId: 'cat-1',
        isDeleted: true,
        createTime: new Date(),
        createdBy: 'user-123',
        feature: null
      };

      const entity = adapter.fromPOToTagEntity(tagPO as any);

      expect(entity.status).toBe(TagStatus.INACTIVE);
    });
  });

  describe('fromTagToTagPO', () => {
    it('should convert domain entity to PO correctly', () => {
      const tag = new Tag(
        'tag-123',
        'Test Tag',
        TagValueType.BOOLEAN,
        TagStatus.ACTIVE,
        UpdateCycle.DAILY,
        'user-123',
        'category-1',
        new Date('2024-01-01'),
        'user-123',
        false,
        'Test description'
      );

      const po = adapter.fromTagToTagPO(tag);

      expect(po.id).toBe('tag-123');
      expect(po.name).toBe('Test Tag');
      expect(po.valueType).toBe(TagValueType.BOOLEAN);
      expect(po.update_cycle).toBe(UpdateCycle.DAILY);
      expect(po.ownedBy).toBe('user-123');
      expect(po.categoryId).toBe('category-1');
      expect(po.isDeleted).toBe(false);
    });

    it('should handle null currentVersionId', () => {
      const tag = new Tag(
        'tag-1',
        'Test',
        TagValueType.STRING,
        TagStatus.ACTIVE,
        UpdateCycle.DAILY,
        'user-123',
        'cat-1',
        new Date(),
        'user-123'
      );

      const po = adapter.fromTagToTagPO(tag);

      expect(po.currentVersionId).toBeNull();
    });
  });

  describe('fromTagToTagVO', () => {
    it('should convert domain entity to VO correctly', () => {
      const tag = new Tag(
        'tag-123',
        'Test Tag',
        TagValueType.BOOLEAN,
        TagStatus.ACTIVE,
        UpdateCycle.DAILY,
        'user-123',
        'category-1',
        new Date('2024-01-01T00:00:00.000Z'),
        'user-123',
        false,
        'Test description'
      );

      const vo = adapter.fromTagToTagVO(tag);

      expect(vo.id).toBe('tag-123');
      expect(vo.name).toBe('Test Tag');
      expect(vo.description).toBe('Test description');
      expect(vo.dataType).toBe(TagValueType.BOOLEAN);
      expect(vo.status).toBe(TagStatus.ACTIVE);
      expect(vo.updateCycle).toBe(UpdateCycle.DAILY);
      expect(vo.createTime).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should include category VO when available', () => {
      const tag = new Tag(
        'tag-123',
        'Test Tag',
        TagValueType.STRING,
        TagStatus.ACTIVE,
        UpdateCycle.DAILY,
        'user-123',
        'category-1',
        new Date(),
        'user-123'
      );

      const vo = adapter.fromTagToTagVO(tag);

      expect(vo.id).toBe('tag-123');
      // Category should be null when not set
      expect(vo.category).toBeNull();
    });
  });
});
