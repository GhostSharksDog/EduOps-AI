import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { BitmapManagementDomainServiceImpl } from '@/modules/tag/domain/services/BitmapManagementDomainServiceImpl';
import { IBitmapTableRepository, BitmapTableData } from '@/modules/tag/domain/ports/IBitmapTableRepository';
import { IClickHouseClientAdapter } from '@/platform/database/interface/IClickHouseClientAdapter';
import { MockFactory } from '../../../../helpers/mock-factory';

describe('BitmapManagementDomainService', () => {
  let service: BitmapManagementDomainServiceImpl;
  let mockBitmapRepo: IBitmapTableRepository;
  let mockChClient: IClickHouseClientAdapter;

  const mockEntityTypeId = 'entity-type-123';
  const mockEntityType = 'user';
  const mockTenantId = 'tenant-1';

  const createMockBitmapTable = (overrides?: Partial<BitmapTableData>): BitmapTableData => {
    return MockFactory.createBitmapTableData({
      entityTypeId: mockEntityTypeId,
      entityType: mockEntityType,
      ownedBy: mockTenantId,
      sequence: 1,
      totalBits: 64,
      usedBits: [],
      status: 'ACTIVE',
      ...overrides,
    });
  };

  beforeEach(() => {
    mockBitmapRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByEntityTypeId: vi.fn(),
      findActiveByEntityTypeId: vi.fn(),
      findAll: vi.fn(),
      findByEntityType: vi.fn(),
      findActiveByEntityType: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      allocateBitAtomically: vi.fn(),
      releaseBitAtomically: vi.fn(),
      assignBitAt: vi.fn(),
      releaseBitAt: vi.fn(),
    };

    mockChClient = {
      query: vi.fn(),
      execute: vi.fn(),
      createTable: vi.fn(),
      resetBitmapBit: vi.fn(),
    } as unknown as IClickHouseClientAdapter;

    service = new BitmapManagementDomainServiceImpl(mockBitmapRepo, mockChClient);
  });

  describe('allocateBit', () => {
    it('should create new bitmap table when none exists', async () => {
      (mockBitmapRepo.findActiveByEntityTypeId as Mock).mockResolvedValue(null);
      (mockBitmapRepo.create as Mock).mockImplementation(async (data) => data);
      (mockBitmapRepo.findByEntityTypeId as Mock).mockResolvedValue([]);
      (mockBitmapRepo.update as Mock).mockResolvedValue(undefined);
      (mockChClient.execute as Mock).mockResolvedValue(undefined);

      const result = await service.allocateBit(mockEntityTypeId, mockEntityType, mockTenantId);

      expect(result.bitPosition).toBe(0);
      expect(result.bitmapTableId).toBeDefined();
      expect(result.bitmapTableName).toContain('tag_bitmap_');

      expect(mockBitmapRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityTypeId: mockEntityTypeId,
          entityType: mockEntityType,
          totalBits: 64,
          usedBits: [],
          status: 'ACTIVE',
          sequence: 1,
          ownedBy: mockTenantId,
        })
      );

      expect(mockChClient.createTable).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS')
      );
    });

    it('should allocate from existing table', async () => {
      const existingTable = createMockBitmapTable({
        id: 'bitmap-existing',
        usedBits: [0, 1],
      });
      (mockBitmapRepo.findActiveByEntityTypeId as Mock).mockResolvedValue(existingTable);
      (mockBitmapRepo.findByEntityTypeId as Mock).mockResolvedValue([existingTable]);
      (mockBitmapRepo.update as Mock).mockImplementation(async (data) => data);

      const result = await service.allocateBit(mockEntityTypeId, mockEntityType, mockTenantId);

      expect(result.bitPosition).toBe(2);
      expect(result.bitmapTableId).toBe('bitmap-existing');

      expect(mockBitmapRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'bitmap-existing',
          usedBits: expect.arrayContaining([0, 1, 2]),
        })
      );

      expect(mockBitmapRepo.create).not.toHaveBeenCalled();
    });

    it('should throw error when table is full', async () => {
      const fullTable = createMockBitmapTable({
        id: 'bitmap-full',
        usedBits: Array.from({ length: 64 }, (_, i) => i),
      });
      (mockBitmapRepo.findActiveByEntityTypeId as Mock).mockResolvedValue(fullTable);

      await expect(service.allocateBit(mockEntityTypeId, mockEntityType, mockTenantId)).rejects.toThrow('已无可用位');
    });

    it('should allocate smallest available bit', async () => {
      const sparseTable = createMockBitmapTable({
        id: 'bitmap-sparse',
        usedBits: [0, 1, 3],
      });
      (mockBitmapRepo.findActiveByEntityTypeId as Mock).mockResolvedValue(sparseTable);
      (mockBitmapRepo.findByEntityTypeId as Mock).mockResolvedValue([sparseTable]);
      (mockBitmapRepo.update as Mock).mockResolvedValue(undefined);

      const result = await service.allocateBit(mockEntityTypeId, mockEntityType, mockTenantId);

      expect(result.bitPosition).toBe(2);
      expect(mockBitmapRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          usedBits: expect.arrayContaining([0, 1, 2, 3]),
        })
      );
    });

    it('should allocate last bit (position 63)', async () => {
      const almostFullTable = createMockBitmapTable({
        id: 'bitmap-almost',
        usedBits: Array.from({ length: 63 }, (_, i) => i),
      });
      (mockBitmapRepo.findActiveByEntityTypeId as Mock).mockResolvedValue(almostFullTable);
      (mockBitmapRepo.findByEntityTypeId as Mock).mockResolvedValue([almostFullTable]);
      (mockBitmapRepo.update as Mock).mockResolvedValue(undefined);

      const result = await service.allocateBit(mockEntityTypeId, mockEntityType, mockTenantId);

      expect(result.bitPosition).toBe(63);
    });

    it('should persist usedBits after allocation', async () => {
      const table = createMockBitmapTable({
        id: 'bitmap-test',
        usedBits: [0],
      });
      (mockBitmapRepo.findActiveByEntityTypeId as Mock).mockResolvedValue(table);
      (mockBitmapRepo.findByEntityTypeId as Mock).mockResolvedValue([table]);
      (mockBitmapRepo.update as Mock).mockResolvedValue(undefined);

      await service.allocateBit(mockEntityTypeId, mockEntityType, mockTenantId);

      const updateCall = (mockBitmapRepo.update as Mock).mock.calls[0][0];
      expect(updateCall.usedBits).toContain(1);
      expect(updateCall.usedBits).toHaveLength(2);
    });

    it('should handle different entity types', async () => {
      (mockBitmapRepo.findActiveByEntityTypeId as Mock).mockResolvedValue(null);
      (mockBitmapRepo.create as Mock).mockImplementation(async (data) => data);
      (mockBitmapRepo.findByEntityTypeId as Mock).mockResolvedValue([]);
      (mockBitmapRepo.update as Mock).mockResolvedValue(undefined);
      (mockChClient.execute as Mock).mockResolvedValue(undefined);

      const result = await service.allocateBit('order-type-id', 'ORDER', mockTenantId);

      expect(result.bitmapTableName).toMatch(/^tag_bitmap_[a-z0-9]+_1_[a-z0-9]+_[a-z0-9]+$/);
    });

    it('should calculate correct sequence for multiple tables', async () => {
      const fullTable1 = createMockBitmapTable({
        id: 'table-1',
        sequence: 1,
        usedBits: Array.from({ length: 64 }, (_, i) => i),
        status: 'DEPLETED',
      });
      const fullTable2 = createMockBitmapTable({
        id: 'table-2',
        sequence: 2,
        usedBits: Array.from({ length: 64 }, (_, i) => i),
        status: 'DEPLETED',
      });

      (mockBitmapRepo.findActiveByEntityTypeId as Mock).mockResolvedValue(null);
      (mockBitmapRepo.create as Mock).mockImplementation(async (data) => ({
        ...data,
        id: 'new-table-3',
      }));
      (mockBitmapRepo.findByEntityTypeId as Mock).mockResolvedValue([fullTable1, fullTable2]);
      (mockBitmapRepo.update as Mock).mockResolvedValue(undefined);
      (mockChClient.execute as Mock).mockResolvedValue(undefined);

      const result = await service.allocateBit(mockEntityTypeId, mockEntityType, mockTenantId);

      expect(result.bitmapTableName).toMatch(/_3_[a-z0-9]+_[a-z0-9]+$/);
    });
  });

  describe('releaseBit', () => {
    it('should release bit and update database', async () => {
      const existingTable = createMockBitmapTable({
        id: 'bitmap-1', chTableName: 'tag_bitmap_user_1',
        usedBits: [0, 1, 2],
      });
      (mockBitmapRepo.findById as Mock).mockResolvedValue(existingTable);
      (mockBitmapRepo.update as Mock).mockResolvedValue(undefined);

      await service.releaseBit('bitmap-1', 1);

      expect(mockBitmapRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'bitmap-1', chTableName: 'tag_bitmap_user_1',
          usedBits: expect.arrayContaining([0, 2]),
        })
      );
      expect(mockBitmapRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          usedBits: expect.not.arrayContaining([1]),
        })
      );
    });

    it('should skip release when bit is not used', async () => {
      const existingTable = createMockBitmapTable({
        id: 'bitmap-1', chTableName: 'tag_bitmap_user_1',
        usedBits: [0, 2],
      });
      (mockBitmapRepo.findById as Mock).mockResolvedValue(existingTable);

      await service.releaseBit('bitmap-1', 1);

      expect(mockBitmapRepo.update).not.toHaveBeenCalled();
    });

    it('should throw error when bitmap table not found', async () => {
      (mockBitmapRepo.findById as Mock).mockResolvedValue(null);

      await expect(service.releaseBit('non-existent', 0)).rejects.toThrow(
        'Bitmap 表不存在'
      );
    });

    it('should release first bit', async () => {
      const table = createMockBitmapTable({
        id: 'bitmap-1', chTableName: 'tag_bitmap_user_1',
        usedBits: [0, 1, 2],
      });
      (mockBitmapRepo.findById as Mock).mockResolvedValue(table);
      (mockBitmapRepo.update as Mock).mockResolvedValue(undefined);

      await service.releaseBit('bitmap-1', 0);

      const updateCall = (mockBitmapRepo.update as Mock).mock.calls[0][0];
      expect(updateCall.usedBits).toEqual([1, 2]);
    });

    it('should release last bit', async () => {
      const table = createMockBitmapTable({
        id: 'bitmap-1', chTableName: 'tag_bitmap_user_1',
        usedBits: [0, 1, 63],
      });
      (mockBitmapRepo.findById as Mock).mockResolvedValue(table);
      (mockBitmapRepo.update as Mock).mockResolvedValue(undefined);

      await service.releaseBit('bitmap-1', 63);

      const updateCall = (mockBitmapRepo.update as Mock).mock.calls[0][0];
      expect(updateCall.usedBits).toEqual([0, 1]);
    });
  });

  describe('getOrCreateBitmapTable', () => {
    it('should return existing table when found', async () => {
      const existingTable = createMockBitmapTable({
        id: 'existing-id',
        usedBits: [0, 1],
      });
      (mockBitmapRepo.findActiveByEntityTypeId as Mock).mockResolvedValue(existingTable);

      const result = await service.getOrCreateBitmapTable(mockEntityTypeId, mockEntityType, mockTenantId);

      expect(result.id).toBe('existing-id');
      expect(mockBitmapRepo.create).not.toHaveBeenCalled();
    });

    it('should create new table when none exists', async () => {
      (mockBitmapRepo.findActiveByEntityTypeId as Mock).mockResolvedValue(null);
      (mockBitmapRepo.findByEntityTypeId as Mock).mockResolvedValue([]);
      (mockBitmapRepo.create as Mock).mockImplementation(async (data) => data);
      (mockChClient.execute as Mock).mockResolvedValue(undefined);

      const result = await service.getOrCreateBitmapTable(mockEntityTypeId, 'product', mockTenantId);

      expect(result.entityType).toBe('product');
      expect(result.totalBits).toBe(64);
      expect(result.usedBits).toEqual([]);
      expect(result.status).toBe('ACTIVE');
      expect(result.id).toBeDefined();
      expect(result.sequence).toBe(1);

      expect(mockBitmapRepo.create).toHaveBeenCalled();

      expect(mockChClient.createTable).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS')
      );
    });

    it('should create ClickHouse table with correct schema', async () => {
      (mockBitmapRepo.findActiveByEntityTypeId as Mock).mockResolvedValue(null);
      (mockBitmapRepo.findByEntityTypeId as Mock).mockResolvedValue([]);
      (mockBitmapRepo.create as Mock).mockImplementation(async (data) => data);
      (mockChClient.execute as Mock).mockResolvedValue(undefined);

      await service.getOrCreateBitmapTable(mockEntityTypeId, mockEntityType, mockTenantId);

      const sqlCalls = (mockChClient.createTable as Mock).mock.calls.map(call => call[0]);
      const createCall = sqlCalls.find(sql => sql.includes('CREATE TABLE IF NOT EXISTS'));
      expect(createCall).toBeDefined();
      expect(createCall).toContain('entity_id String');
      expect(createCall).toContain('bitmap_col SimpleAggregateFunction(groupBitOr, UInt64)');
      expect(createCall).toContain('MergeTree()');
      expect(createCall).toContain('ORDER BY entity_id');
    });
  });

  describe('getBitmapTable', () => {
    it('should return table when found', async () => {
      const table = createMockBitmapTable({
        id: 'bitmap-1', chTableName: 'tag_bitmap_user_1',
        usedBits: [0],
      });
      (mockBitmapRepo.findById as Mock).mockResolvedValue(table);

      const result = await service.getBitmapTable('bitmap-1');

      expect(result).toEqual(table);
    });

    it('should return null when not found', async () => {
      (mockBitmapRepo.findById as Mock).mockResolvedValue(null);

      const result = await service.getBitmapTable('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('resetBitmapBit', () => {
    it('should call ClickHouse reset with correct parameters', async () => {
      const table = createMockBitmapTable({
        id: 'bitmap-1', chTableName: 'tag_bitmap_user_1',
        usedBits: [0, 1, 5],
      });
      (mockBitmapRepo.findById as Mock).mockResolvedValue(table);
      (mockChClient.resetBitmapBit as Mock).mockResolvedValue(undefined);

      await service.resetBitmapBit('bitmap-1', 5);

      expect(mockChClient.resetBitmapBit).toHaveBeenCalledWith(
        expect.stringContaining('tag_bitmap_'),
        5
      );
    });

    it('should throw error when table not found', async () => {
      (mockBitmapRepo.findById as Mock).mockResolvedValue(null);

      await expect(service.resetBitmapBit('non-existent', 0)).rejects.toThrow(
        'Bitmap 表不存在'
      );
    });

    it('should use correct table sequence', async () => {
      const table2 = createMockBitmapTable({
        id: 'bitmap-2', chTableName: 'tag_bitmap_user_2',
        sequence: 2,
        usedBits: [3],
      });
      (mockBitmapRepo.findById as Mock).mockResolvedValue(table2);
      (mockChClient.resetBitmapBit as Mock).mockResolvedValue(undefined);

      await service.resetBitmapBit('bitmap-2', 3);

      expect(mockChClient.resetBitmapBit).toHaveBeenCalledWith(
        expect.stringMatching(/_2$/),
        3
      );
    });
  });

  describe('checkBitAvailable', () => {
    it('should return true for available bit', async () => {
      const table = createMockBitmapTable({
        id: 'bitmap-1', chTableName: 'tag_bitmap_user_1',
        usedBits: [0, 1],
      });
      (mockBitmapRepo.findById as Mock).mockResolvedValue(table);

      const result = await service.checkBitAvailable('bitmap-1', 5);

      expect(result).toBe(true);
    });

    it('should return false for used bit', async () => {
      const table = createMockBitmapTable({
        id: 'bitmap-1', chTableName: 'tag_bitmap_user_1',
        usedBits: [0, 1, 5],
      });
      (mockBitmapRepo.findById as Mock).mockResolvedValue(table);

      const result = await service.checkBitAvailable('bitmap-1', 5);

      expect(result).toBe(false);
    });

    it('should return false for invalid bit position', async () => {
      const table = createMockBitmapTable({
        id: 'bitmap-1', chTableName: 'tag_bitmap_user_1',
        usedBits: [],
      });
      (mockBitmapRepo.findById as Mock).mockResolvedValue(table);

      expect(await service.checkBitAvailable('bitmap-1', 100)).toBe(false);
      expect(await service.checkBitAvailable('bitmap-1', -1)).toBe(false);
    });

    it('should return false when table not found', async () => {
      (mockBitmapRepo.findById as Mock).mockResolvedValue(null);

      const result = await service.checkBitAvailable('non-existent', 0);

      expect(result).toBe(false);
    });

    it('should return true for first available bit', async () => {
      const table = createMockBitmapTable({
        id: 'bitmap-1', chTableName: 'tag_bitmap_user_1',
        usedBits: [],
      });
      (mockBitmapRepo.findById as Mock).mockResolvedValue(table);

      const result = await service.checkBitAvailable('bitmap-1', 0);

      expect(result).toBe(true);
    });

    it('should return true for last valid bit', async () => {
      const table = createMockBitmapTable({
        id: 'bitmap-1', chTableName: 'tag_bitmap_user_1',
        usedBits: [],
      });
      (mockBitmapRepo.findById as Mock).mockResolvedValue(table);

      const result = await service.checkBitAvailable('bitmap-1', 63);

      expect(result).toBe(true);
    });
  });

  describe('boundary conditions', () => {
    it('should handle concurrent allocation', async () => {
      let callCount = 0;
      const table = createMockBitmapTable({
        id: 'bitmap-1', chTableName: 'tag_bitmap_user_1',
        usedBits: [0],
      });
      (mockBitmapRepo.findActiveByEntityTypeId as Mock).mockImplementation(async () => {
        callCount++;
        return {
          ...table,
          usedBits: callCount === 1 ? [0] : [0, 1],
        };
      });
      (mockBitmapRepo.findByEntityTypeId as Mock).mockResolvedValue([table]);
      (mockBitmapRepo.update as Mock).mockResolvedValue(undefined);

      const result1 = await service.allocateBit(mockEntityTypeId, mockEntityType, mockTenantId);
      const result2 = await service.allocateBit(mockEntityTypeId, mockEntityType, mockTenantId);

      expect(result1.bitPosition).not.toBe(result2.bitPosition);
    });

    it('should handle table with custom totalBits', async () => {
      const smallTable = createMockBitmapTable({
        id: 'bitmap-small',
        totalBits: 16,
        usedBits: [],
      });
      (mockBitmapRepo.findActiveByEntityTypeId as Mock).mockResolvedValue(smallTable);
      (mockBitmapRepo.findByEntityTypeId as Mock).mockResolvedValue([smallTable]);
      (mockBitmapRepo.update as Mock).mockResolvedValue(undefined);

      const result = await service.allocateBit(mockEntityTypeId, mockEntityType, mockTenantId);

      expect(result.bitPosition).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle repository errors in allocateBit', async () => {
      (mockBitmapRepo.findActiveByEntityTypeId as Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.allocateBit(mockEntityTypeId, mockEntityType, mockTenantId)).rejects.toThrow('Database error');
    });

    it('should handle ClickHouse errors in getOrCreateBitmapTable', async () => {
      (mockBitmapRepo.findActiveByEntityTypeId as Mock).mockResolvedValue(null);
      (mockBitmapRepo.findByEntityTypeId as Mock).mockResolvedValue([]);
      (mockBitmapRepo.create as Mock).mockImplementation(async (data) => data);
      (mockChClient.createTable as Mock).mockRejectedValue(
        new Error('ClickHouse connection failed')
      );

      await expect(service.getOrCreateBitmapTable(mockEntityTypeId, mockEntityType, mockTenantId)).rejects.toThrow(
        'ClickHouse 表创建失败'
      );
    });

    it('should handle repository errors in releaseBit', async () => {
      (mockBitmapRepo.findById as Mock).mockRejectedValue(
        new Error('Database connection lost')
      );

      await expect(service.releaseBit('bitmap-1', 0)).rejects.toThrow(
        'Database connection lost'
      );
    });
  });
});
