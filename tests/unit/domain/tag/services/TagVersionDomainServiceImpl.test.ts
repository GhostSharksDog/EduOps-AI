import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { TagVersionDomainServiceImpl } from '@/modules/tag/domain/services/TagVersionDomainServiceImpl';
import { TagRepository } from '@/modules/tag/domain/ports/TagRepository';
import { Tag, TagVersion } from '@/modules/tag/domain/index';
import { TagStatus } from '@/shared/enums/index';
import { RuleType } from '@/shared/enums/index';
import { MockFactory } from '../../../../helpers/mock-factory';

describe('TagVersionDomainServiceImpl', () => {
  let service: TagVersionDomainServiceImpl;
  let mockRepository: TagRepository;

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn() as Mock,
      findVersionById: vi.fn() as Mock,
      findVersionsByTagId: vi.fn() as Mock,
      updateVersion: vi.fn() as Mock,
      create: vi.fn() as Mock,
      update: vi.fn() as Mock,
      delete: vi.fn() as Mock,
      findAll: vi.fn() as Mock,
      findByIds: vi.fn() as Mock,
      createVersion: vi.fn() as Mock,
      createCategory: vi.fn() as Mock,
      findCategoryById: vi.fn() as Mock,
      findAllCategories: vi.fn() as Mock,
      updateCategory: vi.fn() as Mock,
      deleteCategory: vi.fn() as Mock,
      countTagsByCategoryId: vi.fn() as Mock,
      countTagsByCategoryIds: vi.fn() as Mock,
      countChildCategories: vi.fn() as Mock,
      countCategories: vi.fn() as Mock
    } as unknown as TagRepository;
    service = new TagVersionDomainServiceImpl(mockRepository);
  });

  describe('getVersion', () => {
    it('should return version when found', async () => {
      const mockVersion = {
        id: 'version-123',
        tagId: 'tag-123',
        version: 1,
        description: 'Test version'
      } as TagVersion;

      (mockRepository.findVersionById as Mock).mockResolvedValue(mockVersion);

      const result = await service.getVersion('version-123');

      expect(result.id).toBe('version-123');
      expect(mockRepository.findVersionById).toHaveBeenCalledWith('version-123');
    });

    it('should throw error when version not found', async () => {
      (mockRepository.findVersionById as Mock).mockResolvedValue(null);

      await expect(service.getVersion('nonexistent')).rejects.toThrow('版本不存在: nonexistent');
    });
  });

  describe('updateVersion', () => {
    it('should update version description', async () => {
      const mockVersion = {
        id: 'version-123',
        tagId: 'tag-123',
        version: 1,
        updateDescription: vi.fn(),
        updateRule: vi.fn()
      } as unknown as TagVersion;

      (mockRepository.findVersionById as Mock).mockResolvedValue(mockVersion);
      (mockRepository.updateVersion as Mock).mockResolvedValue(mockVersion);

      const versionData = { description: 'New description' };
      const result = await service.updateVersion('version-123', versionData);

      expect(mockVersion.updateDescription).toHaveBeenCalledWith('New description');
      expect(mockRepository.updateVersion).toHaveBeenCalledWith(mockVersion);
    });

    it('should update version rule', async () => {
      const mockVersion = {
        id: 'version-123',
        tagId: 'tag-123',
        version: 1,
        updateDescription: vi.fn(),
        updateRule: vi.fn()
      } as unknown as TagVersion;

      (mockRepository.findVersionById as Mock).mockResolvedValue(mockVersion);
      (mockRepository.updateVersion as Mock).mockResolvedValue(mockVersion);

      const versionData = { rule: { ruleType: RuleType.SQL, ruleContent: 'SELECT 1', dataModelIds: [] } };
      const result = await service.updateVersion('version-123', versionData);

      expect(mockVersion.updateRule).toHaveBeenCalledWith(versionData.rule);
    });

    it('should throw error when version not found', async () => {
      (mockRepository.findVersionById as Mock).mockResolvedValue(null);

      const versionData = { description: 'New description' };
      await expect(service.updateVersion('nonexistent', versionData)).rejects.toThrow('不存在');
    });
  });

  describe('listVersions', () => {
    it('should return list of versions for a tag', async () => {
      const mockVersions = [
        { id: 'version-1', tagId: 'tag-123', version: 1 },
        { id: 'version-2', tagId: 'tag-123', version: 2 }
      ] as TagVersion[];

      (mockRepository.findVersionsByTagId as Mock).mockResolvedValue(mockVersions);

      const result = await service.listVersions('tag-123');

      expect(result).toHaveLength(2);
      expect(mockRepository.findVersionsByTagId).toHaveBeenCalledWith('tag-123');
    });

    it('should return empty array when no versions found', async () => {
      (mockRepository.findVersionsByTagId as Mock).mockResolvedValue([]);

      const result = await service.listVersions('tag-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('getCurrentVersion', () => {
    it('should return currentVersion from tag when available', async () => {
      const mockCurrentVersion = { id: 'version-1', tagId: 'tag-123', version: 1 } as TagVersion;
      const mockTag = {
        id: 'tag-123',
        currentVersion: mockCurrentVersion,
        currentVersionId: 'version-1'
      } as unknown as Tag;

      (mockRepository.findById as Mock).mockResolvedValue(mockTag);

      const result = await service.getCurrentVersion('tag-123');

      expect(result.id).toBe('version-1');
    });

    it('should fetch version by currentVersionId when currentVersion is null', async () => {
      const mockVersion = { id: 'version-1', tagId: 'tag-123', version: 1 } as TagVersion;
      const mockTag = {
        id: 'tag-123',
        currentVersion: null,
        currentVersionId: 'version-1'
      } as unknown as Tag;

      (mockRepository.findById as Mock).mockResolvedValue(mockTag);
      (mockRepository.findVersionById as Mock).mockResolvedValue(mockVersion);

      const result = await service.getCurrentVersion('tag-123');

      expect(result.id).toBe('version-1');
      expect(mockRepository.findVersionById).toHaveBeenCalledWith('version-1');
    });

    it('should throw error when tag not found', async () => {
      (mockRepository.findById as Mock).mockResolvedValue(null);

      await expect(service.getCurrentVersion('nonexistent')).rejects.toThrow('标签不存在: nonexistent');
    });

    it('should throw error when current version not set', async () => {
      const mockTag = {
        id: 'tag-123',
        currentVersion: null,
        currentVersionId: null
      } as unknown as Tag;

      (mockRepository.findById as Mock).mockResolvedValue(mockTag);

      await expect(service.getCurrentVersion('tag-123')).rejects.toThrow('标签未设置当前版本: tag-123');
    });
  });

  describe('updateVersionStatus', () => {
    it('should set version as current when status is ACTIVE', async () => {
      const mockVersion = {
        id: 'version-123',
        tagId: 'tag-123',
        version: 1,
        setAsCurrent: vi.fn(),
        unsetAsCurrent: vi.fn()
      } as unknown as TagVersion;

      (mockRepository.findVersionById as Mock).mockResolvedValue(mockVersion);
      (mockRepository.updateVersion as Mock).mockResolvedValue(mockVersion);

      const result = await service.updateVersionStatus('version-123', TagStatus.ACTIVE);

      expect(mockVersion.setAsCurrent).toHaveBeenCalled();
      expect(mockRepository.updateVersion).toHaveBeenCalledWith(mockVersion);
    });

    it('should unset version as current when status is INACTIVE', async () => {
      const mockVersion = {
        id: 'version-123',
        tagId: 'tag-123',
        version: 1,
        setAsCurrent: vi.fn(),
        unsetAsCurrent: vi.fn()
      } as unknown as TagVersion;

      (mockRepository.findVersionById as Mock).mockResolvedValue(mockVersion);
      (mockRepository.updateVersion as Mock).mockResolvedValue(mockVersion);

      const result = await service.updateVersionStatus('version-123', TagStatus.INACTIVE);

      expect(mockVersion.unsetAsCurrent).toHaveBeenCalled();
      expect(mockRepository.updateVersion).toHaveBeenCalledWith(mockVersion);
    });
  });
});
