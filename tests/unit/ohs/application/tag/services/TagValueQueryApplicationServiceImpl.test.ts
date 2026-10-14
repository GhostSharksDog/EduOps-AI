import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { TagValueQueryApplicationServiceImpl } from '@/modules/tag/services/TagValueQueryApplicationServiceImpl';
import { TagDomainService } from '@/modules/tag/domain/services/ports/TagDomainService';
import { IClickHouseClientAdapter } from '@/platform/database/interface/IClickHouseClientAdapter';
import { GetTagValuesCommand, TagValueResult } from '@/modules/tag/services/TagValueQueryApplicationService';
import { Tag } from '@/modules/tag/domain/entities/Tag';
import { TagVersion } from '@/modules/tag/domain/entities/TagVersion';
import { TagValueType } from '@/shared/enums/tag/TagValueType';
import { TagStatus } from '@/shared/enums/tag/TagStatus';
import { UpdateCycle } from '@/shared/enums/tag/UpdateCycle';

type MockTagDomainService = { [K in keyof TagDomainService]: Mock };
type MockCHClient = { [K in keyof IClickHouseClientAdapter]: Mock };

describe('TagValueQueryApplicationServiceImpl', () => {
  let service: TagValueQueryApplicationServiceImpl;
  let mockTagDomainService: MockTagDomainService;
  let mockCHClient: MockCHClient;
  let mockMvConfigRepository: any;

  beforeEach(() => {
    mockTagDomainService = {
      createTag: vi.fn(),
      getTag: vi.fn(),
      updateTag: vi.fn(),
      updateTagStatus: vi.fn(),
      deleteTag: vi.fn(),
      createTagVersion: vi.fn(),
      setCurrentVersion: vi.fn(),
    } as unknown as MockTagDomainService;

    mockCHClient = {
      testConnection: vi.fn(),
      query: vi.fn(),
      execute: vi.fn(),
      createMaterializedView: vi.fn(),
      dropMaterializedView: vi.fn(),
      dropTable: vi.fn(),
      stopView: vi.fn(),
      startView: vi.fn(),
      getRefreshStatus: vi.fn(),
      checkTableExists: vi.fn(),
      resetBitmapBit: vi.fn(),
    } as unknown as MockCHClient;

    mockMvConfigRepository = {
      findByTagIdAndVersionId: vi.fn(),
    };

    service = new TagValueQueryApplicationServiceImpl(
      mockTagDomainService as unknown as TagDomainService,
      mockCHClient as unknown as IClickHouseClientAdapter,
      mockMvConfigRepository,
      { findByTableName: vi.fn().mockResolvedValue(null) } as any
    );
  });

  it('should get tag values for valid input', async () => {
    const tag = new Tag(
      'tag-1',
      '测试标签',
      TagValueType.BOOLEAN,
      TagStatus.ACTIVE,
      UpdateCycle.REALTIME,
      'owner-1',
      'cat-1',
      new Date(),
      'creator-1'
    );
    const v1 = new TagVersion('v1', 'tag-1', 'owner-1', new Date(), 'creator-1', 1);
    tag.currentVersionId = 'v1';
    tag.versions = [v1];
    tag.currentVersion = v1;
    (mockTagDomainService.getTag as Mock).mockResolvedValue(tag);
    (mockMvConfigRepository.findByTagIdAndVersionId as Mock).mockResolvedValue([
      { mvResultTable: 'mv_result_table_1', stepOrder: 1 },
    ]);

    const rows = [
      { entity_id: 'e1', value: true },
      { entity_id: 'e2', value: false },
    ];
    (mockCHClient.query as Mock).mockResolvedValue(rows as any);

    const cmd = new GetTagValuesCommand('tag-1', ['e1', 'e2'], 'v1');
    const result = await service.getTagValues(cmd);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(new TagValueResult('e1', true));
    expect(result[1]).toEqual(new TagValueResult('e2', false));
    const sql = (mockCHClient.query as Mock).mock.calls[0][0] as string;
    expect(sql).toContain('mv_result_table_1');
    expect(sql).toContain("'e1'");
  });

  it('should handle empty entityIds', async () => {
    const tag = new Tag(
      'tag-2',
      '测试标签 2',
      TagValueType.STRING,
      TagStatus.ACTIVE,
      UpdateCycle.HOURLY,
      'owner-2',
      'cat-2',
      new Date(),
      'creator-2'
    );
    const v1 = new TagVersion('v1', 'tag-2', 'owner-2', new Date(), 'creator-2', 1);
    tag.currentVersionId = 'v1';
    tag.versions = [v1];
    tag.currentVersion = v1;
    (mockTagDomainService.getTag as Mock).mockResolvedValue(tag);
    (mockMvConfigRepository.findByTagIdAndVersionId as Mock).mockResolvedValue([
      { mvResultTable: 'mv_result_table_2', stepOrder: 1 },
    ]);
    (mockCHClient.query as Mock).mockResolvedValue([]);

    const cmd = new GetTagValuesCommand('tag-2', [], 'v1');
    const result = await service.getTagValues(cmd);
    expect(result).toEqual([]);
  });

  it('should throw error when tag not exists', async () => {
    (mockTagDomainService.getTag as Mock).mockResolvedValue(null);
    const cmd = new GetTagValuesCommand('unknown-tag', ['e1'], 'v1');
    await expect(service.getTagValues(cmd)).rejects.toThrowError(/标签不存在/);
  });

  it('should throw error when version not exists', async () => {
    const tag = new Tag('tag-3', '测试标签 3', TagValueType.STRING, TagStatus.ACTIVE, UpdateCycle.DAILY, 'owner-3', 'cat-3', new Date(), 'creator-3');
    tag.currentVersionId = 'v1';
    tag.versions = [new TagVersion('v2', 'tag-3', 'owner-3', new Date(), 'creator-3', 2)];
    (mockTagDomainService.getTag as Mock).mockResolvedValue(tag);
    (mockMvConfigRepository.findByTagIdAndVersionId as Mock).mockResolvedValue([]);
    const cmd = new GetTagValuesCommand('tag-3', ['e1'], 'v99');
    await expect(service.getTagValues(cmd)).rejects.toThrowError(/没有 MV 配置/);
  });
});
