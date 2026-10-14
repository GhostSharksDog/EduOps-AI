import { describe, it, expect } from 'vitest';
import { moveTagCategorySchema } from '@/modules/tag/contracts/schemas/request/tag-category/moveTagCategorySchema';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testUUIDValidation,
} from '../../../../helpers/schema-test-utils';

describe('moveTagCategorySchema', () => {
  const validInput = {
    categoryId: '123e4567-e89b-12d3-a456-426614174000',
    newParentId: '123e4567-e89b-12d3-a456-426614174001',
  };

  describe('schema structure', () => {
    testStrictObject(moveTagCategorySchema, validInput);
  });

  describe('required fields', () => {
    testRequiredFields(moveTagCategorySchema, ['categoryId', 'newParentId'], validInput);
  });

  describe('categoryId field', () => {
    testUUIDValidation(moveTagCategorySchema, 'categoryId', validInput);
  });

  describe('newParentId field', () => {
    testUUIDValidation(moveTagCategorySchema, 'newParentId', validInput);
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: moveTagCategorySchema,
      validCases: [
        {
          input: validInput,
          description: 'valid categoryId and newParentId',
        },
      ],
      invalidCases: [
        {
          input: { newParentId: '123e4567-e89b-12d3-a456-426614174001' },
          description: 'missing categoryId',
        },
        {
          input: { categoryId: '123e4567-e89b-12d3-a456-426614174000' },
          description: 'missing newParentId',
        },
        {
          input: { categoryId: 'invalid-uuid', newParentId: '123e4567-e89b-12d3-a456-426614174001' },
          description: 'invalid categoryId format',
        },
        {
          input: { categoryId: '123e4567-e89b-12d3-a456-426614174000', newParentId: 'invalid-uuid' },
          description: 'invalid newParentId format',
        },
        {
          input: { ...validInput, extra: 'field' },
          description: 'extra field rejected',
        },
      ],
    });
  });
});
