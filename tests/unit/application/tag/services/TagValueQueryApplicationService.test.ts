import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TagValueQueryApplicationServiceImpl } from '@/modules/tag/services/TagValueQueryApplicationServiceImpl';
import {
  GetTagValuesCommand,
  GetTagValueCommand,
  GetTagValuesPaginatedCommand,
  TagValueResult,
  PaginatedTagValues,
} from '@/modules/tag/services/TagValueQueryApplicationService';

describe('TagValueQueryApplicationService', () => {
  let service: TagValueQueryApplicationServiceImpl;
  let mockTagDomainService: any;
  let mockChClient: any;
  let mockMvConfigRepository: any;

  beforeEach(() => {
    mockTagDomainService = { getTag: vi.fn() };
    mockChClient = { query: vi.fn() };
    mockMvConfigRepository = { findByTagIdAndVersionId: vi.fn().mockResolvedValue([]) };
    service = new TagValueQueryApplicationServiceImpl(mockTagDomainService, mockChClient, mockMvConfigRepository, {
      findByTableName: vi.fn().mockResolvedValue(null),
    } as any);
  });

  describe('getTagValues (batch)', () => {
    beforeEach(() => {
      (mockMvConfigRepository.findByTagIdAndVersionId as any).mockResolvedValue([
        { mvResultTable: 'test_mv_table', stepOrder: 1 },
      ]);
    });

    it('returns values for multiple entities and honors versionId', async () => {
      mockTagDomainService.getTag.mockResolvedValue({
        id: 'tag-1',
        currentVersionId: 'ver-1',
        versions: [{ id: 'ver-1', version: 1 }],
      });
      mockChClient.query.mockResolvedValue([
        { entity_id: 'e1', value: 10 },
        { entity_id: 'e2', value: 'abc' },
      ]);
      const cmd = new GetTagValuesCommand('tag-1', ['e1', 'e2'], 'ver-1');
      const res = await service.getTagValues(cmd);
      expect(res).toHaveLength(2);
      expect(res[0].entityId).toBe('e1');
      expect(res[0].value).toBe(10);
      expect(res[1].entityId).toBe('e2');
      expect(res[1].value).toBe('abc');
    });

    it('returns empty array when no matches', async () => {
      mockTagDomainService.getTag.mockResolvedValue({ id: 'tag-1', currentVersionId: 'ver-1', versions: [{ id: 'ver-1', version: 1 }] });
      mockChClient.query.mockResolvedValue([]);
      const cmd = new GetTagValuesCommand('tag-1', ['not-found'], undefined);
      const res = await service.getTagValues(cmd);
      expect(res).toEqual([]);
    });

    it('propagates errors from the ClickHouse client', async () => {
      mockTagDomainService.getTag.mockResolvedValue({ id: 'tag-1', currentVersionId: 'ver-1', versions: [{ id: 'ver-1', version: 1 }] });
      mockChClient.query.mockRejectedValue(new Error('DB error'));
      const cmd = new GetTagValuesCommand('tag-1', ['e1'], undefined);
      await expect(service.getTagValues(cmd)).rejects.toThrow('DB error');
    });

    it('throws when too many entityIds are provided', async () => {
      const many = Array.from({ length: 1001 }, (_, i) => `id_${i}`);
      const cmd = new GetTagValuesCommand('tag-1', many, undefined);
      await expect(service.getTagValues(cmd)).rejects.toThrow(/entityIds 最多 1000 个/);
    });
  });

  describe('getTagValue (single)', () => {
    beforeEach(() => {
      (mockMvConfigRepository.findByTagIdAndVersionId as any).mockResolvedValue([
        { mvResultTable: 'test_mv_table', stepOrder: 1 },
      ]);
    });

    it('returns value for a single entity', async () => {
      mockTagDomainService.getTag.mockResolvedValue({ id: 'tag-1', currentVersionId: 'ver-1', versions: [{ id: 'ver-1', version: 1 }] });
      mockChClient.query.mockResolvedValue([{ entity_id: 'e1', value: 'val' }]);
      const cmd = new GetTagValueCommand('tag-1', 'e1', undefined);
      const res = await service.getTagValue(cmd);
      expect(res).toBeTruthy();
      expect(res!.entityId).toBe('e1');
      expect(res!.value).toBe('val');
    });

    it('returns null when not found', async () => {
      mockTagDomainService.getTag.mockResolvedValue({ id: 'tag-1', currentVersionId: 'ver-1', versions: [{ id: 'ver-1', version: 1 }] });
      mockChClient.query.mockResolvedValue([]);
      const cmd = new GetTagValueCommand('tag-1', 'not-found', undefined);
      const res = await service.getTagValue(cmd);
      expect(res).toBeNull();
    });
  });

  describe('getTagValuesPaginated', () => {
    beforeEach(() => {
      (mockMvConfigRepository.findByTagIdAndVersionId as any).mockResolvedValue([
        { mvResultTable: 'test_mv_table', stepOrder: 1 },
      ]);
    });

    it('returns paginated results with hasMore and nextCursor (cursor undefined)', async () => {
      mockTagDomainService.getTag.mockResolvedValue({ id: 'tag-1', currentVersionId: 'ver-1', versions: [{ id: 'ver-1', version: 1 }] });
      mockChClient.query.mockResolvedValue([
        { entity_id: 'a', value: 1 },
        { entity_id: 'b', value: 2 },
        { entity_id: 'c', value: 3 },
      ]);
      const cmd = new GetTagValuesPaginatedCommand('tag-1', undefined, 2);
      const paginated = await service.getTagValuesPaginated(cmd);
      expect(paginated.data).toHaveLength(2);
      expect(paginated.hasMore).toBe(true);
      expect(paginated.nextCursor).toBe('b');
    });

    it('supports cursor navigation and limit', async () => {
      mockTagDomainService.getTag.mockResolvedValue({ id: 'tag-1', currentVersionId: 'ver-1', versions: [{ id: 'ver-1', version: 1 }] });
      mockChClient.query.mockImplementation(async (sql: string) => {
        if (sql.includes("WHERE entity_id > 'a'")) {
          return [
            { entity_id: 'b', value: 20 },
            { entity_id: 'c', value: 30 },
            { entity_id: 'd', value: 40 },
          ];
        }
        return [
          { entity_id: 'a', value: 10 },
          { entity_id: 'b', value: 20 },
          { entity_id: 'c', value: 30 },
        ];
      });
      const cmd = new GetTagValuesPaginatedCommand('tag-1', 'a', 2);
      const paginated = await service.getTagValuesPaginated(cmd);
      expect(paginated.data).toHaveLength(2);
      expect(paginated.hasMore).toBe(true);
      expect(paginated.nextCursor).toBe('c');
    });

    it('handles no more results (hasMore false)', async () => {
      mockTagDomainService.getTag.mockResolvedValue({ id: 'tag-1', currentVersionId: 'ver-1', versions: [{ id: 'ver-1', version: 1 }] });
      mockChClient.query.mockResolvedValue([
        { entity_id: 'x', value: 'x' },
        { entity_id: 'y', value: 'y' },
      ]);
      const cmd = new GetTagValuesPaginatedCommand('tag-1', undefined, 2);
      const paginated = await service.getTagValuesPaginated(cmd);
      expect(paginated.data).toHaveLength(2);
      expect(paginated.hasMore).toBe(false);
      expect(paginated.nextCursor).toBe('y');
    });
  });
});
