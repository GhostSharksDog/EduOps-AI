import { describe, it, expect } from 'vitest';
import { tagCountQuerySchema } from '@/modules/tag/contracts/schemas/request/tag/tagCountQuerySchema';
import { TagValueType } from '@/shared/enums/tag/TagValueType';
import { TagStatus } from '@/shared/enums/tag/TagStatus';
import {
  testSchema,
  testStrictObject,
  testOptionalFields,
  testUUIDValidation,
  testEnumValidation,
} from '../../../../helpers/schema-test-utils';

describe('tagCountQuerySchema', () => {
  const validInput = {
    valueType: TagValueType.STRING,
    categoryId: '123e4567-e89b-12d3-a456-426614174000',
    status: TagStatus.ACTIVE,
  };

  describe('schema structure', () => {
    testStrictObject(tagCountQuerySchema, validInput);
  });

  describe('all fields optional', () => {
    testOptionalFields(tagCountQuerySchema, ['valueType', 'categoryId', 'status'], validInput);
  });

  describe('valueType field', () => {
    testEnumValidation(tagCountQuerySchema, 'valueType', Object.values(TagValueType), validInput);

    it('accepts undefined valueType', () => {
      const input = { categoryId: validInput.categoryId };
      const result = tagCountQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('categoryId field', () => {
    testUUIDValidation(tagCountQuerySchema, 'categoryId', validInput);

    it('accepts undefined categoryId', () => {
      const input = { valueType: validInput.valueType };
      const result = tagCountQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('status field', () => {
    testEnumValidation(tagCountQuerySchema, 'status', Object.values(TagStatus), validInput);

    it('accepts undefined status', () => {
      const input = { valueType: validInput.valueType, categoryId: validInput.categoryId };
      const result = tagCountQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: tagCountQuerySchema,
      validCases: [
        {
          input: {},
          description: 'empty object - all fields optional',
        },
        {
          input: { valueType: TagValueType.NUMBER },
          description: 'only valueType',
        },
        {
          input: { categoryId: '123e4567-e89b-12d3-a456-426614174000' },
          description: 'only categoryId',
        },
        {
          input: { status: TagStatus.ACTIVE },
          description: 'only status',
        },
        {
          input: validInput,
          description: 'all fields populated',
        },
      ],
      invalidCases: [
        {
          input: { valueType: 'INVALID_TYPE' },
          description: 'invalid valueType enum',
        },
        {
          input: { status: 'INVALID_STATUS' },
          description: 'invalid status enum',
        },
        {
          input: { categoryId: 'invalid-uuid' },
          description: 'invalid categoryId format',
        },
        {
          input: { extra: 'field' },
          description: 'extra field rejected',
        },
      ],
    });
  });
});
