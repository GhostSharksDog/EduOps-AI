import { describe, it, expect } from 'vitest';
import { reorderTagCategoriesSchema } from '@/modules/tag/contracts/schemas/request/tag-category/reorderTagCategoriesSchema';
import {
  testSchema,
  testStrictObject,
  testDefaultValues,
} from '../../../../helpers/schema-test-utils';

describe('reorderTagCategoriesSchema', () => {
  const validInput = {
    categoryIds: ['123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001'],
    orderIndex: [0, 1],
  };

  describe('schema structure', () => {
    testStrictObject(reorderTagCategoriesSchema, validInput);
  });

  describe('default values', () => {
    testDefaultValues(
      reorderTagCategoriesSchema,
      { categoryIds: [], orderIndex: [] },
      {}
    );
  });

  describe('categoryIds field', () => {
    it('accepts empty array', () => {
      const input = { categoryIds: [] };
      const result = reorderTagCategoriesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts array of valid UUIDs', () => {
      const input = {
        categoryIds: [
          '123e4567-e89b-12d3-a456-426614174000',
          '123e4567-e89b-12d3-a456-426614174001',
        ],
      };
      const result = reorderTagCategoriesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects invalid UUID in array', () => {
      const input = { categoryIds: ['invalid-uuid'] };
      const result = reorderTagCategoriesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects non-array categoryIds', () => {
      const input = { categoryIds: 'not-an-array' };
      const result = reorderTagCategoriesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('orderIndex field', () => {
    it('accepts empty array', () => {
      const input = { orderIndex: [] };
      const result = reorderTagCategoriesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts array of integers', () => {
      const input = { orderIndex: [0, 1, 2, 3] };
      const result = reorderTagCategoriesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts negative integers', () => {
      const input = { orderIndex: [-1, 0, 1] };
      const result = reorderTagCategoriesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects float in array', () => {
      const input = { orderIndex: [1.5] };
      const result = reorderTagCategoriesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects non-array orderIndex', () => {
      const input = { orderIndex: 'not-an-array' };
      const result = reorderTagCategoriesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: reorderTagCategoriesSchema,
      validCases: [
        {
          input: {},
          description: 'empty object - uses defaults',
        },
        {
          input: { categoryIds: [], orderIndex: [] },
          description: 'explicit empty arrays',
        },
        {
          input: validInput,
          description: 'all fields populated',
        },
      ],
      invalidCases: [
        {
          input: { categoryIds: ['invalid'] },
          description: 'invalid UUID in categoryIds',
        },
        {
          input: { orderIndex: [1.5] },
          description: 'float in orderIndex',
        },
        {
          input: { ...validInput, extra: 'field' },
          description: 'extra field rejected',
        },
      ],
    });
  });
});
