import { describe, it, expect } from 'vitest';
import { deleteDataModelResponseSchema } from '@/modules/data/contracts/schemas/response/data-model/deleteDataModelResponseSchema';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testStringConstraints,
  testBooleanValidation,
} from '../../../../helpers/schema-test-utils';

describe('deleteDataModelResponseSchema', () => {
  const validInput = {
    success: true,
    message: 'Data model deleted successfully',
  };

  describe('schema structure', () => {
    testStrictObject(deleteDataModelResponseSchema, validInput);
  });

  describe('success field', () => {
    testRequiredFields(deleteDataModelResponseSchema, ['success'], validInput);
    testBooleanValidation(deleteDataModelResponseSchema, 'success', validInput);

    it('accepts true for success', () => {
      const input = { ...validInput, success: true };
      const result = deleteDataModelResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts false for success', () => {
      const input = { ...validInput, success: false };
      const result = deleteDataModelResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects string for success', () => {
      const input = { ...validInput, success: 'true' };
      const result = deleteDataModelResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects number for success', () => {
      const input = { ...validInput, success: 1 };
      const result = deleteDataModelResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('message field', () => {
    testRequiredFields(deleteDataModelResponseSchema, ['message'], validInput);

    // Note: schema uses z.string().trim() without min(1), so empty strings pass after trimming
    it('trims whitespace from message', () => {
      const input = { ...validInput, message: '  Success message  ' };
      const result = deleteDataModelResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toBe('Success message');
      }
    });

    it('accepts empty string after trimming (whitespace only)', () => {
      const input = { ...validInput, message: '   ' };
      const result = deleteDataModelResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts various message types', () => {
      const messages = [
        'Data model deleted successfully',
        'Failed to delete data model',
        'Data model not found',
        'Permission denied',
      ];

      messages.forEach((message) => {
        const input = { ...validInput, message };
        const result = deleteDataModelResponseSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('response patterns', () => {
    it('accepts successful deletion response', () => {
      const input = {
        success: true,
        message: 'Data model deleted successfully',
      };
      const result = deleteDataModelResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(true);
        expect(result.data.message).toBe('Data model deleted successfully');
      }
    });

    it('accepts failure response - not found', () => {
      const input = {
        success: false,
        message: 'Data model not found',
      };
      const result = deleteDataModelResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(false);
        expect(result.data.message).toBe('Data model not found');
      }
    });

    it('accepts failure response - permission denied', () => {
      const input = {
        success: false,
        message: 'Permission denied',
      };
      const result = deleteDataModelResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(false);
        expect(result.data.message).toBe('Permission denied');
      }
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: deleteDataModelResponseSchema,
      validCases: [
        {
          input: {
            success: true,
            message: 'Deleted successfully',
          },
          description: 'successful deletion',
        },
        {
          input: {
            success: false,
            message: 'Not found',
          },
          description: 'not found error',
        },
        {
          input: {
            success: false,
            message: 'Permission denied',
          },
          description: 'permission error',
        },
        {
          input: {
            success: true,
            message: 'Operation completed',
          },
          description: 'generic success',
        },
      ],
      invalidCases: [
        {
          input: { message: 'Deleted' },
          description: 'missing success',
        },
        {
          input: { success: true },
          description: 'missing message',
        },
        {
          input: { success: 'true', message: 'Test' },
          description: 'success as string',
        },
        {
          input: { success: 1, message: 'Test' },
          description: 'success as number',
        },
        {
          input: { success: false, message: 123 },
          description: 'message as number',
        },
      ],
    });
  });
});
