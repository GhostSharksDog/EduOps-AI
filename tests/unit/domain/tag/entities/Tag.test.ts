import { describe, it, expect, beforeEach } from 'vitest';
import { Tag } from '@/modules/tag/domain/entities/Tag';
import { TagVersion } from '@/modules/tag/domain/entities/TagVersion';
import { TagStatus, TagValueType, UpdateCycle } from '@/shared/enums/index';
import { createTestTag } from '../../../../helpers/fixtures';

describe('Tag Entity', () => {
  let tag: Tag;

  beforeEach(() => {
    tag = createTestTag({ id: 'tag-001', ownedBy: 'user-001', categoryId: 'category-001', createdBy: 'user-001' });
  });

  describe('constructor', () => {
    it('should create a Tag with required fields', () => {
      expect(tag.id).toBe('tag-001');
      expect(tag.name).toBe('Test Tag');
      expect(tag.dataType).toBe(TagValueType.STRING);
      expect(tag.status).toBe(TagStatus.DRAFT);
      expect(tag.updateCycle).toBe(UpdateCycle.DAILY);
      expect(tag.ownedBy).toBe('user-001');
      expect(tag.categoryId).toBe('category-001');
      expect(tag.createdBy).toBe('user-001');
    });

    it('should allow optional description', () => {
      const tagWithDesc = createTestTag({ description: 'Test description' });

      expect(tagWithDesc.description).toBe('Test description');
    });

    it('should default isPublic to false', () => {
      expect(tag.isPublic).toBe(false);
    });

    it('should default isDeleted to false', () => {
      expect(tag.isDeleted).toBe(false);
    });

    it('should default versions to empty array', () => {
      expect(tag.versions).toEqual([]);
    });

    it('should default tagValues to empty array', () => {
      expect(tag.tagValues).toEqual([]);
    });
  });

  describe('changeStatus', () => {
    it('should change the status', () => {
      tag.changeStatus(TagStatus.ACTIVE);

      expect(tag.status).toBe(TagStatus.ACTIVE);
      expect(tag.updateTime).toBeDefined();
    });
  });

  describe('updateInfo', () => {
    it('should update name', () => {
      tag.updateInfo('Updated Tag Name');

      expect(tag.name).toBe('Updated Tag Name');
      expect(tag.updateTime).toBeDefined();
    });

    it('should update description if provided', () => {
      tag.updateInfo('Updated Tag Name', 'Updated description');

      expect(tag.description).toBe('Updated description');
    });

    it('should update updateCycle if provided', () => {
      tag.updateInfo('Updated Tag Name', undefined, UpdateCycle.REALTIME);

      expect(tag.updateCycle).toBe(UpdateCycle.REALTIME);
    });
  });

  describe('publish', () => {
    it('should change status to ACTIVE', () => {
      tag = createTestTag();

      tag.publish();

      expect(tag.status).toBe(TagStatus.ACTIVE);
      expect(tag.updateTime).toBeDefined();
    });

    it('should not update if already ACTIVE', () => {
      tag = createTestTag({ status: TagStatus.ACTIVE });
      const originalUpdateTime = tag.updateTime;

      tag.publish();

      expect(tag.updateTime).toBe(originalUpdateTime);
    });
  });

  describe('offline', () => {
    it('should change status to INACTIVE', () => {
      tag = createTestTag({ status: TagStatus.ACTIVE });

      tag.offline();

      expect(tag.status).toBe(TagStatus.INACTIVE);
      expect(tag.updateTime).toBeDefined();
    });
    it('should not update if already INACTIVE', () => {
      tag = createTestTag({ status: TagStatus.INACTIVE });
      const originalUpdateTime = tag.updateTime;

      tag.offline();

      expect(tag.updateTime).toBe(originalUpdateTime);
    });
  });

  describe('addVersion', () => {
    it('should add a version to the tag', () => {
      const version = new TagVersion(
        'version-001',
        'tag-001',
        'user-001',
        new Date(),
        'user-001',
        1
      );

      tag.addVersion(version);

      expect(tag.versions.length).toBe(1);
      expect(tag.versions[0]).toBe(version);
      expect(tag.updateTime).toBeDefined();
    });
  });

  describe('setCurrentVersion', () => {
    it('should set the current version', () => {
      const version1 = new TagVersion(
        'version-001',
        'tag-001',
        'user-001',
        new Date(),
        'user-001',
        1
      );
      const version2 = new TagVersion(
        'version-002',
        'tag-001',
        'user-001',
        new Date(),
        'user-001',
        2
      );
      tag.addVersion(version1);
      tag.addVersion(version2);

      tag.setCurrentVersion('version-002');

      expect(tag.currentVersionId).toBe('version-002');
      expect(tag.currentVersion).toBe(version2);
      expect(tag.updateTime).toBeDefined();
    });

    it('should unset previous current version', () => {
      const version1 = new TagVersion(
        'version-001',
        'tag-001',
        'user-001',
        new Date(),
        'user-001',
        1
      );
      version1.isCurrent = true;
      const version2 = new TagVersion(
        'version-002',
        'tag-001',
        'user-001',
        new Date(),
        'user-001',
        2
      );
      tag.addVersion(version1);
      tag.addVersion(version2);

      tag.setCurrentVersion('version-002');

      expect(version1.isCurrent).toBe(false);
      expect(version2.isCurrent).toBe(true);
    });

    it('should not change if version not found', () => {
      tag.setCurrentVersion('non-existent-version');

      expect(tag.currentVersionId).toBe('non-existent-version');
      expect(tag.currentVersion).toBeUndefined();
    });
  });
});
