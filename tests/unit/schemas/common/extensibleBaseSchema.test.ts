import { describe, it, expect } from 'vitest';
import { extensibleBaseSchema } from '@/shared/schemas/common/baseSchema';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testOptionalFields,
  testUUIDValidation,
  testStringConstraints,
} from '../../../helpers/schema-test-utils';

describe('extensibleBaseSchema', () => {
  const validExtensibleInput = {
    // Base fields
    id: '123e4567-e89b-12d3-a456-426614174000',
    ownedBy: '123e4567-e89b-12d3-a456-426614174001',
    isDeleted: false,
    createTime: '2024-01-01T00:00:00Z',
    // Extensible fields
    description: 'Test description',
    feature: { custom: 'data', nested: { value: 123 } },
  };

  describe('valid inputs', () => {
    testSchema({
      schema: extensibleBaseSchema,
      validCases: [
        { input: validExtensibleInput, description: 'complete valid input with all fields' },
        {
          input: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            ownedBy: '123e4567-e89b-12d3-a456-426614174001',
            isDeleted: false,
            createTime: '2024-01-01T00:00:00Z',
          },
          description: 'valid input without extensible fields (uses defaults)',
        },
        {
          input: {
            ...validExtensibleInput,
            feature: null,
          },
          description: 'valid input with null feature',
        },
        {
          input: {
            ...validExtensibleInput,
            feature: 'string feature',
          },
          description: 'valid input with string feature',
        },
        {
          input: {
            ...validExtensibleInput,
            feature: 123,
          },
          description: 'valid input with number feature',
        },
        {
          input: {
            ...validExtensibleInput,
            feature: true,
          },
          description: 'valid input with boolean feature',
        },
        {
          input: {
            ...validExtensibleInput,
            feature: ['array', 'of', 'values'],
          },
          description: 'valid input with array feature',
        },
      ],
      invalidCases: [],
    });
  });

  describe('inherited required fields from baseSchema', () => {
    testRequiredFields(
      extensibleBaseSchema,
      ['id', 'isDeleted', 'createTime'],
      validExtensibleInput
    );
  });

  describe('optional fields', () => {
    testOptionalFields(
      extensibleBaseSchema,
      ['updateTime', 'deleteTime', 'createdBy', 'updatedBy', 'deletedBy', 'description', 'feature'],
      validExtensibleInput
    );
  });

  describe('description field', () => {
    it('allows empty string after trimming', () => {
      const input = { ...validExtensibleInput, description: '' };
      const result = extensibleBaseSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe('');
      }
    });

    it('trims whitespace from description', () => {
      const input = { ...validExtensibleInput, description: '  trimmed  ' };
      const result = extensibleBaseSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe('trimmed');
      }
    });

    it('accepts empty string after trimming', () => {
      const input = { ...validExtensibleInput, description: '' };
      const result = extensibleBaseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('feature field - JSON value validation', () => {
    it('accepts string feature', () => {
      const input = { ...validExtensibleInput, feature: 'test string' };
      const result = extensibleBaseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts number feature', () => {
      const input = { ...validExtensibleInput, feature: 42 };
      const result = extensibleBaseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts boolean feature', () => {
      const input = { ...validExtensibleInput, feature: true };
      const result = extensibleBaseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts null feature', () => {
      const input = { ...validExtensibleInput, feature: null };
      const result = extensibleBaseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts array feature', () => {
      const input = { ...validExtensibleInput, feature: [1, 2, 3] };
      const result = extensibleBaseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts nested array feature', () => {
      const input = { ...validExtensibleInput, feature: [[1, 2], [3, 4]] };
      const result = extensibleBaseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts object feature', () => {
      const input = { ...validExtensibleInput, feature: { key: 'value' } };
      const result = extensibleBaseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts deeply nested object feature', () => {
      const input = {
        ...validExtensibleInput,
        feature: {
          level1: {
            level2: {
              level3: { value: 'deep' },
            },
          },
        },
      };
      const result = extensibleBaseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts complex mixed feature', () => {
      const input = {
        ...validExtensibleInput,
        feature: {
          string: 'text',
          number: 123,
          boolean: true,
          null: null,
          array: [1, 'two', { three: 3 }],
          nested: { deep: { value: 'here' } },
        },
      };
      const result = extensibleBaseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('UUID validation for inherited fields', () => {
    testUUIDValidation(extensibleBaseSchema, 'id', validExtensibleInput);
    testUUIDValidation(extensibleBaseSchema, 'ownedBy', validExtensibleInput);
    testUUIDValidation(extensibleBaseSchema, 'createdBy', {
      ...validExtensibleInput,
      createdBy: '123e4567-e89b-12d3-a456-426614174002',
    });
  });

  describe('ISO datetime validation for inherited fields', () => {
    it('accepts valid ISO datetime for createTime', () => {
      const input = { ...validExtensibleInput, createTime: '2024-12-31T23:59:59.999Z' };
      const result = extensibleBaseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects invalid datetime format for createTime', () => {
      const input = { ...validExtensibleInput, createTime: '2024-01-01' };
      const result = extensibleBaseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('accepts valid ISO datetime for updateTime', () => {
      const input = { ...validExtensibleInput, updateTime: '2024-12-31T23:59:59.999Z' };
      const result = extensibleBaseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('boolean validation for inherited isDeleted', () => {
    it('accepts true for isDeleted', () => {
      const input = { ...validExtensibleInput, isDeleted: true };
      const result = extensibleBaseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts false for isDeleted', () => {
      const input = { ...validExtensibleInput, isDeleted: false };
      const result = extensibleBaseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('strict object validation', () => {
    testStrictObject(extensibleBaseSchema, validExtensibleInput);
  });

  describe('type inference', () => {
    it('infers correct type for extensibleBaseSchema', () => {
      const result = extensibleBaseSchema.safeParse(validExtensibleInput);
      expect(result.success).toBe(true);
      if (result.success) {
        // TypeScript type checking - should compile without errors
        const data = result.data;
        expect(typeof data.id).toBe('string');
        expect(typeof data.ownedBy).toBe('string');
        expect(typeof data.isDeleted).toBe('boolean');
        expect(typeof data.createTime).toBe('string');
        expect(data.description).toBeDefined();
        expect(data.feature).toBeDefined();
      }
    });
  });
});
