import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { TagApplicationServiceImpl } from '@/modules/tag/services/TagApplicationServiceImpl';
import { TagDomainService } from '@/modules/tag/domain/services/ports/TagDomainService';
import { TagVersionDomainService } from '@/modules/tag/domain/services/ports/TagVersionDomainService';
import { TagQueryDomainService } from '@/modules/tag/domain/services/ports/TagQueryDomainService';
import { ITagOHSAdapter } from '@/modules/tag/services/ITagOHSAdapter';
import { ITagVersionOHSAdapter } from '@/modules/tag/services/ITagVersionOHSAdapter';
import { TagStatus, SortOrder, TagValueType, TagType } from '@/shared/enums/index';
import { Tag } from '@/modules/tag/domain/entities/Tag';
import { IBitmapApplicationService } from '@/modules/tag/services/bitmap/IBitmapApplicationService';
import { ConflictException } from '@/shared/errors/index';
import { IMaterializedViewConfigRepository } from '@/modules/tag/domain/ports/IMaterializedViewConfigRepository';
import { ITargetTableRepository } from '@/modules/tag/domain/ports/ITargetTableRepository';
import { IClickHouseClientAdapter } from '@/platform/database/interface/IClickHouseClientAdapter';

// 应用服务的事务边界在内存中执行，保持回滚错误传播语义。
vi.mock('@/platform/database',()=>({transaction:vi.fn(async(work:(client:unknown)=>Promise<unknown>)=>work(undefined))}));

type MockMvConfigRepository = {
  [K in keyof IMaterializedViewConfigRepository]: Mock;
};

type MockTargetTableRepository = {
  [K in keyof ITargetTableRepository]: Mock;
};

type MockClickHouseClientAdapter = {
  [K in keyof IClickHouseClientAdapter]: Mock;
};

type MockTagDomainService = {
  [K in keyof TagDomainService]: Mock;
};

type MockTagVersionDomainService = {
  [K in keyof TagVersionDomainService]: Mock;
};

type MockTagQueryDomainService = {
  [K in keyof TagQueryDomainService]: Mock;
};

type MockTagOHSAdapter = {
  [K in keyof ITagOHSAdapter]: Mock;
};

type MockTagVersionOHSAdapter = {
  [K in keyof ITagVersionOHSAdapter]: Mock;
};

type MockBitmapApplicationService = {
  [K in keyof IBitmapApplicationService]: Mock;
};

describe('TagApplicationServiceImpl', () => {
  let service: TagApplicationServiceImpl;
  let mockTagDomainService: MockTagDomainService;
  let mockTagVersionDomainService: MockTagVersionDomainService;
  let mockTagQueryDomainService: MockTagQueryDomainService;
  let mockTagOHSAdapter: MockTagOHSAdapter;
  let mockTagVersionOHSAdapter: MockTagVersionOHSAdapter;
  let mockBitmapApplicationService: MockBitmapApplicationService;
  let mockMvConfigRepository: MockMvConfigRepository;
  let mockTargetTableRepository: MockTargetTableRepository;
  let mockChClient: MockClickHouseClientAdapter;

  beforeEach(() => {
    mockTagDomainService = {
      createTag: vi.fn(),
      getTag: vi.fn(),
      updateTag: vi.fn(),
      updateTagStatus: vi.fn(),
      deleteTag: vi.fn(),
      createTagVersion: vi.fn(),
      deleteTagVersion: vi.fn(),
      setCurrentVersion: vi.fn(),
      findTagByName: vi.fn(),
    };
    mockTagVersionDomainService = {
      listVersions: vi.fn(),
      getVersion: vi.fn(),
      updateVersion: vi.fn(),
      updateVersionStatus: vi.fn(),
      getCurrentVersion: vi.fn(),
      countVersionsByTagId: vi.fn(),
    };
    mockTagQueryDomainService = {
      searchTags: vi.fn(),
      countTagsByCriteria: vi.fn(),
      getTagsByIds: vi.fn(),
      getTagsByCategory: vi.fn(),
      getTagsByStatus: vi.fn(),
      countTagsByCategoryIds: vi.fn()
    };
    mockTagOHSAdapter = {
      fromTagToTagVO: vi.fn(),
      fromTagListToTagVOList: vi.fn(),
      fromDTOToTagEntity: vi.fn(),
      fromDTOToUpdateTagEntity: vi.fn(),
      fromRequestToGetTagQuery: vi.fn(),
      fromRequestToListTagsQuery: vi.fn(),
      fromRequestToCreateTagCommand: vi.fn(),
      fromRequestToUpdateTagCommand: vi.fn(),
      fromRequestToUpdateTagStatusCommand: vi.fn(),
      fromRequestToDeleteTagCommand: vi.fn(),
      fromRequestToSetCurrentVersionCommand: vi.fn(),
      fromRequestToCreateTagVersionCommand: vi.fn(),
      fromRequestToListTagVersionsQuery: vi.fn(),
      fromRequestToSearchTagsQuery: vi.fn(),
      fromRequestToGetTagsByCategoryQuery: vi.fn(),
      fromRequestToGetTagsByTypeQuery: vi.fn(),
      fromRequestToGetTagsByStatusQuery: vi.fn(),
      fromRequestToCountTagsQuery: vi.fn(),
      fromRequestToExportTagsQuery: vi.fn()
    };
    mockTagVersionOHSAdapter = {
      fromTagVersionToTagVersionVO: vi.fn(),
      fromTagVersionListToTagVersionVOList: vi.fn()
    };

 
    mockBitmapApplicationService = {
      assignBitToTag: vi.fn(),
      listBitmapTables: vi.fn(),
      getBitmapTableDetail: vi.fn(),
      createBitmapTable: vi.fn(),
      updateBitmapTableStatus: vi.fn(),
      releaseBit: vi.fn(),
      getEntityTypes: vi.fn(),
      unassignBit: vi.fn(),
      getTagBitAssignment: vi.fn(),
      isBitPositionAvailable: vi.fn()
    } as MockBitmapApplicationService;

    mockMvConfigRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByTagId: vi.fn(),
      findByTagIdAndVersionId: vi.fn(),
      findByMvName: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteByTagId: vi.fn(),
      findAllWithTagName: vi.fn(),
    } as MockMvConfigRepository;

    mockTargetTableRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByTableName: vi.fn(),
      findAnyByTableName: vi.fn(),
      findByTagId: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      restore: vi.fn(),
      delete: vi.fn(),
      updateStatus: vi.fn(),
      linkTag: vi.fn(),
      unlinkTag: vi.fn(),
      updateStats: vi.fn(),
    } as MockTargetTableRepository;

    mockChClient = {
      testConnection: vi.fn(),
      query: vi.fn(),
      execute: vi.fn(),
      createMaterializedView: vi.fn(),
      dropMaterializedView: vi.fn(),
      createTable: vi.fn(),
      convertToLocalNonReplicated: vi.fn(),
      dropTable: vi.fn(),
      stopView: vi.fn(),
      startView: vi.fn(),
      getRefreshStatus: vi.fn(),
      checkTableExists: vi.fn(),
      createBitmapMaterializedView: vi.fn(),
      getMvTargetTable: vi.fn(),
      createEnumBitmapTable: vi.fn(),
      createEnumBitmapMaterializedView: vi.fn(),
      resetBitmapBit: vi.fn(),
      syncTagBitmap: vi.fn(),
    } as MockClickHouseClientAdapter;

    service = new TagApplicationServiceImpl(
      mockTagDomainService as unknown as TagDomainService,
      mockTagVersionDomainService as unknown as TagVersionDomainService,
      mockTagQueryDomainService as unknown as TagQueryDomainService,
      mockTagOHSAdapter as unknown as ITagOHSAdapter,
      mockTagVersionOHSAdapter as unknown as ITagVersionOHSAdapter,
      mockBitmapApplicationService as unknown as IBitmapApplicationService,
      mockMvConfigRepository as unknown as IMaterializedViewConfigRepository,
      mockTargetTableRepository as unknown as ITargetTableRepository,
      mockChClient as unknown as IClickHouseClientAdapter
    );
  });

describe('createTag', () => {
    it('should create tag and return VO', async () => {
      const command = {
        name: 'Test Tag',
        valueType: TagValueType.BOOLEAN,
        categoryId: 'category-123',
        createdBy: 'user-123'
      };

      const mockTag = { id: 'tag-123', name: 'Test Tag' } as Tag;
      const mockVO = { id: 'tag-123', name: 'Test Tag' };

      mockTagDomainService.createTag.mockResolvedValue(mockTag);
      mockTagOHSAdapter.fromTagToTagVO.mockReturnValue(mockVO);

      const result = await service.createTag(command);

      expect(result.id).toBe('tag-123');
      expect(mockTagDomainService.createTag).toHaveBeenCalledWith(command, undefined);
      expect(mockTagOHSAdapter.fromTagToTagVO).toHaveBeenCalledWith(mockTag);
    });
  });

  it('should call assignBitToTag when bitConfig is provided', async () => {
    const command = {
      name: 'Test Tag',
      valueType: TagValueType.BOOLEAN,
      categoryId: 'category-123',
      targetTableId: 'table-123',
      createdBy: 'user-123',
      bitConfig: {
        bitmapTableId: 'bitmap-123',
        bitPosition: 5
      }
    };

    const mockTag = { id: 'tag-456', name: 'Test Tag' } as Tag;
    const mockVO = { id: 'tag-456', name: 'Test Tag' };

    (mockBitmapApplicationService as MockBitmapApplicationService).isBitPositionAvailable.mockResolvedValue(true);
    mockTagDomainService.createTag.mockResolvedValue(mockTag);
    (mockBitmapApplicationService as MockBitmapApplicationService).assignBitToTag.mockResolvedValue(undefined);
    mockTagOHSAdapter.fromTagToTagVO.mockReturnValue(mockVO);

    await service.createTag(command);

    expect((mockBitmapApplicationService as MockBitmapApplicationService).assignBitToTag).toHaveBeenCalledWith(
      'bitmap-123',
      5,
      'tag-456',
      'user-123', undefined
    );
  });

  it('should not call assignBitToTag when bitConfig is not provided', async () => {
    const command = {
      name: 'Test Tag',
      valueType: TagValueType.BOOLEAN,
      categoryId: 'category-123',
      targetTableId: 'table-123',
      createdBy: 'user-123'
    };

    const mockTag = { id: 'tag-456', name: 'Test Tag' } as Tag;
    const mockVO = { id: 'tag-456', name: 'Test Tag' };

    mockTagDomainService.createTag.mockResolvedValue(mockTag);
    mockTagOHSAdapter.fromTagToTagVO.mockReturnValue(mockVO);

    await service.createTag(command);

    expect((mockBitmapApplicationService as MockBitmapApplicationService).assignBitToTag).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when bitConfig is provided but bit position is not available', async () => {
    const command = {
      name: 'Test Tag',
      valueType: TagValueType.BOOLEAN,
      categoryId: 'category-123',
      targetTableId: 'table-123',
      createdBy: 'user-123',
      bitConfig: {
        bitmapTableId: 'bitmap-123',
        bitPosition: 5
      }
    };

    (mockBitmapApplicationService as MockBitmapApplicationService).isBitPositionAvailable.mockResolvedValue(false);

    try {
      await service.createTag(command);
      expect.fail('Should throw ConflictException');
    } catch (error) {
      expect((error as ConflictException).code).toBe('TAG_BIT_POSITION_OCCUPIED');
      expect((error as ConflictException).httpStatus).toBe(409);
    }

    expect(mockTagDomainService.createTag).not.toHaveBeenCalled();
    expect((mockBitmapApplicationService as MockBitmapApplicationService).assignBitToTag).not.toHaveBeenCalled();
  });

  it('should create tag when bitConfig is provided and bit position is available', async () => {
    const command = {
      name: 'Test Tag',
      valueType: TagValueType.BOOLEAN,
      categoryId: 'category-123',
      targetTableId: 'table-123',
      createdBy: 'user-123',
      bitConfig: {
        bitmapTableId: 'bitmap-123',
        bitPosition: 5
      }
    };

    const mockTag = { id: 'tag-456', name: 'Test Tag' } as Tag;
    const mockVO = { id: 'tag-456', name: 'Test Tag' };

    (mockBitmapApplicationService as MockBitmapApplicationService).isBitPositionAvailable.mockResolvedValue(true);
    mockTagDomainService.createTag.mockResolvedValue(mockTag);
    (mockBitmapApplicationService as MockBitmapApplicationService).assignBitToTag = vi.fn();
    mockTagOHSAdapter.fromTagToTagVO.mockReturnValue(mockVO);

    await service.createTag(command);

    expect((mockBitmapApplicationService as MockBitmapApplicationService).isBitPositionAvailable).toHaveBeenCalledWith(
      'bitmap-123',
      5
    );
    expect(mockTagDomainService.createTag).toHaveBeenCalledWith(command, undefined);
    expect((mockBitmapApplicationService as MockBitmapApplicationService).assignBitToTag).toHaveBeenCalledWith(
      'bitmap-123',
      5,
      'tag-456',
      'user-123', undefined
    );
  });

  describe('getTag', () => {
    it('should return tag VO for existing tag', async () => {
      const mockTag = { id: 'tag-123', name: 'Test Tag' } as Tag;
      const mockVO = { id: 'tag-123', name: 'Test Tag' };

      mockTagDomainService.getTag.mockResolvedValue(mockTag);
      mockTagOHSAdapter.fromTagToTagVO.mockReturnValue(mockVO);

      const result = await service.getTag({ tagId: 'tag-123' });

      expect(result.id).toBe('tag-123');
      expect(mockTagDomainService.getTag).toHaveBeenCalledWith('tag-123', undefined);
    });
  });

  describe('updateTag', () => {
    it('should update tag and return VO', async () => {
      const command = {
        tagId: 'tag-123',
        name: 'Updated Name',
        updatedBy: 'user-123',
        ownedBy: 'user-123'
      };

      const mockTag = { id: 'tag-123', name: 'Updated Name' } as Tag;
      const mockVO = { id: 'tag-123', name: 'Updated Name' };

      mockTagDomainService.updateTag.mockResolvedValue(mockTag);
      mockTagOHSAdapter.fromTagToTagVO.mockReturnValue(mockVO);

      const result = await service.updateTag(command);

      expect(result.name).toBe('Updated Name');
      expect(mockTagDomainService.updateTag).toHaveBeenCalledWith(command, { tenantId: 'user-123' });
    });
  });

  describe('updateTagStatus', () => {
    it('should update status and return VO', async () => {
      const command = {
        tagId: 'tag-123',
        status: TagStatus.ACTIVE,
        updatedBy: 'user-123',
        ownedBy: 'user-123'
      };

      const mockTag = { id: 'tag-123', status: TagStatus.ACTIVE } as Tag;
      const mockVO = { id: 'tag-123', status: TagStatus.ACTIVE };

      mockTagDomainService.updateTagStatus.mockResolvedValue(mockTag);
      mockTagOHSAdapter.fromTagToTagVO.mockReturnValue(mockVO);

      const result = await service.updateTagStatus(command);

      expect(result.status).toBe(TagStatus.ACTIVE);
      expect(mockTagDomainService.updateTagStatus).toHaveBeenCalledWith('tag-123', TagStatus.ACTIVE, { tenantId: 'user-123' });
    });
  });

  describe('deleteTag', () => {
    it('should delete tag', async () => {
      mockTagDomainService.deleteTag.mockResolvedValue(undefined);

      await service.deleteTag({ tagId: 'tag-123', deletedBy: 'user-123', ownedBy: 'user-123' });

      expect(mockTagDomainService.deleteTag).toHaveBeenCalledWith('tag-123', 'user-123', { tenantId: 'user-123' });
    });
  });

  describe('createTagVersion', () => {
    it('should create version and return VO', async () => {
      const command = {
        tagId: 'tag-123',
        version: 1,
        createdBy: 'user-123'
      };

      const mockVersion = { id: 'version-123', tagId: 'tag-123', version: 1 };
      const mockTag = { id: 'tag-123', name: 'Test Tag' } as Tag;
      const mockVO = { id: 'version-123', version: 1 };

      mockTagDomainService.createTagVersion.mockResolvedValue(mockVersion);
      mockTagDomainService.getTag.mockResolvedValue(mockTag);
      mockTagVersionOHSAdapter.fromTagVersionToTagVersionVO.mockReturnValue(mockVO);

      const result = await service.createTagVersion(command);

      expect(result.id).toBe('version-123');
      expect(mockTagDomainService.createTagVersion).toHaveBeenCalledWith(command);
      expect(mockTagDomainService.getTag).toHaveBeenCalledWith('tag-123');
      expect(mockTagVersionOHSAdapter.fromTagVersionToTagVersionVO).toHaveBeenCalledWith(mockVersion, mockTag);
    });
  });

  describe('setCurrentVersion', () => {
    const command = {
      tagId: 'tag-123',
      versionId: 'version-456',
      updatedBy: 'user-123',
      ownedBy: 'user-123'
    };

    const mockVO = { id: 'tag-123', currentVersion: 'version-456' };

    beforeEach(() => {
      mockTagOHSAdapter.fromTagToTagVO.mockReturnValue(mockVO);
    });

    it('should reject when tag is ACTIVE', async () => {
      const mockTag = {
        id: 'tag-123',
        status: TagStatus.ACTIVE,
        currentVersionId: 'version-old',
        dataType: TagValueType.STRING,
      } as Tag;
      mockTagDomainService.getTag.mockResolvedValue(mockTag);

      await expect(service.setCurrentVersion(command)).rejects.toThrow(/活跃状态/);

      expect(mockChClient.dropMaterializedView).not.toHaveBeenCalled();
      expect(mockMvConfigRepository.deleteByTagId).not.toHaveBeenCalled();
      expect(mockTagDomainService.setCurrentVersion).not.toHaveBeenCalled();
    });

    it('should short-circuit when switching to the same version', async () => {
      const mockTag = {
        id: 'tag-123',
        status: TagStatus.INACTIVE,
        currentVersionId: 'version-456',
        dataType: TagValueType.STRING,
      } as Tag;
      mockTagDomainService.getTag.mockResolvedValue(mockTag);

      const result = await service.setCurrentVersion(command);

      expect(result).toBe(mockVO);
      expect(mockChClient.dropMaterializedView).not.toHaveBeenCalled();
      expect(mockMvConfigRepository.deleteByTagId).not.toHaveBeenCalled();
      expect(mockTagDomainService.setCurrentVersion).not.toHaveBeenCalled();
    });

    it('should drop old MVs by mvc.mvName, clear mvc, switch version, and relink target_table', async () => {
      const mockTag = {
        id: 'tag-123',
        status: TagStatus.INACTIVE,
        currentVersionId: 'version-old',
        dataType: TagValueType.STRING,
        currentVersion: { version: 1 },
      } as Tag;
      mockTagDomainService.getTag.mockResolvedValue(mockTag);
      mockTagDomainService.setCurrentVersion.mockResolvedValue(mockTag);

      const mockOldConfigs = [
        { mvName: 'mv_tag_tag-123_v1', tagId: 'tag-123', versionId: 'version-old' },
      ];
      mockMvConfigRepository.findByTagId.mockResolvedValue(mockOldConfigs);

      const mockTargetTable = { id: 'tt-1', tagId: 'tag-123', tagVersionId: 'version-old' };
      mockTargetTableRepository.findByTagId.mockResolvedValue(mockTargetTable);
      mockTargetTableRepository.linkTag.mockResolvedValue(mockTargetTable);

      const result = await service.setCurrentVersion(command);

      expect(result).toBe(mockVO);
      // 1. 读取旧 mvc
      expect(mockMvConfigRepository.findByTagId).toHaveBeenCalledWith('tag-123');
      // 2. 按 mvc.mvName drop MV
      expect(mockChClient.dropMaterializedView).toHaveBeenCalledWith('mv_tag_tag-123_v1');
      // 3. 清理 mvc
      expect(mockMvConfigRepository.deleteByTagId).toHaveBeenCalledWith('tag-123', { tenantId: 'user-123' });
      // 4. 切换版本
      expect(mockTagDomainService.setCurrentVersion).toHaveBeenCalledWith(
        'tag-123',
        'version-456',
        { tenantId: 'user-123' }
      );
      // 5. 重连 target_table
      expect(mockTargetTableRepository.linkTag).toHaveBeenCalledWith('tt-1', 'tag-123', 'version-456');
    });

    it('should fallback to naming convention when mvc is empty', async () => {
      const mockTag = {
        id: 'tag-123',
        status: TagStatus.INACTIVE,
        currentVersionId: 'version-old',
        dataType: TagValueType.STRING,
        currentVersion: { version: 3 },
      } as Tag;
      mockTagDomainService.getTag.mockResolvedValue(mockTag);
      mockTagDomainService.setCurrentVersion.mockResolvedValue(mockTag);

      mockMvConfigRepository.findByTagId.mockResolvedValue([]);
      mockTargetTableRepository.findByTagId.mockResolvedValue(null);

      await service.setCurrentVersion(command);

      // 兜底应该按命名规则尝试 drop 主 MV 和 _bitmap MV
      expect(mockChClient.dropMaterializedView).toHaveBeenCalledWith('mv_tag_tag-123_v3');
      expect(mockChClient.dropMaterializedView).toHaveBeenCalledWith('mv_tag_tag-123_v3_bitmap');
    });

    it('should clean ENUM bitmap MVs and _enum table for ENUM tags', async () => {
      const mockTag = {
        id: 'tag-enum',
        status: TagStatus.INACTIVE,
        currentVersionId: 'version-old',
        dataType: TagValueType.ENUM,
        currentVersion: { version: 2 },
      } as Tag;
      mockTagDomainService.getTag.mockResolvedValue(mockTag);
      mockTagDomainService.setCurrentVersion.mockResolvedValue(mockTag);

      mockMvConfigRepository.findByTagId.mockResolvedValue([
        { mvName: 'mv_tag_tag-enum_v2', tagId: 'tag-enum', versionId: 'version-old' },
      ]);
      mockTargetTableRepository.findByTagId.mockResolvedValue(null);
      (mockBitmapApplicationService as MockBitmapApplicationService).getTagBitAssignment
        .mockResolvedValue({ bitmapTableName: 'bitmap_tbl_xyz' });

      const enumCommand = { ...command, tagId: 'tag-enum' };
      await service.setCurrentVersion(enumCommand);

      // ENUM bitmap MV
      expect(mockChClient.dropMaterializedView).toHaveBeenCalledWith('mv_tag_tag-enum_v2_enum_bitmap');
      // 兼容 _bitmap 后缀
      expect(mockChClient.dropMaterializedView).toHaveBeenCalledWith('mv_tag_tag-enum_v2_bitmap');
      // ENUM bitmap 表
      expect(mockChClient.dropTable).toHaveBeenCalledWith('bitmap_tbl_xyz_enum');
    });

    it('should continue switching when cleanup steps fail (best-effort)', async () => {
      const mockTag = {
        id: 'tag-123',
        status: TagStatus.INACTIVE,
        currentVersionId: 'version-old',
        dataType: TagValueType.STRING,
        currentVersion: { version: 1 },
      } as Tag;
      mockTagDomainService.getTag.mockResolvedValue(mockTag);
      mockTagDomainService.setCurrentVersion.mockResolvedValue(mockTag);

      mockMvConfigRepository.findByTagId.mockRejectedValue(new Error('PG down'));
      mockMvConfigRepository.deleteByTagId.mockRejectedValue(new Error('PG down'));
      mockTargetTableRepository.findByTagId.mockResolvedValue(null);

      // 不应抛错
      const result = await service.setCurrentVersion(command);
      expect(result).toBe(mockVO);
      expect(mockTagDomainService.setCurrentVersion).toHaveBeenCalled();
    });
  });

  describe('listTagVersions', () => {
    it('should return list of version VOs', async () => {
      const query = { tagId: 'tag-123', page: 1, pageSize: 10 };

      const mockVersions = [
        { id: 'version-1', tagId: 'tag-123', version: 1 },
        { id: 'version-2', tagId: 'tag-123', version: 2 }
      ];
      const mockTag = { id: 'tag-123', name: 'Test Tag' } as Tag;
      const mockVOs = [
        { id: 'version-1', version: 1 },
        { id: 'version-2', version: 2 }
      ];

      mockTagVersionDomainService.listVersions.mockResolvedValue(mockVersions);
      mockTagDomainService.getTag.mockResolvedValue(mockTag);
      mockTagVersionOHSAdapter.fromTagVersionListToTagVersionVOList.mockReturnValue(mockVOs);

      const result = await service.listTagVersions(query);

      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(mockTagVersionDomainService.listVersions).toHaveBeenCalledWith('tag-123');
    });

    it('should use default pagination values', async () => {
      const query = { tagId: 'tag-123' };

      mockTagVersionDomainService.listVersions.mockResolvedValue([]);
      mockTagVersionOHSAdapter.fromTagVersionListToTagVersionVOList.mockReturnValue([]);

      const result = await service.listTagVersions(query);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(mockTagVersionDomainService.listVersions).toHaveBeenCalledWith('tag-123');
    });

    it('should handle errors when fetching tags gracefully', async () => {
      const query = { tagId: 'tag-123' };

      const mockVersions = [
        { id: 'version-1', tagId: 'tag-123', version: 1 }
      ];

      mockTagVersionDomainService.listVersions.mockResolvedValue(mockVersions);
      mockTagDomainService.getTag.mockRejectedValue(new Error('Tag not found'));
      mockTagVersionOHSAdapter.fromTagVersionListToTagVersionVOList.mockReturnValue([]);

      const result = await service.listTagVersions(query);

      expect(result.items).toHaveLength(0);
    });
  });

  describe('listTags', () => {
    it('keeps public visibility and tenant scope in both rows and total count', async () => {
      mockTagQueryDomainService.searchTags.mockResolvedValue([]);
      mockTagQueryDomainService.countTagsByCriteria.mockResolvedValue(0);
      await service.listTags({isPublic:true,tenantFilter:{tenantId:'other-organization'}});
      const scope={isPublic:true,tenantFilter:{tenantId:'other-organization'}};
      expect(mockTagQueryDomainService.searchTags).toHaveBeenCalledWith(expect.objectContaining(scope),expect.any(Object));
      expect(mockTagQueryDomainService.countTagsByCriteria).toHaveBeenCalledWith(expect.objectContaining(scope));
    });
    it('should return paged list of tags', async () => {
      const query = {
        categoryId: 'category-123',
        page: 1,
        pageSize: 10
      };

      const mockTags = [
        { id: 'tag-1', name: 'Tag 1' } as Tag,
        { id: 'tag-2', name: 'Tag 2' } as Tag
      ];
      const mockVOs = [
        { id: 'tag-1', name: 'Tag 1' },
        { id: 'tag-2', name: 'Tag 2' }
      ];

      mockTagQueryDomainService.searchTags.mockResolvedValue(mockTags);
      mockTagQueryDomainService.countTagsByCriteria.mockResolvedValue(2);
      mockTagOHSAdapter.fromTagToTagVO
        .mockReturnValueOnce(mockVOs[0])
        .mockReturnValueOnce(mockVOs[1]);

      const result = await service.listTags(query);

      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(mockTagQueryDomainService.searchTags).toHaveBeenCalledWith(
        { categoryId: 'category-123' },
        { page: 1, pageSize: 10, sortOrder: SortOrder.DESC }
      );
    });

    it('should calculate total pages correctly', async () => {
      const query = { page: 1, pageSize: 10 };

      mockTagQueryDomainService.searchTags.mockResolvedValue([]);
      mockTagQueryDomainService.countTagsByCriteria.mockResolvedValue(25);

      const result = await service.listTags(query);

      expect(result.totalPages).toBe(3);
    });

    it('should use default pagination values', async () => {
      const query = {};

      mockTagQueryDomainService.searchTags.mockResolvedValue([]);
      mockTagQueryDomainService.countTagsByCriteria.mockResolvedValue(0);

      const result = await service.listTags(query);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('should pass all query filters to search', async () => {
      const query = {
        categoryId: 'cat-1',
        type: TagType.SIMPLE,
        status: TagStatus.ACTIVE,
        keyword: 'test'
      };

      mockTagQueryDomainService.searchTags.mockResolvedValue([]);
      mockTagQueryDomainService.countTagsByCriteria.mockResolvedValue(0);

      await service.listTags(query);

      expect(mockTagQueryDomainService.searchTags).toHaveBeenCalledWith(
        {
          categoryId: 'cat-1',
          type: TagType.SIMPLE,
          status: TagStatus.ACTIVE,
          name: 'test'
        },
        expect.any(Object)
      );
    });
  });
});
