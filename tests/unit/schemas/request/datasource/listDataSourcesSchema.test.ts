import { describe, it, expect } from 'vitest';
import { listDataSourcesSchema } from '@/modules/data/contracts/schemas/request/datasource/listDataSourcesSchema';
import { DataSourceType } from '@/shared/enums/datasource/DataSourceType';
import { DataSourceStatus } from '@/shared/enums/datasource/DataSourceStatus';
import { QueryDirection } from '@/shared/enums/common/QueryDirection';
import {
  testSchema,
  testStrictObject,
  testOptionalFields,
  testDefaultValues,
  testStringConstraints,
  testEnumValidation,
  testNumberConstraints,
} from '../../../../helpers/schema-test-utils';

describe('listDataSourcesSchema', () => {
  const validInput = {
    page: 1,
    pageSize: 10,
    type: DataSourceType.POSTGRESQL,
    status: DataSourceStatus.ACTIVE,
    keyword: 'test',
    sortBy: 'name',
    sortOrder: QueryDirection.DESC,
  };

  describe('schema structure', () => {
    testStrictObject(listDataSourcesSchema, validInput);
  });

  describe('all fields optional', () => {
    testOptionalFields(
      listDataSourcesSchema,
      ['page', 'pageSize', 'type', 'status', 'keyword', 'sortBy', 'sortOrder'],
      validInput
    );
  });

  describe('page field', () => {
    testNumberConstraints(listDataSourcesSchema, 'page', { page: 1 }, {
      min: 1,
      isInteger: true,
    });

    it('accepts page = 1', () => {
      const input = { page: 1 };
      const result = listDataSourcesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects page = 0', () => {
      const input = { page: 0 };
      const result = listDataSourcesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects negative page', () => {
      const input = { page: -1 };
      const result = listDataSourcesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects float page', () => {
      const input = { page: 1.5 };
      const result = listDataSourcesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('pageSize field', () => {
    testNumberConstraints(listDataSourcesSchema, 'pageSize', { pageSize: 10 }, {
      min: 1,
      max: 10000,
      isInteger: true,
    });

    it('accepts pageSize = 1', () => {
      const input = { pageSize: 1 };
      const result = listDataSourcesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts pageSize = 100', () => {
      const input = { pageSize: 100 };
      const result = listDataSourcesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts pageSize = 10000', () => {
      const input = { pageSize: 10000 };
      const result = listDataSourcesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects pageSize = 0', () => {
      const input = { pageSize: 0 };
      const result = listDataSourcesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects pageSize > 10000', () => {
      const input = { pageSize: 10001 };
      const result = listDataSourcesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('default values', () => {
    testDefaultValues(
      listDataSourcesSchema,
      { page: 1, pageSize: 10, sortOrder: QueryDirection.DESC },
      {}
    );
  });

  describe('type field', () => {
    testEnumValidation(listDataSourcesSchema, 'type', Object.values(DataSourceType), validInput);
  });

  describe('status field', () => {
    testEnumValidation(listDataSourcesSchema, 'status', Object.values(DataSourceStatus), validInput);
  });

  describe('keyword field', () => {
    testStringConstraints(listDataSourcesSchema, 'keyword', { keyword: 'test' }, {
      allowEmpty: true,
    });

    it('trims whitespace from keyword', () => {
      const input = { keyword: '  search  ' };
      const result = listDataSourcesSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.keyword).toBe('search');
      }
    });
  });

  // sortBy field is optional string - no constraints to test


  describe('sortOrder field', () => {
    testEnumValidation(listDataSourcesSchema, 'sortOrder', Object.values(QueryDirection), validInput);
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: listDataSourcesSchema,
      validCases: [
        {
          input: {},
          description: 'empty object - uses defaults',
        },
        {
          input: { page: 2, pageSize: 20 },
          description: 'only pagination',
        },
        {
          input: { type: DataSourceType.MYSQL, status: DataSourceStatus.ACTIVE },
          description: 'only filters',
        },
        {
          input: validInput,
          description: 'all fields populated',
        },
      ],
      invalidCases: [
        {
          input: { page: 0 },
          description: 'invalid page',
        },
        {
          input: { pageSize: 10001 },
          description: 'pageSize exceeds max',
        },
        {
          input: { type: 'INVALID' },
          description: 'invalid type enum',
        },
        {
          input: { status: 'INVALID' },
          description: 'invalid status enum',
        },
        {
          input: { sortOrder: 'INVALID' },
          description: 'invalid sortOrder enum',
        },
        {
          input: { ...validInput, extra: 'field' },
          description: 'extra field rejected',
        },
      ],
    });
  });
});
