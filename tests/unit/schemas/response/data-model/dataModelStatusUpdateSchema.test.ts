import { describe, it, expect } from 'vitest';
import { dataModelStatusUpdateSchema } from '@/modules/data/contracts/schemas/response/data-model/dataModelStatusUpdateSchema';
import { DataModelStatus } from '@/shared/enums/data-models/DataModelStatus';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testStringConstraints,
  testEnumValidation,
  testUUIDValidation,
} from '../../../../helpers/schema-test-utils';

describe('dataModelStatusUpdateSchema', () => {
  const validInput = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test DataModel',
    status: DataModelStatus.ACTIVE,
  };

  describe('schema structure', () => {
    testStrictObject(dataModelStatusUpdateSchema, validInput);
  });

  describe('id field', () => {
    testRequiredFields(dataModelStatusUpdateSchema, ['id'], validInput);
    testUUIDValidation(dataModelStatusUpdateSchema, 'id', validInput);

    it('validates UUID format with custom error message', () => {
      const input = { ...validInput, id: 'not-a-uuid' };
      const result = dataModelStatusUpdateSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('模型ID必须是有效的UUID');
      }
    });
  });

  describe('name field', () => {
    testRequiredFields(dataModelStatusUpdateSchema, ['name'], validInput);

    // Note: schema uses z.string().trim() without min(1), so empty strings pass after trimming
    it('trims whitespace from name', () => {
      const input = { ...validInput, name: '  Test DataModel  ' };
      const result = dataModelStatusUpdateSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Test DataModel');
      }
    });
  });

  describe('status field', () => {
    testRequiredFields(dataModelStatusUpdateSchema, ['status'], validInput);
    testEnumValidation(
      dataModelStatusUpdateSchema,
      'status',
      Object.values(DataModelStatus),
      validInput
    );

    it('accepts DRAFT status', () => {
      const input = { ...validInput, status: DataModelStatus.DRAFT };
      const result = dataModelStatusUpdateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts ACTIVE status', () => {
      const input = { ...validInput, status: DataModelStatus.ACTIVE };
      const result = dataModelStatusUpdateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts INACTIVE status', () => {
      const input = { ...validInput, status: DataModelStatus.INACTIVE };
      const result = dataModelStatusUpdateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects invalid status value', () => {
      const input = { ...validInput, status: 'INVALID_STATUS' };
      const result = dataModelStatusUpdateSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: dataModelStatusUpdateSchema,
      validCases: [
        {
          input: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Model 1',
            status: DataModelStatus.DRAFT,
          },
          description: 'draft status',
        },
        {
          input: {
            id: '123e4567-e89b-12d3-a456-426614174001',
            name: 'Model 2',
            status: DataModelStatus.ACTIVE,
          },
          description: 'active status',
        },
        {
          input: {
            id: '123e4567-e89b-12d3-a456-426614174002',
            name: 'Model 3',
            status: DataModelStatus.INACTIVE,
          },
          description: 'inactive status',
        },
      ],
      invalidCases: [
        {
          input: { name: 'Test', status: DataModelStatus.ACTIVE },
          description: 'missing id',
        },
        {
          input: { id: '123e4567-e89b-12d3-a456-426614174000', status: DataModelStatus.ACTIVE },
          description: 'missing name',
        },
        {
          input: { id: '123e4567-e89b-12d3-a456-426614174000', name: 'Test' },
          description: 'missing status',
        },
        {
          input: {
            id: 'not-a-uuid',
            name: 'Test',
            status: DataModelStatus.ACTIVE,
          },
          description: 'invalid id format',
        },
        {
          input: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Test',
            status: 'INVALID',
          },
          description: 'invalid status value',
        },
      ],
    });
  });
});
