import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { DataSourceDomainServiceImpl } from '@/modules/data/domain/datasource/services/DataSourceDomainServiceImpl';
import { DataSourceRepository } from '@/modules/data/domain/ports/DataSourceRepository';
import { IDatasourceClientAdapter } from '@/platform/database/interface/IDatasourceClientAdapter';
import { DataSource } from '@/modules/data/domain/datasource/entities/DataSource';
import { DataSourceStatus, DataSourceType } from '@/shared/enums/datasource/index';
import { TestConnectionResult } from '@/shared/enums/datasource/index';
import { CreateDataSourceCommand, UpdateDataSourceCommand, DeleteDataSourceCommand, EnableDataSourceCommand, DisableDataSourceCommand } from '@/modules/data/contracts/datasource/commands/index';
import { MockFactory } from '../../../../helpers/mock-factory';
import { TEST_USER_ID } from '../../../../helpers/constants';
import {useCompanyUnitFixture} from '@/tests/helpers/company-unit-fixture';
useCompanyUnitFixture(TEST_USER_ID);

describe('DataSourceDomainServiceImpl', () => {
  let service: DataSourceDomainServiceImpl;
  let mockRepository: DataSourceRepository;
  let mockClientAdapter: IDatasourceClientAdapter;

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn() as Mock,
      findByName: vi.fn() as Mock,
      findAll: vi.fn() as Mock,
      save: vi.fn() as Mock,
      count: vi.fn() as Mock,
      delete: vi.fn() as Mock
    };

    mockClientAdapter = {
      testConnection: vi.fn() as Mock
    };

    service = new DataSourceDomainServiceImpl(mockRepository, mockClientAdapter);
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
      overrides?.status || DataSourceStatus.ACTIVE,
      overrides?.isDeleted || false
    );
  }

  describe('createDataSource', () => {
    it('should create data source when name is unique', async () => {
      const command: CreateDataSourceCommand = {
        name: 'New DataSource',
        ownedBy: TEST_USER_ID,
        createdBy: TEST_USER_ID,
        type: DataSourceType.CLICKHOUSE,
        host: 'localhost',
        port: 8123,
        databaseName: 'test_db',
        username: 'admin',
        password: 'password',
        status: DataSourceStatus.ACTIVE
      };

      const mockDataSource = createMockDataSource({ name: 'New DataSource' });
      
      (mockRepository.findByName as Mock).mockResolvedValue(null);
      (mockRepository.save as Mock).mockResolvedValue(mockDataSource);

      const result = await service.createDataSource(command);

      expect(mockRepository.findByName).toHaveBeenCalledWith('New DataSource', { tenantId: TEST_USER_ID });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toBe(mockDataSource);
    });

    it('should throw error when name already exists', async () => {
      const command: CreateDataSourceCommand = {
        name: 'Existing DataSource',
        ownedBy: TEST_USER_ID,
        type: DataSourceType.CLICKHOUSE,
        host: 'localhost',
        port: 8123,
        databaseName: 'test_db',
        username: 'admin',
        password: 'password',
        status: DataSourceStatus.ACTIVE,
        createdBy: TEST_USER_ID
      };

      const existingDataSource = createMockDataSource({ name: 'Existing DataSource' });
      (mockRepository.findByName as Mock).mockResolvedValue(existingDataSource);

      await expect(service.createDataSource(command)).rejects.toThrow();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should set createdBy to ownedBy if not provided', async () => {
      const command: CreateDataSourceCommand = {
        name: 'New DataSource',
        ownedBy: TEST_USER_ID,
        type: DataSourceType.CLICKHOUSE,
        host: 'localhost',
        port: 8123,
        databaseName: 'test_db',
        username: 'admin',
        password: 'password',
        status: DataSourceStatus.ACTIVE,
        createdBy: TEST_USER_ID
      };

      (mockRepository.findByName as Mock).mockResolvedValue(null);
      (mockRepository.save as Mock).mockResolvedValue(createMockDataSource());

      await service.createDataSource(command);

      const savedArg = (mockRepository.save as Mock).mock.calls[0][0];
      expect(savedArg.createdBy).toBe(TEST_USER_ID);
    });
  });

  describe('updateDataSource', () => {
    it('should update data source', async () => {
      const existingDataSource = createMockDataSource();
      (mockRepository.findById as Mock).mockResolvedValue(existingDataSource);
      (mockRepository.save as Mock).mockResolvedValue(existingDataSource);

      const command: UpdateDataSourceCommand = {
        id: 'ds-001',
        name: 'Updated DataSource',
        description: 'Updated description',
        host: 'newhost',
        port: 9999,
        updatedBy: 'user-002'
      };

      const result = await service.updateDataSource(command);

      expect(mockRepository.findById).toHaveBeenCalledWith('ds-001');
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.name).toBe('Updated DataSource');
      expect(result.description).toBe('Updated description');
      expect(result.host).toBe('newhost');
      expect(result.port).toBe(9999);
      expect(result.updatedBy).toBe('user-002');
      expect(result.updateTime).toBeDefined();
    });

    it('should throw error when data source not found', async () => {
      (mockRepository.findById as Mock).mockResolvedValue(null);

      const command: UpdateDataSourceCommand = {
        id: 'nonexistent',
        name: 'Updated',
        updatedBy: TEST_USER_ID
      };

      await expect(service.updateDataSource(command)).rejects.toThrow();
    });

    it('should convert port string to number', async () => {
      const existingDataSource = createMockDataSource();
      (mockRepository.findById as Mock).mockResolvedValue(existingDataSource);
      (mockRepository.save as Mock).mockResolvedValue(existingDataSource);

      const command: UpdateDataSourceCommand = {
        id: 'ds-001',
        port: '9000',
        updatedBy: TEST_USER_ID
      };

      await service.updateDataSource(command);

      const savedArg = (mockRepository.save as Mock).mock.calls[0][0];
      expect(savedArg.port).toBe(9000);
      expect(typeof savedArg.port).toBe('number');
    });
  });

  describe('enableDataSource', () => {
    it('should enable data source', async () => {
      const existingDataSource = createMockDataSource({ status: DataSourceStatus.DISABLED });
      (mockRepository.findById as Mock).mockResolvedValue(existingDataSource);
      (mockRepository.save as Mock).mockResolvedValue(existingDataSource);

      const command: EnableDataSourceCommand = {
        id: 'ds-001',
        updatedBy: 'user-002'
      };

      const result = await service.enableDataSource(command);

      expect(mockRepository.findById).toHaveBeenCalledWith('ds-001');
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.status).toBe(DataSourceStatus.ACTIVE);
      expect(result.updatedBy).toBe('user-002');
      expect(result.updateTime).toBeDefined();
    });

    it('should throw error when data source not found', async () => {
      (mockRepository.findById as Mock).mockResolvedValue(null);

      const command: EnableDataSourceCommand = {
        id: 'nonexistent',
        updatedBy: TEST_USER_ID
      };

      await expect(service.enableDataSource(command)).rejects.toThrow();
    });
  });

  describe('disableDataSource', () => {
    it('should disable data source', async () => {
      const existingDataSource = createMockDataSource({ status: DataSourceStatus.ACTIVE });
      (mockRepository.findById as Mock).mockResolvedValue(existingDataSource);
      (mockRepository.save as Mock).mockResolvedValue(existingDataSource);

      const command: DisableDataSourceCommand = {
        id: 'ds-001',
        updatedBy: 'user-002'
      };

      const result = await service.disableDataSource(command);

      expect(mockRepository.findById).toHaveBeenCalledWith('ds-001');
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.status).toBe(DataSourceStatus.DISABLED);
      expect(result.updatedBy).toBe('user-002');
    });
  });

  describe('deleteDataSource', () => {
    it('should soft delete data source', async () => {
      const existingDataSource = createMockDataSource();
      (mockRepository.findById as Mock).mockResolvedValue(existingDataSource);
      (mockRepository.save as Mock).mockResolvedValue(undefined);

      const command: DeleteDataSourceCommand = {
        id: 'ds-001',
        deletedBy: 'user-002'
      };

      await service.deleteDataSource(command);

      expect(mockRepository.findById).toHaveBeenCalledWith('ds-001');
      expect(mockRepository.save).toHaveBeenCalled();
      const savedArg = (mockRepository.save as Mock).mock.calls[0][0];
      expect(savedArg.isDeleted).toBe(true);
      expect(savedArg.deletedBy).toBe('user-002');
    });

    it('should throw error when data source not found', async () => {
      (mockRepository.findById as Mock).mockResolvedValue(null);

      const command: DeleteDataSourceCommand = {
        id: 'nonexistent',
        deletedBy: 'user-002'
      };

      await expect(service.deleteDataSource(command)).rejects.toThrow();
    });
  });

  describe('testConnection', () => {
    it('should return success result when connection succeeds', async () => {
      const dataSource = createMockDataSource();
      
      (mockClientAdapter.testConnection as Mock).mockResolvedValue({
        result: TestConnectionResult.SUCCESS,
        message: 'Connection successful',
        errorDetails: undefined
      });

      const result = await service.testConnection(dataSource);

      expect(mockClientAdapter.testConnection).toHaveBeenCalledWith(dataSource);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Connection successful');
      expect(result.error).toBeUndefined();
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return failure result when connection fails', async () => {
      const dataSource = createMockDataSource();
      
      (mockClientAdapter.testConnection as Mock).mockResolvedValue({
        result: TestConnectionResult.FAILED,
        message: 'Connection failed',
        errorDetails: 'Authentication error'
      });

      const result = await service.testConnection(dataSource);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Connection failed');
      expect(result.error).toBe('Authentication error');
    });
  });
});
