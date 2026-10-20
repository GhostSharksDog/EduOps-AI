import {useCompanyUnitFixture} from '@/tests/helpers/company-unit-fixture';
const companyId=useCompanyUnitFixture();
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
// 测试 TargetTable 应用层实现
import { TargetTableApplicationServiceImpl } from '@/modules/tag/services/target-table/TargetTableApplicationServiceImpl';
import { ITargetTableRepository } from '@/modules/tag/domain/ports/ITargetTableRepository';
import { ITargetTableOHSAdapter } from '@/modules/tag/services/target-table/ITargetTableOHSAdapter';
import { IClickHouseClientAdapter } from '@/platform/database/interface/IClickHouseClientAdapter';
import { TargetTableData } from '@/modules/tag/domain/ports/ITargetTableRepository';
import { TargetTableStatus } from '@/modules/tag/domain/entities/TargetTable';
import { TargetTableQueryDTO } from '@/shared/schemas/request/target-table/targetTableQuerySchema';
import { TagRepository } from '@/modules/tag/domain/ports/TagRepository';

type MockTargetTableRepository = { [K in keyof ITargetTableRepository]: Mock };
type MockTargetTableOHSAdapter = { [K in keyof ITargetTableOHSAdapter]: Mock };
type MockTagRepository = { [K in keyof TagRepository]: Mock };

describe('TargetTableApplicationServiceImpl', () => {
  let service: TargetTableApplicationServiceImpl;
  let mockRepository: MockTargetTableRepository;
  let mockOHSAdapter: MockTargetTableOHSAdapter;
  let mockCHClient: Mock;
  let mockTagRepository: MockTagRepository;

  beforeEach(() => {
    mockRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByTableName: vi.fn(),
      findByTagId: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateStatus: vi.fn(),
      linkTag: vi.fn(),
      updateStats: vi.fn(),
    } as unknown as MockTargetTableRepository;

    mockOHSAdapter = {
      fromEntityToVO: vi.fn(),
    } as unknown as MockTargetTableOHSAdapter;

    mockCHClient = {} as Mock;

    mockTagRepository = {
      findById: vi.fn(),
      findByName: vi.fn(),
    } as unknown as MockTagRepository;

    service = new TargetTableApplicationServiceImpl(
      mockRepository as unknown as ITargetTableRepository,
      mockOHSAdapter as unknown as ITargetTableOHSAdapter,
      mockCHClient as unknown as IClickHouseClientAdapter,
      mockTagRepository as unknown as TagRepository
    );
  });

  it('should list target tables and map to VO', async () => {
    const data1: TargetTableData = {
      id: 'tt-1',
      tableName: 'tbl_one',
      entityType: 'USER',
      entityTypeId: 'et-1',
      ownedBy: 'owner-1',
      createTableSql: 'CREATE TABLE tbl_one (...)',
      tableType: null,
      tagId: null,
      tagVersionId: null,
      status: TargetTableStatus.DRAFT,
      errorMessage: null,
      activatedAt: null,
      deactivatedAt: null,
      rowCount: undefined,
      lastRefreshTime: null,
      createTime: new Date(),
      updateTime: undefined,
    } as any;

    const data2: TargetTableData = {
      id: 'tt-2',
      tableName: 'tbl_two',
      entityType: 'USER',
      entityTypeId: 'et-2',
      ownedBy: 'owner-2',
      createTableSql: 'CREATE TABLE tbl_two (...)',
      tableType: null,
      tagId: null,
      tagVersionId: null,
      status: TargetTableStatus.DRAFT,
      errorMessage: null,
      activatedAt: null,
      deactivatedAt: null,
      rowCount: undefined,
      lastRefreshTime: null,
      createTime: new Date(),
      updateTime: undefined,
    } as any;

    (mockRepository.findAll as Mock).mockResolvedValue([data1, data2]);
    (mockOHSAdapter.fromEntityToVO as Mock).mockImplementation((data: any) => ({ id: data.id, tableName: data.tableName }));

    // @ts-ignore
    const result = await service.listTargetTables({} as TargetTableQueryDTO);

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({ id: 'tt-1', tableName: 'tbl_one' });
  });

  it('should return null when target table not found', async () => {
    (mockRepository.findById as Mock).mockResolvedValue(null);
    const res = await service.getTargetTableById('not-found');
    expect(res).toBeNull();
  });

    it('should create target table successfully', async () => {
      const dto: any = {
        tableName: 'new_table',
        entityType: 'USER',
        entityTypeId: 'et-3',
        createTableSql: 'SQL',
        tableType: 'PHYSICAL_TABLE',
        ownedBy: 'owner-1',
        tagId: '33333333-3333-4333-a333-333333333333',
      };

      (mockRepository.findByTableName as Mock).mockResolvedValue(null);
      (mockTagRepository.findById as Mock).mockResolvedValue({
        id: '33333333-3333-4333-a333-333333333333',
        isDeleted: false,
      });
      const createdData: any = { id: 'tt-new', ...dto, status: TargetTableStatus.DRAFT, createTime: new Date() };
      (mockRepository.create as Mock).mockResolvedValue(createdData);
      (mockOHSAdapter.fromEntityToVO as Mock).mockReturnValue({ id: 'tt-new' } as any);

      const result = await service.createTargetTable(dto, 'tenant-1', 'user-1');
      expect(mockRepository.findByTableName).toHaveBeenCalledWith(dto.tableName);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

  it('should throw when creating with existing table name', async () => {
    const dto: any = {
      tableName: 'existing_table',
      entityType: 'USER',
      entityTypeId: 'et-4',
      createTableSql: 'SQL',
      tableType: 'PHYSICAL_TABLE',
      ownedBy: 'owner-1'
    };
    (mockRepository.findByTableName as Mock).mockResolvedValue({} as any);
    await expect(service.createTargetTable(dto)).rejects.toBeInstanceOf(Error);
  });

  describe('linkTag', () => {
    const existingData: TargetTableData = {
      id: 'tt-1',
      tableName: 'test_table',
      entityType: 'USER',
      entityTypeId: 'et-1',
      ownedBy: 'owner-1',
      createTableSql: 'CREATE TABLE test_table (...)',
      tableType: 'PHYSICAL_TABLE',
      tagId: null,
      tagVersionId: null,
      status: TargetTableStatus.CREATED,
      errorMessage: null,
      activatedAt: null,
      deactivatedAt: null,
      rowCount: undefined,
      lastRefreshTime: null,
      createTime: new Date(),
      updateTime: undefined,
    } as any;

    it('should throw NotFoundException when tag does not exist', async () => {
      (mockRepository.findById as Mock).mockResolvedValue(existingData);
      (mockTagRepository.findById as Mock).mockResolvedValue(null);

      await expect(
        service.linkTag('tt-1', 'nonexistent-tag', 'nonexistent-version')
      ).rejects.toThrow();
    });

    it('should throw BusinessException when tag is deleted', async () => {
      (mockRepository.findById as Mock).mockResolvedValue(existingData);
      (mockTagRepository.findById as Mock).mockResolvedValue({
        id: 'tag-1',
        isDeleted: true,
      });

      await expect(
        service.linkTag('tt-1', 'tag-1', 'version-1')
      ).rejects.toThrow();
    });

    it('should successfully link tag when tag exists and is not deleted', async () => {
      (mockRepository.findById as Mock).mockResolvedValue(existingData);
      (mockTagRepository.findById as Mock).mockResolvedValue({
        id: 'tag-1',
        isDeleted: false,
      });
      (mockRepository.update as Mock).mockResolvedValue({
        ...existingData,
        tagId: 'tag-1',
        tagVersionId: 'version-1',
      });

      const result = await service.linkTag('tt-1', 'tag-1', 'version-1');

      expect(mockRepository.update).toHaveBeenCalled();
    });
  });
});
