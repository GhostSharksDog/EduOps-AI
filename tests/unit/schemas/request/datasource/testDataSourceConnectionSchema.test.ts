import { describe, it, expect } from 'vitest';
import { testDataSourceConnectionSchema } from '@/modules/data/contracts/schemas/request/datasource/testDataSourceConnectionSchema';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testUUIDValidation,
} from '../../../../helpers/schema-test-utils';

describe('testDataSourceConnectionSchema', () => {
  const validInput = {
    id: '123e4567-e89b-12d3-a456-426614174000',
  };

  describe('schema structure', () => {
    testStrictObject(testDataSourceConnectionSchema, validInput);
  });

  describe('required fields', () => {
    testRequiredFields(testDataSourceConnectionSchema, ['id'], validInput);
  });

  describe('id field', () => {
    testUUIDValidation(testDataSourceConnectionSchema, 'id', validInput);
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: testDataSourceConnectionSchema,
      validCases: [
        {
          input: validInput,
          description: 'valid UUID id',
        },
      ],
      invalidCases: [
        {
          input: {},
          description: 'missing id',
        },
        {
          input: { id: 'invalid-uuid' },
          description: 'invalid id format',
        },
        {
          input: { id: 123 },
          description: 'id is not a string',
        },
        {
          input: { ...validInput, extra: 'field' },
          description: 'extra field rejected',
        },
      ],
    });
  });
});
