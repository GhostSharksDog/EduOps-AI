import { describe, it, expect } from 'vitest';
import { baseSchema } from '@/shared/schemas/common/baseSchema';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testOptionalFields,
  testUUIDValidation,
} from '../../../helpers/schema-test-utils';

describe('baseSchema', () => {
  const validBaseInput = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    ownedBy: '123e4567-e89b-12d3-a456-426614174001',
    isDeleted: false,
    createTime: '2024-01-01T00:00:00Z',
  };

  describe('valid inputs', () => {
    testSchema({
      schema: baseSchema,
      validCases: [
        { input: validBaseInput, description: 'minimal valid input with required fields' },
        {
          input: {
            ...validBaseInput,
            updateTime: '2024-01-02T00:00:00Z',
            deleteTime: '2024-01-03T00:00:00Z',
            createdBy: '123e4567-e89b-12d3-a456-426614174002',
            updatedBy: '123e4567-e89b-12d3-a456-426614174003',
            deletedBy: '123e4567-e89b-12d3-a456-426614174004',
          },
          description: 'valid input with all optional fields',
        },
      ],
      invalidCases: [],
    });
  });

  describe('required fields', () => {
    testRequiredFields(baseSchema, ['id', 'isDeleted', 'createTime'], validBaseInput);
  });

  describe('optional fields', () => {
    testOptionalFields(
      baseSchema,
      ['updateTime', 'deleteTime', 'createdBy', 'updatedBy', 'deletedBy'],
      validBaseInput
    );
  });

  describe('UUID validation', () => {
    testUUIDValidation(baseSchema, 'id', validBaseInput);
    testUUIDValidation(baseSchema, 'ownedBy', validBaseInput);
    testUUIDValidation(baseSchema, 'createdBy', { ...validBaseInput, createdBy: '123e4567-e89b-12d3-a456-426614174002' });
    testUUIDValidation(baseSchema, 'updatedBy', { ...validBaseInput, updatedBy: '123e4567-e89b-12d3-a456-426614174003' });
    testUUIDValidation(baseSchema, 'deletedBy', { ...validBaseInput, deletedBy: '123e4567-e89b-12d3-a456-426614174004' });
  });

  describe('ISO datetime validation', () => {
    it('accepts valid ISO datetime for createTime', () => {
      const input = { ...validBaseInput, createTime: '2024-12-31T23:59:59.999Z' };
      const result = baseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects invalid datetime format for createTime', () => {
      const input = { ...validBaseInput, createTime: '2024-01-01' };
      const result = baseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('accepts valid ISO datetime for updateTime', () => {
      const input = { ...validBaseInput, updateTime: '2024-12-31T23:59:59.999Z' };
      const result = baseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects invalid datetime format for updateTime', () => {
      const input = { ...validBaseInput, updateTime: 'not-a-datetime' };
      const result = baseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('boolean validation', () => {
    it('accepts true for isDeleted', () => {
      const input = { ...validBaseInput, isDeleted: true };
      const result = baseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts false for isDeleted', () => {
      const input = { ...validBaseInput, isDeleted: false };
      const result = baseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects string for isDeleted', () => {
      const input = { ...validBaseInput, isDeleted: 'true' };
      const result = baseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects number for isDeleted', () => {
      const input = { ...validBaseInput, isDeleted: 1 };
      const result = baseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('strict object validation', () => {
    testStrictObject(baseSchema, validBaseInput);
  });

  describe('Chinese error messages', () => {
    it('provides Chinese error message for invalid id UUID', () => {
      const result = baseSchema.safeParse({ ...validBaseInput, id: 'invalid' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('ID');
      }
    });

    it('provides Chinese error message for invalid ownedBy UUID', () => {
      const result = baseSchema.safeParse({ ...validBaseInput, ownedBy: 'invalid' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('UUID');
      }
    });

    it('provides Chinese error message for invalid createTime datetime', () => {
      const result = baseSchema.safeParse({ ...validBaseInput, createTime: 'invalid' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('时间');
      }
    });
  });
});
