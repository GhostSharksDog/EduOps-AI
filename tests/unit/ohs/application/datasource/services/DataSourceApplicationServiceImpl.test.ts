import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { DataSourceApplicationServiceImpl } from '@/modules/data/services/datasource/DataSourceApplicationServiceImpl';
import { DataSourceDomainService } from '@/modules/data/domain/datasource/services/ports/DataSourceDomainService';
import { DataSource } from '@/modules/data/domain/datasource/entities/DataSource';
import { DataSourceStatus } from '@/shared/enums/datasource/DataSourceStatus';
import { DataSourceType } from '@/shared/enums/datasource/DataSourceType';

describe('DataSourceApplicationServiceImpl', () => {
  let service: DataSourceApplicationServiceImpl;
  let mockDomainService: DataSourceDomainService;
  let mockQueryDomainService: any;
  let mockOHSAdapter: any;

  beforeEach(() => {
    mockDomainService = {
      createDataSource: vi.fn() as Mock,
      updateDataSource: vi.fn() as Mock,
      enableDataSource: vi.fn() as Mock,
      disableDataSource: vi.fn() as Mock,
      deleteDataSource: vi.fn() as Mock,
      testConnection: vi.fn() as Mock
    } as any;

    mockQueryDomainService = {
      findById: vi.fn() as Mock,
      findAll: vi.fn() as Mock,
      count: vi.fn() as Mock
    };

    mockOHSAdapter = {
      fromDataSourceToDataSourceVO: vi.fn() as Mock,
      fromDataSourceListToDataSourceVOList: vi.fn() as Mock
    };

    service = new DataSourceApplicationServiceImpl(mockDomainService, mockQueryDomainService, mockOHSAdapter);
  });

  describe('createDataSource', () => {
    it('should create data source', async () => {
      const dataSource = new DataSource('ds-001', 'Test DS', 'user-001', new Date(), 'user-001');
      const dataSourceVO = { id: 'ds-001', name: 'Test DS', status: DataSourceStatus.ACTIVE };

      (mockDomainService.createDataSource as Mock).mockResolvedValue(dataSource);
      (mockOHSAdapter.fromDataSourceToDataSourceVO as Mock).mockReturnValue(dataSourceVO);

      const result = await service.createDataSource({
        name: 'Test DS',
        type: DataSourceType.CLICKHOUSE,
        host: 'localhost',
        port: 8123,
        databaseName: 'test',
        username: 'test',
        password: 'test',
        status: DataSourceStatus.ACTIVE,
        ownedBy: 'user-001',
        createdBy: 'user-001'
      });

      expect(result.name).toBe('Test DS');
    });
  });

  describe('testConnection', () => {
    it('should test data source connection', async () => {
      const dataSource = new DataSource('ds-001', 'Test DS', 'user-001', new Date(), 'user-001');

      (mockQueryDomainService.findById as Mock).mockResolvedValue(dataSource);
      (mockDomainService.testConnection as Mock).mockResolvedValue({ success: true, message: 'Connected' });

      const result = await service.testConnection({ id: 'ds-001' });

      expect(result.success).toBe(true);
    });
  });
});
