import { describe, it, expect } from 'vitest';
import { updateTagSchema } from '@/modules/tag/contracts/schemas/request/tag/updateTagSchema';
import { TagValueType } from '@/shared/enums/tag/TagValueType';
import { UpdateCycle } from '@/shared/enums/tag/UpdateCycle';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testOptionalFields,
  testStringConstraints,
  testEnumValidation,
  testUUIDValidation,
} from '../../../../helpers/schema-test-utils';

describe('updateTagSchema', () => {
  const validUpdateTagInput = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    categoryId: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Updated Tag',
    dataType: TagValueType.STRING,
    description: 'Updated description',
    isPublic: true,
    feature: { enabled: true },
  };

  describe('schema structure', () => {
    testStrictObject(updateTagSchema, validUpdateTagInput);
  });

  describe('required fields', () => {
    testRequiredFields(updateTagSchema, ['id', 'categoryId'], validUpdateTagInput);
  });

  describe('optional fields', () => {
    testOptionalFields(
      updateTagSchema,
      ['name', 'dataType', 'description', 'isPublic', 'updateCycle', 'rule', 'feature'],
      validUpdateTagInput
    );
  });

  describe('id field', () => {
    testUUIDValidation(updateTagSchema, 'id', validUpdateTagInput);
  });

  describe('categoryId field', () => {
    testUUIDValidation(updateTagSchema, 'categoryId', validUpdateTagInput);
  });

  describe('name field', () => {
    testStringConstraints(
      updateTagSchema,
      'name',
      { ...validUpdateTagInput, name: 'Updated Tag' },
      {
        minLength: 1,
        maxLength: 255,
        allowEmpty: false,
      }
    );

    it('trims whitespace from name', () => {
      const input = { ...validUpdateTagInput, name: '  Updated Tag  ' };
      const result = updateTagSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Updated Tag');
      }
    });
  });

  describe('dataType field', () => {
    testEnumValidation(updateTagSchema, 'dataType', Object.values(TagValueType), validUpdateTagInput);
  });

  describe('description field', () => {
    testStringConstraints(
      updateTagSchema,
      'description',
      { ...validUpdateTagInput, description: 'Updated description' },
      { allowEmpty: true }
    );

    it('trims whitespace from description', () => {
      const input = { ...validUpdateTagInput, description: '  Updated description  ' };
      const result = updateTagSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe('Updated description');
      }
    });
  });

  describe('updateCycle field', () => {
    testEnumValidation(updateTagSchema, 'updateCycle', Object.values(UpdateCycle), validUpdateTagInput);
  });

  describe('feature field', () => {
    it('accepts valid feature object', () => {
      const input = { ...validUpdateTagInput, feature: { enabled: true } };
      const result = updateTagSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts missing feature (optional)', () => {
      const input = { ...validUpdateTagInput } as any;
      delete input.feature;
      const result = updateTagSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: updateTagSchema,
      validCases: [
        {
          input: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            categoryId: '123e4567-e89b-12d3-a456-426614174001',
          },
          description: 'minimal required fields',
        },
        {
          input: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            categoryId: '123e4567-e89b-12d3-a456-426614174001',
            name: 'Full Update',
            dataType: TagValueType.NUMBER,
            description: 'Full description',
            isPublic: false,
            updateCycle: UpdateCycle.WEEKLY,
            feature: { enabled: false },
          },
          description: 'all fields populated',
        },
      ],
      invalidCases: [
        {
          input: { categoryId: '123e4567-e89b-12d3-a456-426614174001' },
          description: 'missing id',
        },
        {
          input: { id: '123e4567-e89b-12d3-a456-426614174000' },
          description: 'missing categoryId',
        },
        {
          input: {
            id: 'not-a-uuid',
            categoryId: '123e4567-e89b-12d3-a456-426614174001',
          },
          description: 'invalid id format',
        },
        {
          input: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            categoryId: 'not-a-uuid',
          },
          description: 'invalid categoryId format',
        },
      ],
    });
  });
});
