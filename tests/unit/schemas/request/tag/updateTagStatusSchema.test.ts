import { describe, it, expect } from 'vitest';
import { updateTagStatusSchema } from '@/modules/tag/contracts/schemas/request/tag/updateTagStatusSchema';
import { TagStatus } from '@/shared/enums/tag/TagStatus';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testUUIDValidation,
  testEnumValidation,
} from '../../../../helpers/schema-test-utils';

describe('updateTagStatusSchema', () => {
  const validInput = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    status: TagStatus.ACTIVE,
  };

  describe('schema structure', () => {
    testStrictObject(updateTagStatusSchema, validInput);
  });

  describe('required fields', () => {
    testRequiredFields(updateTagStatusSchema, ['id', 'status'], validInput);
  });

  describe('id field', () => {
    testUUIDValidation(updateTagStatusSchema, 'id', validInput);
  });

  describe('status field', () => {
    testEnumValidation(updateTagStatusSchema, 'status', Object.values(TagStatus), validInput);
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: updateTagStatusSchema,
      validCases: [
        {
          input: { id: '123e4567-e89b-12d3-a456-426614174000', status: TagStatus.ACTIVE },
          description: 'ACTIVE status',
        },
        {
          input: { id: '123e4567-e89b-12d3-a456-426614174000', status: TagStatus.INACTIVE },
          description: 'INACTIVE status',
        },
        {
          input: { id: '123e4567-e89b-12d3-a456-426614174000', status: TagStatus.DRAFT },
          description: 'DRAFT status',
        },
      ],
      invalidCases: [
        {
          input: { status: TagStatus.ACTIVE },
          description: 'missing id',
        },
        {
          input: { id: '123e4567-e89b-12d3-a456-426614174000' },
          description: 'missing status',
        },
        {
          input: { id: 'invalid-uuid', status: TagStatus.ACTIVE },
          description: 'invalid id format',
        },
        {
          input: { id: '123e4567-e89b-12d3-a456-426614174000', status: 'INVALID' },
          description: 'invalid status enum',
        },
        {
          input: { id: '123e4567-e89b-12d3-a456-426614174000', status: TagStatus.ACTIVE, extra: 'field' },
          description: 'extra field rejected',
        },
      ],
    });
  });
});
