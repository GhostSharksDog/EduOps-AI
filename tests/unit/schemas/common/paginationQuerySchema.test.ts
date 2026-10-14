import { describe, it, expect } from 'vitest';
import { paginationQuerySchema, paginationResponseSchema } from '@/shared/schemas/common/paginationQuerySchema';
import { SortOrder } from '@/shared/enums/index';
import { z } from 'zod';
import {
  testStrictObject,
  testDefaultValues,
  testOptionalFields,
  testArrayValidation,
} from '../../../helpers/schema-test-utils';

describe('paginationQuerySchema', () => {
  describe('type coercion', () => {
    it('coerces string page to number', () => {
      const result = paginationQuerySchema.safeParse({ page: '5' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(5);
        expect(typeof result.data.page).toBe('number');
      }
    });

    it('coerces string pageSize to number', () => {
      const result = paginationQuerySchema.safeParse({ pageSize: '20' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pageSize).toBe(20);
        expect(typeof result.data.pageSize).toBe('number');
      }
    });

    it('rejects non-numeric strings for page', () => {
      const result = paginationQuerySchema.safeParse({ page: 'abc' });
      expect(result.success).toBe(false);
    });

    it('rejects non-numeric strings for pageSize', () => {
      const result = paginationQuerySchema.safeParse({ pageSize: 'xyz' });
      expect(result.success).toBe(false);
    });
  });

  describe('page validation', () => {
    it('accepts page = 1', () => {
      const result = paginationQuerySchema.safeParse({ page: 1 });
      expect(result.success).toBe(true);
    });

    it('accepts page = 1000', () => {
      const result = paginationQuerySchema.safeParse({ page: 1000 });
      expect(result.success).toBe(true);
    });

    it('rejects page = 0', () => {
      const result = paginationQuerySchema.safeParse({ page: 0 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('too_small');
      }
    });

    it('rejects negative page', () => {
      const result = paginationQuerySchema.safeParse({ page: -1 });
      expect(result.success).toBe(false);
    });

    it('rejects float page', () => {
      const result = paginationQuerySchema.safeParse({ page: 1.5 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('invalid_type');
      }
    });
  });

  describe('pageSize validation', () => {
    it('accepts pageSize = 1', () => {
      const result = paginationQuerySchema.safeParse({ pageSize: 1 });
      expect(result.success).toBe(true);
    });

    it('accepts pageSize = 100', () => {
      const result = paginationQuerySchema.safeParse({ pageSize: 100 });
      expect(result.success).toBe(true);
    });

    it('accepts pageSize = 10000', () => {
      const result = paginationQuerySchema.safeParse({ pageSize: 10000 });
      expect(result.success).toBe(true);
    });

    it('rejects pageSize = 0', () => {
      const result = paginationQuerySchema.safeParse({ pageSize: 0 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('too_small');
      }
    });

    it('rejects pageSize = 10001', () => {
      const result = paginationQuerySchema.safeParse({ pageSize: 10001 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('too_big');
      }
    });

    it('rejects negative pageSize', () => {
      const result = paginationQuerySchema.safeParse({ pageSize: -1 });
      expect(result.success).toBe(false);
    });
  });

  describe('default values', () => {
    testDefaultValues(
      paginationQuerySchema,
      { page: 1, pageSize: 10, sortOrder: SortOrder.ASC },
      {}
    );
  });

  describe('optional fields', () => {
    testOptionalFields(
      paginationQuerySchema,
      ['sortBy', 'keyword', 'filters', 'include'],
      { page: 1, pageSize: 10 }
    );
  });

  describe('sortBy field', () => {
    it('accepts valid sortBy string', () => {
      const result = paginationQuerySchema.safeParse({ sortBy: 'name' });
      expect(result.success).toBe(true);
    });

    it('trims whitespace from sortBy', () => {
      const result = paginationQuerySchema.safeParse({ sortBy: '  name  ' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortBy).toBe('name');
      }
    });
  });

  describe('sortOrder field', () => {
    it(`accepts sortOrder = "${SortOrder.ASC}"`, () => {
      const result = paginationQuerySchema.safeParse({ sortOrder: SortOrder.ASC });
      expect(result.success).toBe(true);
    });

    it(`accepts sortOrder = "${SortOrder.DESC}"`, () => {
      const result = paginationQuerySchema.safeParse({ sortOrder: SortOrder.DESC });
      expect(result.success).toBe(true);
    });

    it('rejects invalid sortOrder', () => {
      const result = paginationQuerySchema.safeParse({ sortOrder: 'INVALID' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('invalid_value');
      }
    });
  });

  describe('keyword field', () => {
    it('accepts valid keyword', () => {
      const result = paginationQuerySchema.safeParse({ keyword: 'search term' });
      expect(result.success).toBe(true);
    });

    it('trims whitespace from keyword', () => {
      const result = paginationQuerySchema.safeParse({ keyword: '  search  ' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.keyword).toBe('search');
      }
    });
  });

  describe('filters field', () => {
    it('accepts valid filters object', () => {
      const result = paginationQuerySchema.safeParse({
        filters: { status: 'active', type: 'user' }
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty filters object', () => {
      const result = paginationQuerySchema.safeParse({ filters: {} });
      expect(result.success).toBe(true);
    });

    it('accepts filters with various value types', () => {
      const result = paginationQuerySchema.safeParse({
        filters: {
          string: 'value',
          number: 123,
          boolean: true,
          null: null,
          array: [1, 2, 3],
        }
      });
      expect(result.success).toBe(true);
    });
  });

  describe('include field', () => {
    it('accepts valid include array', () => {
      const result = paginationQuerySchema.safeParse({
        include: ['author', 'comments']
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty include array', () => {
      const result = paginationQuerySchema.safeParse({ include: [] });
      expect(result.success).toBe(true);
    });

    it('rejects non-array include', () => {
      const result = paginationQuerySchema.safeParse({ include: 'author' });
      expect(result.success).toBe(false);
    });
  });

  describe('strict object validation', () => {
    testStrictObject(paginationQuerySchema, { page: 1 });
  });

  describe('complete valid input', () => {
    it('accepts all fields with valid values', () => {
      const input = {
        page: 2,
        pageSize: 50,
        sortBy: 'createTime',
        sortOrder: SortOrder.DESC,
        keyword: 'test',
        filters: { status: 'active' },
        include: ['author', 'tags'],
      };
      const result = paginationQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(input);
      }
    });

    it('accepts minimal input (all defaults)', () => {
      const result = paginationQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(10);
        expect(result.data.sortOrder).toBe(SortOrder.ASC);
      }
    });
  });
});

describe('paginationResponseSchema', () => {
  const itemSchema = z.object({ id: z.number(), name: z.string() });

  describe('items validation', () => {
    it('accepts valid items array', () => {
      const input = {
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 2,
          totalPages: 1,
        },
      };
      const result = paginationResponseSchema(itemSchema).safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts empty items array', () => {
      const input = {
        items: [],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 1,
        },
      };
      const result = paginationResponseSchema(itemSchema).safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects items with invalid structure', () => {
      const input = {
        items: [{ id: 'not-a-number', name: 'Item' }],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        },
      };
      const result = paginationResponseSchema(itemSchema).safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('pagination validation', () => {
    it('requires all pagination fields', () => {
      const input = {
        items: [],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 1,
        },
      };
      const result = paginationResponseSchema(itemSchema).safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects missing pagination.page', () => {
      const input = {
        items: [],
        pagination: {
          pageSize: 10,
          total: 0,
          totalPages: 1,
        },
      };
      const result = paginationResponseSchema(itemSchema).safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects pagination.page < 1', () => {
      const input = {
        items: [],
        pagination: {
          page: 0,
          pageSize: 10,
          total: 0,
          totalPages: 1,
        },
      };
      const result = paginationResponseSchema(itemSchema).safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects pagination.pageSize < 1', () => {
      const input = {
        items: [],
        pagination: {
          page: 1,
          pageSize: 0,
          total: 0,
          totalPages: 1,
        },
      };
      const result = paginationResponseSchema(itemSchema).safeParse(input);
      expect(result.success).toBe(false);
    });

    it('accepts pagination.total = 0', () => {
      const input = {
        items: [],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 1,
        },
      };
      const result = paginationResponseSchema(itemSchema).safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects pagination.total < 0', () => {
      const input = {
        items: [],
        pagination: {
          page: 1,
          pageSize: 10,
          total: -1,
          totalPages: 1,
        },
      };
      const result = paginationResponseSchema(itemSchema).safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects pagination.totalPages < 1', () => {
      const input = {
        items: [],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 0,
        },
      };
      const result = paginationResponseSchema(itemSchema).safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('strict object validation', () => {
    it('rejects extra properties at top level', () => {
      const input = {
        items: [],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 1,
        },
        extraField: 'not allowed',
      };
      const result = paginationResponseSchema(itemSchema).safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects extra properties in pagination', () => {
      const input = {
        items: [],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 1,
          extraField: 'not allowed',
        },
      };
      const result = paginationResponseSchema(itemSchema).safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
