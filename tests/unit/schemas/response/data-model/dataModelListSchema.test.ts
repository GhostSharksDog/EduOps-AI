import { describe, it, expect } from 'vitest';
import { dataModelListSchema } from '@/modules/data/contracts/schemas/response/data-model/dataModelListSchema';
import { DataModelStatus } from '@/shared/enums/data-models/DataModelStatus';
import { DataSourceType } from '@/shared/enums/datasource/DataSourceType';
import { DataSourceStatus } from '@/shared/enums/datasource/DataSourceStatus';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testNumberConstraints,
  testArrayValidation,
} from '../../../../helpers/schema-test-utils';

describe('dataModelListSchema', () => {
  const validDatasourceInput = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Test DataSource',
    type: DataSourceType.MYSQL,
    host: 'localhost',
    port: 3306,
    databaseName: 'test_db',
    username: 'root',
    status: DataSourceStatus.ACTIVE,
    ownedBy: '123e4567-e89b-12d3-a456-426614174002',
    description: 'Test data source',
    feature: { enabled: true },
    isDeleted: false,
    createTime: '2024-12-31T23:59:59.999Z',
    updateTime: '2024-12-31T23:59:59.999Z',
    deleteTime: undefined,
    createdBy: '123e4567-e89b-12d3-a456-426614174003',
    updatedBy: '123e4567-e89b-12d3-a456-426614174004',
    deletedBy: undefined,
  };

  const validDataModelItem = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    ownedBy: '123e4567-e89b-12d3-a456-426614174001',
    isDeleted: false,
    createTime: '2024-12-31T23:59:59.999Z',
    updateTime: '2024-12-31T23:59:59.999Z',
    deleteTime: undefined,
    createdBy: '123e4567-e89b-12d3-a456-426614174002',
    updatedBy: '123e4567-e89b-12d3-a456-426614174003',
    deletedBy: undefined,
    description: 'Test data model',
    feature: { enabled: true },
    name: 'Test DataModel',
    datasource: validDatasourceInput,
    tableName: 'test_table',
    status: DataModelStatus.ACTIVE,
    columns: [],
  };

  const validListInput = {
    items: [validDataModelItem],
    totalCount: 1,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  };

  describe('schema structure', () => {
    testStrictObject(dataModelListSchema, validListInput);
  });

  describe('items field', () => {
    testRequiredFields(dataModelListSchema, ['items'], validListInput);
    testArrayValidation(dataModelListSchema, 'items', validListInput);

    it('accepts empty items array', () => {
      const input = { ...validListInput, items: [] };
      const result = dataModelListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts items array with multiple valid data models', () => {
      const input = {
        ...validListInput,
        items: [validDataModelItem, { ...validDataModelItem, id: '223e4567-e89b-12d3-a456-426614174000' }],
      };
      const result = dataModelListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects items with invalid data model', () => {
      const input = {
        ...validListInput,
        items: [{ invalid: 'data' }],
      };
      const result = dataModelListSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('totalCount field', () => {
    testRequiredFields(dataModelListSchema, ['totalCount'], validListInput);
    testNumberConstraints(dataModelListSchema, 'totalCount', validListInput, {
      min: 0,
      isInteger: true,
    });

    it('accepts zero totalCount', () => {
      const input = { ...validListInput, totalCount: 0, items: [] };
      const result = dataModelListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('page field', () => {
    testRequiredFields(dataModelListSchema, ['page'], validListInput);
    testNumberConstraints(dataModelListSchema, 'page', validListInput, {
      min: 1,
      isInteger: true,
    });

    it('rejects page less than 1', () => {
      const input = { ...validListInput, page: 0 };
      const result = dataModelListSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('pageSize field', () => {
    testRequiredFields(dataModelListSchema, ['pageSize'], validListInput);
    testNumberConstraints(dataModelListSchema, 'pageSize', validListInput, {
      min: 1,
      isInteger: true,
    });

    it('rejects pageSize less than 1', () => {
      const input = { ...validListInput, pageSize: 0 };
      const result = dataModelListSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('totalPages field', () => {
    testRequiredFields(dataModelListSchema, ['totalPages'], validListInput);
    testNumberConstraints(dataModelListSchema, 'totalPages', validListInput, {
      min: 0,
      isInteger: true,
    });

    it('accepts zero totalPages', () => {
      const input = { ...validListInput, totalCount: 0, totalPages: 0, items: [] };
      const result = dataModelListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('pagination consistency', () => {
    it('validates pagination structure with 10 items on page 2 of 3', () => {
      const input = {
        items: Array(10).fill(validDataModelItem),
        totalCount: 30,
        page: 2,
        pageSize: 10,
        totalPages: 3,
      };
      const result = dataModelListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('validates pagination with pageSize equal to totalCount', () => {
      const input = {
        items: [validDataModelItem],
        totalCount: 1,
        page: 1,
        pageSize: 1,
        totalPages: 1,
      };
      const result = dataModelListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: dataModelListSchema,
      validCases: [
        {
          input: {
            items: [],
            totalCount: 0,
            page: 1,
            pageSize: 10,
            totalPages: 0,
          },
          description: 'empty list',
        },
        {
          input: validListInput,
          description: 'single item list',
        },
        {
          input: {
            items: Array(10).fill(validDataModelItem),
            totalCount: 100,
            page: 5,
            pageSize: 10,
            totalPages: 10,
          },
          description: 'paginated list',
        },
      ],
      invalidCases: [
        {
          input: { totalCount: 1, page: 1, pageSize: 10, totalPages: 1 },
          description: 'missing items',
        },
        {
          input: { items: [], page: 1, pageSize: 10, totalPages: 1 },
          description: 'missing totalCount',
        },
        {
          input: { items: [], totalCount: 1, pageSize: 10, totalPages: 1 },
          description: 'missing page',
        },
        {
          input: { items: [], totalCount: 1, page: 1, totalPages: 1 },
          description: 'missing pageSize',
        },
        {
          input: { items: [], totalCount: 1, page: 1, pageSize: 10 },
          description: 'missing totalPages',
        },
        {
          input: { items: 'not-an-array', totalCount: 1, page: 1, pageSize: 10, totalPages: 1 },
          description: 'items is not an array',
        },
        {
          input: { items: [], totalCount: -1, page: 1, pageSize: 10, totalPages: 1 },
          description: 'negative totalCount',
        },
        {
          input: { items: [], totalCount: 1, page: 0, pageSize: 10, totalPages: 1 },
          description: 'page zero',
        },
      ],
    });
  });
});
