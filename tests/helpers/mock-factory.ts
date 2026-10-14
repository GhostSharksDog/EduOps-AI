import { z } from 'zod';
import { 
  TagStatus, 
  TagValueType, 
  UpdateCycle,
  DataSourceType,
  DataSourceStatus,
  DataModelStatus,
  SegmentStatus,
  SegmentType,
  SegmentCalculationType,
} from '@/shared/enums/index';

import { 
  tagSchema, 
  type TagVO 
} from '@/modules/tag/contracts/schemas/response/tag/tagSchema';
import { 
  tagCategorySchema, 
  type TagCategoryVO 
} from '@/modules/tag/contracts/schemas/response/tag-category/tagCategorySchema';
import { 
  segmentSchema, 
  type SegmentVO 
} from '@/modules/segment/contracts/schemas/response/segment/segmentSchema';
import { 
  dataSourceSchema, 
  type DataSourceVO 
} from '@/modules/data/contracts/schemas/response/datasource/dataSourceSchema';
import { 
  dataModelSchema, 
  type DataModelVO 
} from '@/modules/data/contracts/schemas/response/data-model/dataModelSchema';

import type { BitmapTableData } from '@/modules/tag/domain/ports/IBitmapTableRepository';
import type { MaterializedViewConfigData } from '@/modules/tag/domain/ports/IMaterializedViewConfigRepository';
import type { TagRefreshLogData } from '@/modules/tag/domain/ports/ITagRefreshLogRepository';

import { 
  TEST_USER_ID, 
  TEST_ORG_ID, 
  TEST_CATEGORY_ID,
  generateTestUuid,
  generateTestId,
  TEST_DATABASE_CONFIG,
} from './constants';

export class MockValidationError extends Error {
  constructor(
    public readonly schemaName: string,
    public readonly issues: readonly z.ZodIssue[]
  ) {
    const issueMessages = issues.map(i => 
      `${i.path.join('.')}: ${i.message}`
    ).join('\n');
    super(`Mock data validation failed for ${schemaName}:\n${issueMessages}`);
    this.name = 'MockValidationError';
  }
}

export function validateMock<T>(
  schema: z.ZodType<T>,
  data: unknown,
  schemaName: string
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new MockValidationError(schemaName, result.error.issues);
  }
  return result.data;
}

const createTimestamp = () => new Date().toISOString();

export const MockFactory = {
  createTagVO(overrides: Partial<TagVO> = {}): TagVO {
    const data: TagVO = {
      id: generateTestUuid(),
      name: 'Test Tag',
      category: null,
      dataType: TagValueType.STRING,
      status: TagStatus.DRAFT,
      updateCycle: UpdateCycle.DAILY,
      isPublic: false,
      feature: {},
      isDeleted: false,
      createTime: createTimestamp(),
      createdBy: TEST_USER_ID,
      ...overrides,
    };
    return validateMock(tagSchema, data, 'TagVO');
  },

  createTagCategoryVO(overrides: Partial<TagCategoryVO> = {}): TagCategoryVO {
    const data: TagCategoryVO = {
      id: TEST_CATEGORY_ID,
      name: 'Test Category',
      parent: null,
      path: '/test-category',
      description: 'Test category description',
      orderIndex: 0,
      tagCount: 0,
      childrenCount: 0,
      feature: {},
      isDeleted: false,
      createTime: createTimestamp(),
      createdBy: TEST_USER_ID,
      children: [],
      ...overrides,
    };
    return validateMock(tagCategorySchema, data, 'TagCategoryVO');
  },

  createSegmentVO(overrides: Partial<SegmentVO> = {}): SegmentVO {
    const data: SegmentVO = {
      id: generateTestUuid(),
      name: 'Test Segment',
      description: 'Test segment description',
      entityType: SegmentType.USER,
      computeType: SegmentCalculationType.OFFLINE,
      status: SegmentStatus.DRAFT,
      scheduleConfig: null,
      lastCalculationTime: null,
      feature: null,
      conditionGroup: null,
      rules: [],
      statistics: null,
      memberCount: 0,
      nextCalculationTime: null,
      ownedBy: TEST_USER_ID,
      isDeleted: false,
      createTime: createTimestamp(),
      createdBy: TEST_USER_ID,
      ...overrides,
    };
    return validateMock(segmentSchema, data, 'SegmentVO');
  },

  createDataSourceVO(overrides: Partial<DataSourceVO> = {}): DataSourceVO {
    const dbConfig = TEST_DATABASE_CONFIG.POSTGRESQL;
    const data: DataSourceVO = {
      id: generateTestId('ds'),
      name: 'Test DataSource',
      type: DataSourceType.POSTGRESQL,
      host: dbConfig.host,
      port: dbConfig.port,
      databaseName: dbConfig.database,
      username: dbConfig.username,
      status: DataSourceStatus.ACTIVE,
      ownedBy: TEST_ORG_ID,
      description: 'Test data source',
      feature: {},
      isDeleted: false,
      createTime: createTimestamp(),
      createdBy: TEST_USER_ID,
      ...overrides,
    };
    return validateMock(dataSourceSchema, data, 'DataSourceVO');
  },

  createClickHouseDataSourceVO(overrides: Partial<DataSourceVO> = {}): DataSourceVO {
    const dbConfig = TEST_DATABASE_CONFIG.CLICKHOUSE;
    return this.createDataSourceVO({
      type: DataSourceType.CLICKHOUSE,
      host: dbConfig.host,
      port: dbConfig.port,
      databaseName: dbConfig.database,
      username: dbConfig.username,
      ...overrides,
    });
  },

  createDataModelVO(overrides: Partial<DataModelVO> = {}): DataModelVO {
    const datasource = this.createDataSourceVO();
    const data: DataModelVO = {
      id: generateTestId('dm'),
      name: 'Test DataModel',
      description: 'Test data model description',
      datasource: datasource as any,
      tableName: 'test_table',
      status: DataModelStatus.DRAFT,
      columns: [],
      ownedBy: TEST_ORG_ID,
      isDeleted: false,
      createTime: createTimestamp(),
      createdBy: TEST_USER_ID,
      ...overrides,
    };
    return validateMock(dataModelSchema, data, 'DataModelVO');
  },

  createTagPO(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: generateTestUuid(),
      name: 'Test Tag',
      valueType: TagValueType.STRING,
      status: TagStatus.DRAFT,
      isDeleted: false,
      update_cycle: UpdateCycle.DAILY,
      ownedBy: TEST_USER_ID,
      categoryId: TEST_CATEGORY_ID,
      createTime: new Date(),
      createdBy: TEST_USER_ID,
      currentVersionId: null,
      description: 'Test tag description',
      isPublic: false,
      feature: {},
      ...overrides,
    };
  },

  createTagCategoryPO(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: TEST_CATEGORY_ID,
      name: 'Test Category',
      parentId: null,
      path: '/test-category',
      description: 'Test category description',
      orderIndex: 1,
      ownedBy: TEST_USER_ID,
      isDeleted: false,
      feature: {},
      createTime: new Date(),
      createdBy: TEST_USER_ID,
      tagCount: 0,
      ...overrides,
    };
  },

  createSegmentPO(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: generateTestUuid(),
      name: 'Test Segment',
      description: 'Test segment description',
      status: SegmentStatus.DRAFT,
      entityType: SegmentType.USER,
      computeType: SegmentCalculationType.OFFLINE,
      isDeleted: false,
      ownedBy: TEST_USER_ID,
      createTime: new Date(),
      createdBy: TEST_USER_ID,
      memberCount: 0,
      scheduleConfig: null,
      lastCalculationTime: null,
      feature: {},
      ...overrides,
    };
  },

  createDataSourcePO(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    const dbConfig = TEST_DATABASE_CONFIG.POSTGRESQL;
    return {
      id: generateTestId('ds'),
      name: 'Test DataSource',
      type: DataSourceType.POSTGRESQL,
      host: dbConfig.host,
      port: dbConfig.port,
      databaseName: dbConfig.database,
      username: dbConfig.username,
      password: dbConfig.password,
      status: DataSourceStatus.ACTIVE,
      ownedBy: TEST_ORG_ID,
      isDeleted: false,
      createTime: new Date(),
      createdBy: TEST_USER_ID,
      description: 'Test data source',
      feature: {},
      ...overrides,
    };
  },

  createDataModelPO(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: generateTestId('dm'),
      name: 'Test DataModel',
      description: 'Test data model description',
      datasourceId: generateTestId('ds'),
      tableName: 'test_table',
      status: DataModelStatus.DRAFT,
      ownedBy: TEST_ORG_ID,
      isDeleted: false,
      createTime: new Date(),
      createdBy: TEST_USER_ID,
      feature: {},
      columns: [],
      ...overrides,
    };
  },

  // ========== BitmapTable Repository Methods ==========
  
  /**
   * 创建 BitmapTableData (Domain 格式，usedBits 是数组)
   */
  createBitmapTableData(overrides: Partial<BitmapTableData> = {}): BitmapTableData {
    return {
      id: generateTestId('bt'),
      entityType: 'user',
      entityTypeId: generateTestId('et'),
      ownedBy: TEST_USER_ID,
      sequence: 1,
      totalBits: 64,
      usedBits: [],
      status: 'ACTIVE',
      createTime: new Date('2024-01-01'),
      updateTime: undefined,
      deleteTime: null,
      ...overrides,
    };
  },

  /**
   * 创建 BitmapTable 数据库记录 (usedBits 是 JSON 字符串)
   * @param overrides 如果 usedBits 是数组，会自动转为 JSON 字符串；如果是字符串则直接使用
   */
  createBitmapTableRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    const baseData = this.createBitmapTableData();
    const usedBits = overrides.usedBits !== undefined 
      ? (Array.isArray(overrides.usedBits) ? JSON.stringify(overrides.usedBits) : overrides.usedBits)
      : JSON.stringify(baseData.usedBits);
    
    return {
      id: baseData.id,
      entityType: baseData.entityType,
      entityTypeId: baseData.entityTypeId,
      ownedBy: baseData.ownedBy,
      sequence: baseData.sequence,
      totalBits: baseData.totalBits,
      usedBits,
      status: baseData.status,
      createTime: baseData.createTime,
      updateTime: baseData.updateTime || null,
      deleteTime: baseData.deleteTime,
      isDeleted: false,
      ...overrides,
    };
  },

  // ========== MaterializedViewConfig Repository Methods ==========

  /**
   * 创建 MaterializedViewConfigData
   */
  createMaterializedViewConfigData(overrides: Partial<MaterializedViewConfigData> = {}): MaterializedViewConfigData {
    return {
      id: generateTestId('config'),
      tagId: generateTestUuid(),
      versionId: generateTestUuid(),
      mvName: 'mv_tag_test_v1',
      mvResultTable: 'tag_value_test_v1',
      refreshInterval: 'HOURLY',
      stepOrder: 1,
      isCascade: false,
      ownedBy: TEST_ORG_ID,
      createTime: new Date('2024-01-01'),
      updateTime: undefined,
      ...overrides,
    };
  },

  // ========== TagRefreshLog Repository Methods ==========

  /**
   * 创建 TagRefreshLogData
   */
  createTagRefreshLogData(overrides: Partial<TagRefreshLogData> = {}): TagRefreshLogData {
    return {
      id: generateTestId('log'),
      tagId: generateTestUuid(),
      mvName: 'mv_tag_test_v1',
      ownedBy: TEST_ORG_ID,
      errorMessage: undefined,
      occurredAt: new Date(),
      isResolved: false,
      createTime: new Date(),
      ...overrides,
    };
  },
};

// Additional PO factory methods added for test standardization
export const POFactory = {
  createTagExportTaskPO(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: generateTestId('export'),
      name: 'Test Export',
      status: 'PENDING',
      createTime: new Date(),
      createdBy: TEST_USER_ID,
      ...overrides,
    };
  },

  createEnumValuePO(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: generateTestId('val'),
      enumId: generateTestId('enum'),
      label: 'Test Value',
      value: 'test_value',
      sortOrder: 1,
      createTime: new Date(),
      createdBy: TEST_USER_ID,
      ...overrides,
    };
  },

  createSegmentCalculationTaskPO(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: generateTestId('task'),
      segmentId: generateTestUuid(),
      status: 'PENDING',
      createTime: new Date(),
      createdBy: TEST_USER_ID,
      ...overrides,
    };
  },

  createSegmentMemberPO(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: generateTestId('member'),
      segmentId: generateTestUuid(),
      entityId: 'entity-1',
      createTime: new Date(),
      createdBy: TEST_USER_ID,
      ...overrides,
    };
  },

  createEnumPO(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: generateTestId('enum'),
      name: 'TestEnum',
      code: 'TEST_ENUM',
      description: 'Test enum description',
      createTime: new Date(),
      createdBy: TEST_USER_ID,
      ...overrides,
    };
  },

  createTagVersionPO(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: generateTestUuid(),
      tagId: generateTestUuid(),
      version: 1,
      rule: '{}',
      status: 'ACTIVE',
      createTime: new Date(),
      createdBy: TEST_USER_ID,
      ...overrides,
    };
  },
};
