import { describe, it, expect } from 'vitest';
import { dataSourceListSchema, DataSourceListVO } from '@/modules/data/contracts/schemas/response/datasource/dataSourceListSchema';
import { DataSourceType } from '@/shared/enums/datasource/DataSourceType';
import { DataSourceStatus } from '@/shared/enums/datasource/DataSourceStatus';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testNumberConstraints,
} from '../../../../helpers/schema-test-utils';

describe('dataSourceListSchema', () => {
  // Sample data source item for list
  const validDataSourceItem = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Database',
    type: DataSourceType.POSTGRESQL,
    host: 'db.example.com',
    port: 5432,
    databaseName: 'testdb',
    username: 'admin',
    status: DataSourceStatus.ACTIVE,
    ownedBy: '123e4567-e89b-12d3-a456-426614174001',
    description: 'Test database connection',
    feature: { enabled: true },
    isDeleted: false,
    createTime: '2024-12-31T23:59:59.999Z',
    updateTime: '2024-12-31T23:59:59.999Z',
    deleteTime: undefined,
    createdBy: '123e4567-e89b-12d3-a456-426614174002',
    updatedBy: '123e4567-e89b-12d3-a456-426614174003',
    deletedBy: null,
  };

  const validInput = {
    items: [validDataSourceItem],
    totalCount: 1,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  };

  describe('schema structure', () => {
    testStrictObject(dataSourceListSchema, validInput);
  });

  describe('items field', () => {
    it('accepts valid items array', () => {
      const result = dataSourceListSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('accepts empty items array', () => {
      const input = {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      const result = dataSourceListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects items with invalid data source structure', () => {
      const input = {
        items: [{ id: 123, name: 'Invalid' }], // id should be UUID
        totalCount: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };
      const result = dataSourceListSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects non-array items', () => {
      const input = {
        items: 'not an array',
        totalCount: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      const result = dataSourceListSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('totalCount field', () => {
    const validBaseInput = {
      items: [],
      page: 1,
      pageSize: 10,
      totalPages: 0,
    };

    it('accepts totalCount = 0', () => {
      const result = dataSourceListSchema.safeParse({ ...validBaseInput, totalCount: 0 });
      expect(result.success).toBe(true);
    });

    it('accepts large totalCount', () => {
      const result = dataSourceListSchema.safeParse({ ...validBaseInput, totalCount: 1000000 });
      expect(result.success).toBe(true);
    });

    it('rejects negative totalCount', () => {
      const result = dataSourceListSchema.safeParse({ ...validBaseInput, totalCount: -1 });
      expect(result.success).toBe(false);
    });

    it('rejects float totalCount', () => {
      const result = dataSourceListSchema.safeParse({ ...validBaseInput, totalCount: 1.5 });
      expect(result.success).toBe(false);
    });

    it('rejects missing totalCount', () => {
      const input = {
        items: [],
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      const result = dataSourceListSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('page field', () => {
    const validBaseInput = {
      items: [],
      totalCount: 0,
      pageSize: 10,
      totalPages: 0,
    };

    it('accepts page = 1', () => {
      const result = dataSourceListSchema.safeParse({ ...validBaseInput, page: 1 });
      expect(result.success).toBe(true);
    });

    it('accepts large page number', () => {
      const result = dataSourceListSchema.safeParse({ ...validBaseInput, page: 1000 });
      expect(result.success).toBe(true);
    });

    testNumberConstraints(dataSourceListSchema, 'page', validBaseInput, { min: 1 });

    it('rejects float page', () => {
      const result = dataSourceListSchema.safeParse({ ...validBaseInput, page: 1.5 });
      expect(result.success).toBe(false);
    });

    it('rejects missing page', () => {
      const input = {
        items: [],
        totalCount: 0,
        pageSize: 10,
        totalPages: 0,
      };
      const result = dataSourceListSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('pageSize field', () => {
    const validBaseInput = {
      items: [],
      totalCount: 0,
      page: 1,
      totalPages: 0,
    };

    it('accepts pageSize = 1', () => {
      const result = dataSourceListSchema.safeParse({ ...validBaseInput, pageSize: 1 });
      expect(result.success).toBe(true);
    });

    it('accepts pageSize = 100', () => {
      const result = dataSourceListSchema.safeParse({ ...validBaseInput, pageSize: 100 });
      expect(result.success).toBe(true);
    });

    testNumberConstraints(dataSourceListSchema, 'pageSize', validBaseInput, { min: 1 });

    it('rejects float pageSize', () => {
      const result = dataSourceListSchema.safeParse({ ...validBaseInput, pageSize: 10.5 });
      expect(result.success).toBe(false);
    });

    it('rejects missing pageSize', () => {
      const input = {
        items: [],
        totalCount: 0,
        page: 1,
        totalPages: 0,
      };
      const result = dataSourceListSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('totalPages field', () => {
    const validBaseInput = {
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 10,
    };

    it('accepts totalPages = 0', () => {
      const result = dataSourceListSchema.safeParse({ ...validBaseInput, totalPages: 0 });
      expect(result.success).toBe(true);
    });

    it('accepts large totalPages', () => {
      const result = dataSourceListSchema.safeParse({ ...validBaseInput, totalPages: 1000 });
      expect(result.success).toBe(true);
    });

    testNumberConstraints(dataSourceListSchema, 'totalPages', validBaseInput, { min: 0 });

    it('rejects float totalPages', () => {
      const result = dataSourceListSchema.safeParse({ ...validBaseInput, totalPages: 1.5 });
      expect(result.success).toBe(false);
    });

    it('rejects missing totalPages', () => {
      const input = {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 10,
      };
      const result = dataSourceListSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: dataSourceListSchema,
      validCases: [
        {
          input: {
            items: [validDataSourceItem],
            totalCount: 1,
            page: 1,
            pageSize: 10,
            totalPages: 1,
          },
          description: 'single item in list',
        },
        {
          input: {
            items: [
              validDataSourceItem,
              { ...validDataSourceItem, id: '223e4567-e89b-12d3-a456-426614174000', name: 'Second DB' },
            ],
            totalCount: 2,
            page: 1,
            pageSize: 10,
            totalPages: 1,
          },
          description: 'multiple items in list',
        },
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
          input: {
            items: [validDataSourceItem],
            totalCount: 100,
            page: 2,
            pageSize: 20,
            totalPages: 5,
          },
          description: 'pagination with multiple pages',
        },
      ],
      invalidCases: [
        {
          input: {
            totalCount: 1,
            page: 1,
            pageSize: 10,
            totalPages: 1,
          },
          description: 'missing items field',
        },
        {
          input: {
            items: [],
            page: 1,
            pageSize: 10,
            totalPages: 1,
          },
          description: 'missing totalCount field',
        },
        {
          input: {
            items: [],
            totalCount: 0,
            pageSize: 10,
            totalPages: 1,
          },
          description: 'missing page field',
        },
        {
          input: {
            items: [],
            totalCount: 0,
            page: 1,
            totalPages: 1,
          },
          description: 'missing pageSize field',
        },
        {
          input: {
            items: [],
            totalCount: 0,
            page: 1,
            pageSize: 10,
          },
          description: 'missing totalPages field',
        },
      ],
    });
  });
});
