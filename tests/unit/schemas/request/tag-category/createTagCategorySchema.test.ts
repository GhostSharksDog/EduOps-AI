import { describe, it, expect } from 'vitest';
import { createTagCategorySchema } from '@/modules/tag/contracts/schemas/request/tag-category/createTagCategorySchema';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testOptionalFields,
  testDefaultValues,
  testStringConstraints,
  testUUIDValidation,
  testNumberConstraints,
} from '../../../../helpers/schema-test-utils';

describe('createTagCategorySchema', () => {
  const validInput = {
    name: 'Test Category',
    parentId: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Test description',
    orderIndex: 1,
    feature: { enabled: true },
  };

  describe('schema structure', () => {
    testStrictObject(createTagCategorySchema, validInput);
  });

  describe('required fields', () => {
    testRequiredFields(createTagCategorySchema, ['name'], validInput);
  });

  describe('optional fields', () => {
    testOptionalFields(createTagCategorySchema, ['parentId', 'description', 'orderIndex', 'feature'], validInput);
  });

  describe('name field', () => {
    testStringConstraints(createTagCategorySchema, 'name', { ...validInput, name: 'Test' }, {
      minLength: 1,
      maxLength: 255,
      allowEmpty: false,
    });

    it('trims whitespace from name', () => {
      const input = { name: '  Test Category  ', feature: {} };
      const result = createTagCategorySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Test Category');
      }
    });
  });

  describe('parentId field', () => {
    testUUIDValidation(createTagCategorySchema, 'parentId', validInput);

    it('accepts null parentId', () => {
      const input = { name: 'Test', parentId: null, feature: {} };
      const result = createTagCategorySchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts missing parentId', () => {
      const input = { name: 'Test', feature: {} };
      const result = createTagCategorySchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  // description field is optional string - no constraints to test


  describe('orderIndex field', () => {
    testNumberConstraints(createTagCategorySchema, 'orderIndex', { ...validInput, orderIndex: 0 }, {
      isInteger: true,
    });

    it('accepts positive orderIndex', () => {
      const input = { ...validInput, orderIndex: 10 };
      const result = createTagCategorySchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts zero orderIndex', () => {
      const input = { ...validInput, orderIndex: 0 };
      const result = createTagCategorySchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts negative orderIndex', () => {
      const input = { ...validInput, orderIndex: -1 };
      const result = createTagCategorySchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('default values', () => {
    testDefaultValues(
      createTagCategorySchema,
      { orderIndex: 0 },
      { name: 'Test', feature: {} }
    );
  });

  describe('feature field', () => {
    it('accepts valid feature object', () => {
      const input = { name: 'Test', feature: { enabled: true } };
      const result = createTagCategorySchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts missing feature (optional)', () => {
      const input = { name: 'Test' };
      const result = createTagCategorySchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: createTagCategorySchema,
      validCases: [
        {
          input: { name: 'Minimal Category' },
          description: 'minimal required fields',
        },
        {
          input: { name: 'Root Category', parentId: null, feature: {} },
          description: 'root category with null parentId',
        },
        {
          input: validInput,
          description: 'all fields populated',
        },
      ],
      invalidCases: [
        {
          input: { feature: {} },
          description: 'missing name',
        },
        {
          input: {},
          description: 'missing name',
        },
      ],
    });
  });
});
