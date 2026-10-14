// 测试 Bitmap 应用服务实现
import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { BitmapApplicationServiceImpl } from '@/modules/tag/services/bitmap/BitmapApplicationServiceImpl';
import { IBitmapManagementDomainService } from '@/modules/tag/domain/services/ports/IBitmapManagementDomainService';
import { IBitmapTableRepository } from '@/modules/tag/domain/ports/IBitmapTableRepository';
import { IBitmapOHSAdapter } from '@/modules/tag/services/bitmap/IBitmapOHSAdapter';
import { BitmapTableData } from '@/modules/tag/domain/ports/IBitmapTableRepository';

vi.mock('@/platform/database',()=>({queryRows:vi.fn(async()=>[]),queryOne:vi.fn(async()=>null),execute:vi.fn(async()=>0),transaction:vi.fn(async(work:(client:unknown)=>Promise<unknown>)=>work(undefined))}));

type MockBitmapDomainService = { [K in keyof IBitmapManagementDomainService]: Mock };
type MockBitmapRepository = { [K in keyof IBitmapTableRepository]: Mock };
type MockBitmapOHAdapter = { [K in keyof IBitmapOHSAdapter]: Mock };

describe('BitmapApplicationServiceImpl', () => {
  let service: BitmapApplicationServiceImpl;
  let mockDomainService: MockBitmapDomainService;
  let mockRepository: MockBitmapRepository;
  let mockOHAdapter: MockBitmapOHAdapter;

  beforeEach(() => {
    mockDomainService = {
      getOrCreateBitmapTable: vi.fn(),
      releaseBit: vi.fn(),
    } as unknown as MockBitmapDomainService;
    mockRepository = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findActiveByEntityTypeId: vi.fn(),
      findByEntityType: vi.fn(),
      findByEntityTypeId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      allocateBitAtomically: vi.fn(),
      releaseBitAtomically: vi.fn(),
      assignBitAt: vi.fn(),
      releaseBitAt: vi.fn(),
    } as unknown as MockBitmapRepository;
    mockOHAdapter = {
      fromEntityToVO: vi.fn(),
      fromEntityToDetailVO: vi.fn(),
      // other methods are not used in tests
    } as unknown as MockBitmapOHAdapter;

    const chClient: any = {};
    const mockTagStorageConfigRepository: any = {
      findByTagId: vi.fn(),
      findByBitmapIdAndBitPosition: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
    };
    service = new BitmapApplicationServiceImpl(
      mockDomainService as unknown as IBitmapManagementDomainService,
      mockRepository as unknown as IBitmapTableRepository,
      mockOHAdapter as unknown as IBitmapOHSAdapter,
      mockTagStorageConfigRepository
    );
  });

  it('should list bitmap tables and map to VO', async () => {
    const data1: BitmapTableData = {
      id: 'bt-1', entityType: 'user', entityTypeId: 'e1', ownedBy: 'u1', sequence: 1, totalBits: 64, usedBits: [], status: 'ACTIVE', createTime: new Date(), updateTime: undefined, deleteTime: null as any
    } as any;
    const data2: BitmapTableData = {
      id: 'bt-2', entityType: 'user', entityTypeId: 'e2', ownedBy: 'u2', sequence: 2, totalBits: 64, usedBits: [], status: 'ACTIVE', createTime: new Date(), updateTime: undefined, deleteTime: null as any
    } as any;
    (mockRepository.findAll as Mock).mockResolvedValue([data1, data2] as any);
    (mockOHAdapter.fromEntityToVO as Mock).mockImplementation((d: any) => ({ id: d.id, tableName: d.tableName ?? d.id } as any));

    const result = await service.listBitmapTables({} as any);
    expect(result.items).toBeTruthy();
  });

  it('should return detail VO for bitmap table', async () => {
    const data: BitmapTableData = {
      id: 'bt-1', entityType: 'user', entityTypeId: 'e1', ownedBy: 'u1', sequence: 1, totalBits: 0, usedBits: [], status: 'ACTIVE', createTime: new Date(), updateTime: undefined, deleteTime: null as any
    } as any;
    (mockRepository.findById as Mock).mockResolvedValue(data);
    (mockOHAdapter.fromEntityToDetailVO as Mock).mockReturnValue({ id: 'bt-1' } as any);

    const result = await service.getBitmapTableDetail('bt-1');
    expect(result).toBeDefined();
  });

  it('should throw when updating bitmap table status for non-existent table', async () => {
    (mockRepository.findById as Mock).mockResolvedValue(null);
    try {
      // @ts-ignore
      await service.updateBitmapTableStatus('non-existent', { status: 'ACTIVE' } as any);
      // should not reach here
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeTruthy();
    }
  });

  it('should allow deactivating bitmap table with no used bits', async () => {
    const tableData: BitmapTableData = {
      id: 'bt-1',
      entityType: 'user',
      entityTypeId: 'e1',
      ownedBy: 'u1',
      sequence: 1,
      totalBits: 64,
      usedBits: [],
      status: 'ACTIVE',
      createTime: new Date(),
      updateTime: undefined,
      deleteTime: null as any
    } as any;

    (mockRepository.findById as Mock).mockResolvedValue(tableData);
    (mockRepository.update as Mock).mockResolvedValue({ ...tableData, status: 'INACTIVE' });
    (mockOHAdapter.fromEntityToVO as Mock).mockReturnValue({ id: 'bt-1', status: 'INACTIVE' } as any);

    const result = await service.updateBitmapTableStatus('bt-1', { status: 'INACTIVE' });
    expect(result.status).toBe('INACTIVE');
  });

  it('should reject deactivating bitmap table with used bits', async () => {
    const tableData: BitmapTableData = {
      id: 'bt-1',
      entityType: 'user',
      entityTypeId: 'e1',
      ownedBy: 'u1',
      sequence: 1,
      totalBits: 64,
      usedBits: [0, 1, 2],
      status: 'ACTIVE',
      createTime: new Date(),
      updateTime: undefined,
      deleteTime: null as any
    } as any;

    (mockRepository.findById as Mock).mockResolvedValue(tableData);

    try {
      await service.updateBitmapTableStatus('bt-1', { status: 'INACTIVE' });
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.code).toBe('TAG_BITMAP_TABLE_HAS_USED_BITS');
      expect(error.details.usedBitCount).toBe(3);
      expect(error.details.bitmapTableId).toBe('bt-1');
    }
  });
});
