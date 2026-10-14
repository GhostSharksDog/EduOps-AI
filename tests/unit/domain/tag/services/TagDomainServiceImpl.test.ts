import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { TagDomainServiceImpl } from '@/modules/tag/domain/services/TagDomainServiceImpl';
import { TagRepository } from '@/modules/tag/domain/ports/TagRepository';
import { ITagFactory } from '@/modules/tag/domain/index';
import { Tag, TagVersion } from '@/modules/tag/domain/index';
import { TagStatus, TagValueType, RuleType } from '@/shared/enums/index';
import { MockFactory } from '../../../../helpers/mock-factory';
import { generateTestUuid, TEST_USER_ID } from '../../../../helpers/constants';

describe('TagDomainServiceImpl', () => {
  let service: TagDomainServiceImpl;
  let mockRepository: TagRepository;
  let mockFactory: ITagFactory;
  let mockTargetTableRepository: {
    create: Mock;
    findById: Mock;
    findByTableName: Mock;
    findAnyByTableName: Mock;
    restore: Mock;
    findByTagId: Mock;
    findAll: Mock;
    update: Mock;
    delete: Mock;
    updateStatus: Mock;
    linkTag: Mock;
    unlinkTag: Mock;
    updateStats: Mock;
  };

  beforeEach(() => {
    mockRepository = {
      create: vi.fn() as Mock,
      findById: vi.fn() as Mock,
      findAll: vi.fn() as Mock,
      update: vi.fn() as Mock,
      delete: vi.fn() as Mock,
      createVersion: vi.fn() as Mock,
      findVersionById: vi.fn() as Mock,
      findVersionsByTagId: vi.fn() as Mock,
      updateVersion: vi.fn() as Mock,
      createCategory: vi.fn() as Mock,
      findCategoryById: vi.fn() as Mock,
      findAllCategories: vi.fn() as Mock,
      updateCategory: vi.fn() as Mock,
      deleteCategory: vi.fn() as Mock,
      countTagsByCategoryId: vi.fn() as Mock,
      countTagsByCategoryIds: vi.fn() as Mock,
      countChildCategories: vi.fn() as Mock,
      countCategories: vi.fn() as Mock,
      findByName: vi.fn() as Mock,
      restore: vi.fn() as Mock,
      countVersionsByTagId: vi.fn() as Mock,
      maxVersionByTagId: vi.fn().mockResolvedValue(0) as Mock,
      deleteVersionById: vi.fn() as Mock,
    };
    mockFactory = {
      createTag: vi.fn() as Mock,
      createTagVersion: vi.fn() as Mock,
      createTagCategory: vi.fn() as Mock
    };
    mockTargetTableRepository = {
      create: vi.fn() as Mock,
      findById: vi.fn() as Mock,
      findByTableName: vi.fn() as Mock,
      findAnyByTableName: vi.fn() as Mock,
      restore: vi.fn() as Mock,
      findByTagId: vi.fn() as Mock,
      findAll: vi.fn() as Mock,
      update: vi.fn() as Mock,
      delete: vi.fn() as Mock,
      updateStatus: vi.fn() as Mock,
      linkTag: vi.fn() as Mock,
      unlinkTag: vi.fn() as Mock,
      updateStats: vi.fn() as Mock,
    };
    service = new TagDomainServiceImpl(mockRepository, mockFactory, mockTargetTableRepository);
  });

  describe('createTag', () => {
    it('should create and save a new tag', async () => {
      const categoryId = generateTestUuid();
      const tagId = generateTestUuid();
      const command = {
        name: 'Test Tag',
        valueType: TagValueType.BOOLEAN,
        categoryId,
        createdBy: TEST_USER_ID
      };

      const mockCategory = MockFactory.createTagCategoryVO({
        id: categoryId,
        name: 'Test Category'
      });

      const mockTag = MockFactory.createTagVO({
        id: tagId,
        name: 'Test Tag',
        category: mockCategory,
        status: TagStatus.DRAFT
      }) as unknown as Tag;

      mockRepository.findCategoryById = vi.fn().mockResolvedValue(mockCategory);
      mockFactory.createTag = vi.fn().mockReturnValue(mockTag);
      mockRepository.create = vi.fn().mockResolvedValue(mockTag);

      const result = await service.createTag(command);

      expect(result.name).toBe('Test Tag');
      expect(mockFactory.createTag).toHaveBeenCalledWith(command);
      expect(mockRepository.create).toHaveBeenCalledWith(mockTag, undefined);
    });

    it('should not link target table when tag has no currentVersionId', async () => {
      const categoryId = generateTestUuid();
      const targetTableId = generateTestUuid();
      const command = {
        name: 'Tag Without Version',
        valueType: TagValueType.BOOLEAN,
        categoryId,
        targetTableId,
        createdBy: TEST_USER_ID
      };

      const mockCategory = MockFactory.createTagCategoryVO({
        id: categoryId,
        name: 'Test Category'
      });

      const mockTag = MockFactory.createTagVO({
        id: generateTestUuid(),
        name: 'Tag Without Version',
        category: mockCategory,
        status: TagStatus.DRAFT
      }) as unknown as Tag;
      (mockTag as any).currentVersionId = undefined;

      mockRepository.findCategoryById = vi.fn().mockResolvedValue(mockCategory);
      mockFactory.createTag = vi.fn().mockReturnValue(mockTag);
      mockRepository.create = vi.fn().mockResolvedValue(mockTag);

      await service.createTag(command);

      expect(mockTargetTableRepository.linkTag).not.toHaveBeenCalled();
    });

    it('should link target table when tag has currentVersionId', async () => {
      const categoryId = generateTestUuid();
      const tagId = generateTestUuid();
      const versionId = generateTestUuid();
      const targetTableId = generateTestUuid();
      const command = {
        name: 'Tag With Version',
        valueType: TagValueType.BOOLEAN,
        categoryId,
        targetTableId,
        createdBy: TEST_USER_ID
      };

      const mockCategory = MockFactory.createTagCategoryVO({
        id: categoryId,
        name: 'Test Category'
      });

      const mockTag = MockFactory.createTagVO({
        id: tagId,
        name: 'Tag With Version',
        category: mockCategory,
        status: TagStatus.DRAFT
      }) as unknown as Tag;
      (mockTag as any).currentVersionId = versionId;

      mockRepository.findCategoryById = vi.fn().mockResolvedValue(mockCategory);
      mockFactory.createTag = vi.fn().mockReturnValue(mockTag);
      mockRepository.create = vi.fn().mockResolvedValue(mockTag);

      await service.createTag(command);

      expect(mockTargetTableRepository.linkTag).toHaveBeenCalledWith(
        targetTableId,
        tagId,
        versionId
      );
    });
  });

  describe('getTag', () => {
    it('should return tag when found', async () => {
      const tagId = generateTestUuid();
      const mockTag = MockFactory.createTagVO({
        id: tagId,
        name: 'Test Tag',
        status: TagStatus.ACTIVE
      }) as unknown as Tag;

      mockRepository.findById = vi.fn().mockResolvedValue(mockTag);

      const result = await service.getTag(tagId);

      expect(result.id).toBe(tagId);
      expect(result.name).toBe('Test Tag');
      expect(mockRepository.findById).toHaveBeenCalledWith(tagId, undefined);
    });

    it('should throw error when tag not found', async () => {
      mockRepository.findById = vi.fn().mockResolvedValue(null);

      const nonexistentId = generateTestUuid();
      await expect(service.getTag(nonexistentId)).rejects.toThrow(`标签不存在: ${nonexistentId}`);
    });
  });

  describe('updateTag', () => {
    it('should update tag name and description', async () => {
      const tagId = generateTestUuid();
      const mockTag = {
        id: tagId,
        name: 'Old Name',
        description: 'Old Description',
        updateInfo: vi.fn(),
        changeStatus: vi.fn()
      } as unknown as Tag;

      mockRepository.findById = vi.fn().mockResolvedValue(mockTag);
      mockRepository.update = vi.fn().mockResolvedValue(mockTag);

      const command = {
        tagId,
        name: 'New Name',
        description: 'New Description',
        updatedBy: TEST_USER_ID
      };

      const result = await service.updateTag(command);

      expect(mockTag.updateInfo).toHaveBeenCalledWith('New Name', 'New Description', undefined);
      expect(mockRepository.update).toHaveBeenCalledWith(mockTag);
    });

    it('should throw error when updating non-existent tag', async () => {
      mockRepository.findById = vi.fn().mockResolvedValue(null);

      const nonexistentId = generateTestUuid();
      const command = {
        tagId: nonexistentId,
        name: 'New Name',
        updatedBy: TEST_USER_ID
      };

      await expect(service.updateTag(command)).rejects.toThrow('不存在');
    });
  });

  describe('updateTagStatus', () => {
    it('should change tag status to ACTIVE', async () => {
      const tagId = generateTestUuid();
      const mockTag = {
        id: tagId,
        status: TagStatus.DRAFT,
        changeStatus: vi.fn()
      } as unknown as Tag;

      mockRepository.findById = vi.fn().mockResolvedValue(mockTag);
      mockRepository.update = vi.fn().mockResolvedValue(mockTag);

      const result = await service.updateTagStatus(tagId, TagStatus.ACTIVE);

      expect(mockTag.changeStatus).toHaveBeenCalledWith(TagStatus.ACTIVE);
      expect(mockRepository.update).toHaveBeenCalledWith(mockTag);
    });

    it('should change tag status to INACTIVE', async () => {
      const tagId = generateTestUuid();
      const mockTag = {
        id: tagId,
        status: TagStatus.ACTIVE,
        changeStatus: vi.fn()
      } as unknown as Tag;

      mockRepository.findById = vi.fn().mockResolvedValue(mockTag);
      mockRepository.update = vi.fn().mockResolvedValue(mockTag);

      await service.updateTagStatus(tagId, TagStatus.INACTIVE);

      expect(mockTag.changeStatus).toHaveBeenCalledWith(TagStatus.INACTIVE);
    });
  });

  describe('deleteTag', () => {
    it('should delete tag', async () => {
      const tagId = generateTestUuid();
      const mockTag = MockFactory.createTagVO({
        id: tagId,
        name: 'Test Tag',
        status: TagStatus.ACTIVE
      }) as unknown as Tag;

      mockRepository.findById = vi.fn().mockResolvedValue(mockTag);
      mockRepository.delete = vi.fn().mockResolvedValue(undefined);

      await service.deleteTag(tagId);

      expect(mockRepository.findById).toHaveBeenCalledWith(tagId, undefined);
      expect(mockRepository.delete).toHaveBeenCalledWith(tagId, undefined);
    });

    it('should NOT clear TargetTable references during soft delete', async () => {
      const tagId = generateTestUuid();
      const mockTag = MockFactory.createTagVO({
        id: tagId,
        name: 'Test Tag',
        status: TagStatus.ACTIVE
      }) as unknown as Tag;

      mockRepository.findById = vi.fn().mockResolvedValue(mockTag);
      mockRepository.delete = vi.fn().mockResolvedValue(undefined);

      await service.deleteTag(tagId);

      expect(mockTargetTableRepository.findAll).not.toHaveBeenCalled();
      expect(mockTargetTableRepository.update).not.toHaveBeenCalled();
      expect(mockRepository.delete).toHaveBeenCalledWith(tagId, undefined);
    });
  });

  describe('createTagVersion', () => {
    it('should create and save a new tag version', async () => {
      const tagId = generateTestUuid();
      const versionId = generateTestUuid();
      const command = {
        tagId,
        version: 1,
        rule: {
          ruleType: RuleType.SQL,
          ruleContent: 'SELECT * FROM users',
          dataModelIds: [generateTestUuid()]
        },
        createdBy: TEST_USER_ID
      };

      const mockVersion = {
        id: versionId,
        tagId,
        version: 1
      } as TagVersion;

      mockFactory.createTagVersion = vi.fn().mockReturnValue(mockVersion);
      mockRepository.createVersion = vi.fn().mockResolvedValue(mockVersion);

      const result = await service.createTagVersion(command);

      expect(result.tagId).toBe(tagId);
      expect(mockFactory.createTagVersion).toHaveBeenCalledWith(command);
      expect(mockRepository.createVersion).toHaveBeenCalledWith(mockVersion);
    });
  });

  describe('setCurrentVersion', () => {
    it('should set current version for tag', async () => {
      const tagId = generateTestUuid();
      const versionId = generateTestUuid();
      const mockTag = {
        id: tagId,
        currentVersionId: undefined,
        setCurrentVersion: vi.fn()
      } as unknown as Tag;

      mockRepository.findById = vi.fn().mockResolvedValue(mockTag);
      mockRepository.update = vi.fn().mockResolvedValue(mockTag);

      const result = await service.setCurrentVersion(tagId, versionId);

      expect(mockTag.setCurrentVersion).toHaveBeenCalledWith(versionId);
      expect(mockRepository.update).toHaveBeenCalledWith(mockTag);
    });

    it('should throw error when tag not found', async () => {
      mockRepository.findById = vi.fn().mockResolvedValue(null);

      const nonexistentId = generateTestUuid();
      await expect(service.setCurrentVersion(nonexistentId, generateTestUuid())).rejects.toThrow('不存在');
    });
  });
});
