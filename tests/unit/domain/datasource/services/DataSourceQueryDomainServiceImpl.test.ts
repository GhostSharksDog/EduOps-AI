import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { DataSourceQueryDomainServiceImpl } from '@/modules/data/domain/datasource/services/DataSourceQueryDomainServiceImpl';
import { DataSourceRepository } from '@/modules/data/domain/ports/DataSourceRepository';
import { DataSource } from '@/modules/data/domain/datasource/entities/DataSource';
import { DataSourceStatus, DataSourceType } from '@/shared/enums/datasource/index';
import { ListDataSourcesQuery, SearchDataSourcesQuery } from '@/modules/data/contracts/datasource/queries/index';
import { TEST_USER_ID } from '../../../../helpers/constants';

describe('DataSourceQueryDomainServiceImpl', () => {
  let service: DataSourceQueryDomainServiceImpl;
  let mockRepository: DataSourceRepository;

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn() as Mock,
      findByName: vi.fn() as Mock,
      findAll: vi.fn() as Mock,
      save: vi.fn() as Mock,
      count: vi.fn() as Mock,
      delete: vi.fn() as Mock
    };

    service = new DataSourceQueryDomainServiceImpl(mockRepository);
  });

  function createMockDataSource(overrides?: Partial<DataSource>): DataSource {
    return new DataSource(
      overrides?.id || 'ds-001',
      overrides?.name || 'Test DataSource',
      overrides?.ownedBy || TEST_USER_ID,
      overrides?.createTime || new Date(),
      overrides?.createdBy || TEST_USER_ID,
      overrides?.description,
      overrides?.type || DataSourceType.CLICKHOUSE,
      overrides?.host || 'localhost',
      overrides?.port || 8123,
      overrides?.databaseName || 'test_db',
      overrides?.username || 'admin',
      overrides?.password || 'password',
      overrides?.status || DataSourceStatus.ACTIVE
    );
  }

  describe('findById', () => {
    it('should return data source when found', async () => {
      const mockDataSource = createMockDataSource();
      (mockRepository.findById as Mock).mockResolvedValue(mockDataSource);

      const result = await service.findById('ds-001');

      expect(mockRepository.findById).toHaveBeenCalledWith('ds-001', undefined);
      expect(result).toBe(mockDataSource);
    });

    it('should return null when not found', async () => {
      (mockRepository.findById as Mock).mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(mockRepository.findById).toHaveBeenCalledWith('nonexistent', undefined);
      expect(result).toBeNull();
    });
  });

  describe('findByName', () => {
    it('should return data source when found', async () => {
      const mockDataSource = createMockDataSource({ name: 'Test DS' });
      (mockRepository.findByName as Mock).mockResolvedValue(mockDataSource);

      const result = await service.findByName('Test DS');

      expect(mockRepository.findByName).toHaveBeenCalledWith('Test DS');
      expect(result).toBe(mockDataSource);
    });

    it('should return null when not found', async () => {
      (mockRepository.findByName as Mock).mockResolvedValue(null);

      const result = await service.findByName('Nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all data sources without filter', async () => {
      const mockDataSources = [
        createMockDataSource({ id: 'ds-001', name: 'DS1' }),
        createMockDataSource({ id: 'ds-002', name: 'DS2' })
      ];

      (mockRepository.findAll as Mock).mockResolvedValue(mockDataSources);

      const result = await service.findAll();

      expect(mockRepository.findAll).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockDataSources);
    });

    it('should filter data sources by criteria', async () => {
      const mockDataSources = [
        createMockDataSource({ id: 'ds-001', type: DataSourceType.CLICKHOUSE })
      ];

      (mockRepository.findAll as Mock).mockResolvedValue(mockDataSources);

      const filter = { type: DataSourceType.CLICKHOUSE };
      const result = await service.findAll(filter);

      expect(mockRepository.findAll).toHaveBeenCalledWith(filter);
      expect(result).toEqual(mockDataSources);
    });
  });

  describe('listDataSources', () => {
    it('should return paginated list', async () => {
      const mockDataSources = [
        createMockDataSource({ id: 'ds-001' }),
        createMockDataSource({ id: 'ds-002' })
      ];

      (mockRepository.findAll as Mock).mockResolvedValue(mockDataSources);
      (mockRepository.count as Mock).mockResolvedValue(25);

      const query: ListDataSourcesQuery = {
        page: 2,
        pageSize: 10
      };

      const result = await service.listDataSources(query);

      expect(result.items).toEqual(mockDataSources);
      expect(result.totalCount).toBe(25);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(3);
    });

    it('should apply type and status filters', async () => {
      const mockDataSources = [createMockDataSource({ type: DataSourceType.CLICKHOUSE, status: DataSourceStatus.ACTIVE })];
      (mockRepository.findAll as Mock).mockResolvedValue(mockDataSources);
      (mockRepository.count as Mock).mockResolvedValue(1);

      const query: ListDataSourcesQuery = {
        type: DataSourceType.CLICKHOUSE,
        status: DataSourceStatus.ACTIVE
      };

      await service.listDataSources(query);

      expect(mockRepository.findAll).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        type: DataSourceType.CLICKHOUSE,
        status: DataSourceStatus.ACTIVE
      });
    });

    it('should use default pagination values', async () => {
      (mockRepository.findAll as Mock).mockResolvedValue([]);
      (mockRepository.count as Mock).mockResolvedValue(0);

      const query: ListDataSourcesQuery = {};
      const result = await service.listDataSources(query);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });
  });

  describe('searchDataSources', () => {
    it('should search with ownedBy filter', async () => {
      const mockDataSources = [createMockDataSource({ ownedBy: TEST_USER_ID })];
      (mockRepository.findAll as Mock).mockResolvedValue(mockDataSources);
      (mockRepository.count as Mock).mockResolvedValue(1);

      const query: SearchDataSourcesQuery = {
        ownedBy: TEST_USER_ID,
        page: 1,
        pageSize: 20
      };

      const result = await service.searchDataSources(query);

      expect(mockRepository.findAll).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        ownedBy: TEST_USER_ID
      });
      expect(result.items).toEqual(mockDataSources);
      expect(result.pageSize).toBe(20);
    });

    it('should apply multiple filters', async () => {
      (mockRepository.findAll as Mock).mockResolvedValue([]);
      (mockRepository.count as Mock).mockResolvedValue(0);

      const query: SearchDataSourcesQuery = {
        type: DataSourceType.CLICKHOUSE,
        status: DataSourceStatus.ACTIVE,
        ownedBy: TEST_USER_ID
      };

      await service.searchDataSources(query);

      expect(mockRepository.findAll).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        type: DataSourceType.CLICKHOUSE,
        status: DataSourceStatus.ACTIVE,
        ownedBy: TEST_USER_ID
      });
    });
  });

  describe('countByCriteria', () => {
    it('should count data sources matching criteria', async () => {
      (mockRepository.count as Mock).mockResolvedValue(42);

      const filter = { type: 'CLICKHOUSE', status: DataSourceStatus.ACTIVE };
      const result = await service.countByCriteria(filter);

      expect(mockRepository.count).toHaveBeenCalledWith(filter);
      expect(result).toBe(42);
    });

    it('should return 0 when no matches', async () => {
      (mockRepository.count as Mock).mockResolvedValue(0);

      const result = await service.countByCriteria({ type: 'NONEXISTENT' });

      expect(result).toBe(0);
    });
  });
});
