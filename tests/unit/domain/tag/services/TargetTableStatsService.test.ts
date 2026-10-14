import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createTargetTableStatsService } from '@/modules/tag/domain/services/TargetTableStatsService';
import { TargetTable, TargetTableStatus } from '@/modules/tag/domain/entities/TargetTable';

// Helper: build a sample TargetTable using domain model
function makeTestTable(id: string, tableName: string, status: TargetTableStatus = TargetTableStatus.CREATED): TargetTable {
  return TargetTable.fromData({
    id,
    tableName,
    entityType: 'tag',
    entityTypeId: 'et1',
    ownedBy: 'owner',
    createTableSql: 'CREATE TABLE sample (id INT)',
    tableType: 'DEFAULT',
    status: status,
    createTime: new Date('2026-01-01T00:00:00Z'),
  });
}

describe('TargetTableStatsService', () => {
  let mockClickHouse: any;
  let mockRepo: any;
  let service: any;

  beforeEach(() => {
    mockClickHouse = {
      query: vi.fn(),
    };

    mockRepo = {
      findById: vi.fn(),
      updateStats: vi.fn(),
    };

    service = createTargetTableStatsService(mockClickHouse, mockRepo);
  });

  it('should compute stats and update repository when data is valid', async () => {
    const table = makeTestTable('tbl1', 'my_table', TargetTableStatus.CREATED);
    // Mock repository to return the table
    mockRepo.findById.mockResolvedValue(table);

    // Mock ClickHouse responses: first count, then last modification time
    mockClickHouse.query
      .mockResolvedValueOnce([{ count: 123 }])
      .mockResolvedValueOnce([{ modification_time: '2026-01-01T12:34:56Z' }]);

    const result = await service.syncStats('tbl1');

    expect(result).toEqual({ rowCount: 123, lastModificationTime: new Date('2026-01-01T12:34:56Z') });
    expect(mockRepo.updateStats).toHaveBeenCalledWith('tbl1', 123, new Date('2026-01-01T12:34:56Z'));
  });

  it('should return null when table not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await service.syncStats('unknown');
    expect(result).toBeNull();
    expect(mockRepo.updateStats).not.toHaveBeenCalled();
    expect(mockClickHouse.query).not.toHaveBeenCalled();
  });

  it('should handle empty stats (rowCount 0 and no last modification time)', async () => {
    const table = makeTestTable('tbl2', 'empty_table', TargetTableStatus.CREATED);
    mockRepo.findById.mockResolvedValue(table);
    // first query returns 0, second returns empty -> undefined lastModificationTime
    mockClickHouse.query
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([]);

    const result = await service.syncStats('tbl2');
    expect(result).toEqual({ rowCount: 0, lastModificationTime: undefined });
    expect(mockRepo.updateStats).toHaveBeenCalledWith('tbl2', 0, undefined);
  });

  it('should return null and not update on ClickHouse error', async () => {
    const table = makeTestTable('tbl3', 'err_table', TargetTableStatus.CREATED);
    mockRepo.findById.mockResolvedValue(table);
    // Simulate a failure in ClickHouse query
    mockClickHouse.query.mockRejectedValue(new Error('DB error'));

    const result = await service.syncStats('tbl3');
    expect(result).toBeNull();
    expect(mockRepo.updateStats).not.toHaveBeenCalled();
  });

  it('should not attempt sync when table is DRAFT', async () => {
    const draftTable = makeTestTable('tbl4', 'draft_table', TargetTableStatus.DRAFT);
    mockRepo.findById.mockResolvedValue(draftTable);
    const result = await service.syncStats('tbl4');
    expect(result).toBeNull();
    expect(mockRepo.updateStats).not.toHaveBeenCalled();
  });
});
