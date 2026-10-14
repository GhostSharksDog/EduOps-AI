import { describe, it, expect } from 'vitest';
import { updateTagCategorySchema } from '@/modules/tag/contracts/schemas/request/tag-category/updateTagCategorySchema';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testOptionalFields,
  testStringConstraints,
  testUUIDValidation,
  testNumberConstraints,
} from '../../../../helpers/schema-test-utils';

describe('updateTagCategorySchema', () => {
  const validInput = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Updated Category',
    parentId: '123e4567-e89b-12d3-a456-426614174001',
    description: 'Updated description',
    orderIndex: 5,
    feature: { enabled: true },
  };

  describe('schema structure', () => {
    testStrictObject(updateTagCategorySchema, validInput);
  });

  describe('required fields', () => {
    testRequiredFields(updateTagCategorySchema, ['id'], validInput);
  });

  describe('optional fields', () => {
    testOptionalFields(updateTagCategorySchema, ['name', 'parentId', 'description', 'orderIndex', 'feature'], validInput);
  });

  describe('id field', () => {
    testUUIDValidation(updateTagCategorySchema, 'id', validInput);
  });

  describe('name field', () => {
    testStringConstraints(updateTagCategorySchema, 'name', { ...validInput, name: 'Test' }, {
      minLength: 1,
      maxLength: 255,
      allowEmpty: false,
    });

    it('trims whitespace from name', () => {
      const input = { id: validInput.id, name: '  Test  ', feature: {} };
      const result = updateTagCategorySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Test');
      }
    });
  });

  describe('parentId field', () => {
    testUUIDValidation(updateTagCategorySchema, 'parentId', validInput);

    it('accepts null parentId', () => {
      const input = { id: validInput.id, parentId: null, feature: {} };
      const result = updateTagCategorySchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  // description field is optional string - no constraints to test

  describe('orderIndex field', () => {
    testNumberConstraints(updateTagCategorySchema, 'orderIndex', { ...validInput, orderIndex: 0 }, {
      isInteger: true,
    });
  });

  describe('feature field', () => {
    it('accepts valid feature object', () => {
      const input = { id: validInput.id, feature: { enabled: true } };
      const result = updateTagCategorySchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts missing feature (optional)', () => {
      const input = { id: validInput.id };
      const result = updateTagCategorySchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: updateTagCategorySchema,
      validCases: [
        {
          input: { id: '123e4567-e89b-12d3-a456-426614174000' },
          description: 'minimal required fields',
        },
        {
          input: { id: '123e4567-e89b-12d3-a456-426614174000', name: 'New Name' },
          description: 'only id and name',
        },
        {
          input: validInput,
          description: 'all fields populated',
        },
      ],
      invalidCases: [
        {
          input: { feature: {} },
          description: 'missing id',
        },
      ],
    });
  });
});
