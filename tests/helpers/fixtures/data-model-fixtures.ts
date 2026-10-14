import { DataModel } from '@/modules/data/domain/data-model/entities/DataModel';
import { DataModelStatus, DataSourceType, DataSourceStatus } from '@/shared/enums/index';
import { DataSource } from '@/modules/data/domain/datasource/entities/DataSource';
import { TEST_USER_ID, TEST_ORG_ID, generateTestId, TEST_DATABASE_CONFIG } from '../constants';

let testDataSource: DataSource | null = null;

export function createTestDataSource(overrides: Partial<{
  id: string;
  name: string;
  ownedBy: string;
  createTime: Date;
  createdBy: string;
  description: string;
  type: DataSourceType;
  host: string;
  port: number;
  databaseName: string;
  username: string;
  password: string;
  status: DataSourceStatus;
  isDeleted: boolean;
}> = {}): DataSource {
  const type = overrides.type ?? DataSourceType.POSTGRESQL;
  const config = type === DataSourceType.CLICKHOUSE 
    ? TEST_DATABASE_CONFIG.CLICKHOUSE 
    : type === DataSourceType.MYSQL
    ? TEST_DATABASE_CONFIG.MYSQL
    : TEST_DATABASE_CONFIG.POSTGRESQL;
    
  testDataSource = new DataSource(
    overrides.id ?? generateTestId('ds'),
    overrides.name ?? 'Test Database',
    overrides.ownedBy ?? TEST_ORG_ID,
    overrides.createTime ?? new Date(),
    overrides.createdBy ?? TEST_USER_ID,
    overrides.description ?? undefined,
    type,
    overrides.host ?? config.host,
    overrides.port ?? config.port,
    overrides.databaseName ?? config.database,
    overrides.username ?? config.username,
    overrides.password ?? config.password,
    overrides.status ?? DataSourceStatus.ACTIVE,
    overrides.isDeleted ?? false
  );
  return testDataSource;
}

export function createTestDataModel(overrides: Partial<{
  id: string;
  name: string;
  status: DataModelStatus;
  datasource: DataSource;
  ownedBy: string;
  createdBy: string;
  description: string;
  tableName: string;
  isDeleted: boolean;
}> = {}): DataModel {
  const datasource = overrides.datasource ?? createTestDataSource();
  
  return new DataModel(
    overrides.id ?? generateTestId('dm'),
    overrides.name ?? 'Test DataModel',
    overrides.status ?? DataModelStatus.DRAFT,
    datasource,
    overrides.ownedBy ?? TEST_ORG_ID,
    new Date(),
    overrides.createdBy ?? TEST_USER_ID,
    overrides.description ?? undefined,
    overrides.tableName ?? undefined,
    [],
    undefined,
    overrides.isDeleted ?? false,
    undefined,
    undefined,
    undefined,
    undefined
  );
}

export function getTestDataSource(): DataSource {
  if (!testDataSource) {
    return createTestDataSource();
  }
  return testDataSource;
}

export function resetTestDataSource(): void {
  testDataSource = null;
}
