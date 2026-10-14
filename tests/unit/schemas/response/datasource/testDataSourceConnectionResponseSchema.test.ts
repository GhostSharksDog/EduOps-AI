import { describe, it, expect } from 'vitest';
import {
  testDataSourceConnectionResponseSchema,
  TestDataSourceConnectionResponseVO,
} from '@/modules/data/contracts/schemas/response/datasource/testDataSourceConnectionResponseSchema';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testOptionalFields,
  testBooleanValidation,
} from '../../../../helpers/schema-test-utils';

describe('testDataSourceConnectionResponseSchema', () => {
  const validInput = {
    success: true,
    message: 'Connection successful',
    details: {
      serverVersion: '8.0.33',
      connectionTime: 150,
    },
  };

  describe('schema structure', () => {
    testStrictObject(testDataSourceConnectionResponseSchema, validInput);
  });

  describe('required fields', () => {
    testRequiredFields(
      testDataSourceConnectionResponseSchema,
      ['success', 'message'],
      validInput
    );
  });

  describe('optional fields', () => {
    testOptionalFields(testDataSourceConnectionResponseSchema, ['details'], validInput);
  });

  describe('success field', () => {
    testBooleanValidation(testDataSourceConnectionResponseSchema, 'success', validInput);

    it('accepts success = true', () => {
      const input = { ...validInput, success: true };
      const result = testDataSourceConnectionResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts success = false', () => {
      const input = { ...validInput, success: false };
      const result = testDataSourceConnectionResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('message field', () => {
    it('accepts non-empty message', () => {
      const input = { ...validInput, message: 'Connection successful' };
      const result = testDataSourceConnectionResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts empty message', () => {
      const input = { ...validInput, message: '' };
      const result = testDataSourceConnectionResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts message with special characters', () => {
      const input = { ...validInput, message: 'Error: timeout after 30000ms (Code: ETIMEDOUT)' };
      const result = testDataSourceConnectionResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts multiline message', () => {
      const input = {
        ...validInput,
        message: 'Connection failed\nError details:\n- Host unreachable\n- Port closed',
      };
      const result = testDataSourceConnectionResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects message as number', () => {
      const input = { ...validInput, message: 123 };
      const result = testDataSourceConnectionResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects message as boolean', () => {
      const input = { ...validInput, message: true };
      const result = testDataSourceConnectionResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects message as null', () => {
      const input = { ...validInput, message: null };
      const result = testDataSourceConnectionResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects missing message field', () => {
      const input = { success: true };
      const result = testDataSourceConnectionResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('details field', () => {
    it('accepts details object when provided', () => {
      const input = {
        success: true,
        message: 'Success',
        details: { key: 'value' },
      };
      const result = testDataSourceConnectionResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts empty details object', () => {
      const input = { ...validInput, details: {} };
      const result = testDataSourceConnectionResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts undefined details', () => {
      const input = { success: true, message: 'Success' };
      const result = testDataSourceConnectionResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts details with nested objects', () => {
      const input = {
        success: true,
        message: 'Success',
        details: {
          serverInfo: {
            version: '8.0.33',
            engine: 'InnoDB',
          },
          timing: {
            connect: 50,
            query: 120,
          },
        },
      };
      const result = testDataSourceConnectionResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts details with arrays', () => {
      const input = {
        success: true,
        message: 'Success',
        details: {
          databases: ['db1', 'db2', 'db3'],
          errors: [],
        },
      };
      const result = testDataSourceConnectionResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts details with mixed types', () => {
      const input = {
        success: true,
        message: 'Success',
        details: {
          stringValue: 'test',
          numberValue: 123,
          booleanValue: true,
          nullValue: null,
          arrayValue: [1, 2, 3],
          objectValue: { nested: true },
        },
      };
      const result = testDataSourceConnectionResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects details as string', () => {
      const input = { ...validInput, details: 'not-an-object' };
      const result = testDataSourceConnectionResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects details as array only (not object)', () => {
      const input = { ...validInput, details: ['item1', 'item2'] };
      // z.record rejects arrays since they are not plain objects
      const result = testDataSourceConnectionResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects details as number', () => {
      const input = { ...validInput, details: 123 };
      const result = testDataSourceConnectionResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: testDataSourceConnectionResponseSchema,
      validCases: [
        {
          input: {
            success: true,
            message: 'Connection successful',
          },
          description: 'success with required fields only',
        },
        {
          input: {
            success: false,
            message: 'Connection failed: host unreachable',
          },
          description: 'failure with required fields only',
        },
        {
          input: validInput,
          description: 'success with details',
        },
        {
          input: {
            success: false,
            message: 'Connection failed',
            details: {
              errorCode: 'ECONNREFUSED',
              errno: 'ECONNREFUSED',
              syscall: 'connect',
              address: '127.0.0.1',
              port: 5432,
            },
          },
          description: 'failure with error details',
        },
        {
          input: {
            success: true,
            message: 'Connection successful',
            details: {},
          },
          description: 'success with empty details',
        },
        {
          input: {
            success: true,
            message: 'Connection successful',
            details: {
              serverVersion: '15.2',
              databaseList: ['postgres', 'testdb'],
              connectionId: 'abc123',
            },
          },
          description: 'success with complex details',
        },
      ],
      invalidCases: [
        {
          input: {
            message: 'Connection successful',
          },
          description: 'missing success field',
        },
        {
          input: {
            success: true,
          },
          description: 'missing message field',
        },
        {
          input: {
            success: 'true',
            message: 'Connection successful',
          },
          description: 'success as string instead of boolean',
        },
        {
          input: {
            success: 1,
            message: 'Connection successful',
          },
          description: 'success as number instead of boolean',
        },
        {
          input: {
            success: true,
            message: 123,
          },
          description: 'message as number instead of string',
        },
        {
          input: {
            success: true,
            message: 'Success',
            details: 'not-an-object',
          },
          description: 'details as string instead of object',
        },
      ],
    });
  });
});
