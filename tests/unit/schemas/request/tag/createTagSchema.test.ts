import { describe, it, expect } from 'vitest';
import { createTagSchema } from '@/modules/tag/contracts/schemas/request/tag/createTagSchema';
import { TagValueType } from '@/shared/enums/tag/TagValueType';
import { UpdateCycle } from '@/shared/enums/tag/UpdateCycle';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testOptionalFields,
  testDefaultValues,
  testStringConstraints,
  testEnumValidation,
  testUUIDValidation,
} from '../../../../helpers/schema-test-utils';

describe('createTagSchema', () => {
  const validCreateTagInput = {
    name: 'Test Tag',
    dataType: TagValueType.STRING,
    categoryId: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Test description',
    isPublic: false,
    feature: { enabled: true },
  };

  describe('schema structure', () => {
    testStrictObject(createTagSchema, validCreateTagInput);
  });

  describe('required fields', () => {
    testRequiredFields(createTagSchema, ['name', 'dataType', 'categoryId'], validCreateTagInput);
  });

  describe('optional fields', () => {
    testOptionalFields(
      createTagSchema,
      ['description', 'ownedBy', 'updateCycle', 'rule', 'version', 'feature'],
      validCreateTagInput
    );
  });

  describe('default values', () => {
    testDefaultValues(
      createTagSchema,
      { isPublic: false },
      {
        name: 'Test Tag',
        dataType: TagValueType.STRING,
        categoryId: '123e4567-e89b-12d3-a456-426614174000',
      }
    );
  });

  describe('name field', () => {
    testStringConstraints(createTagSchema, 'name', { ...validCreateTagInput, name: 'Test Tag' }, {
      minLength: 1,
      maxLength: 255,
      allowEmpty: false,
    });

    it('trims whitespace from name', () => {
      const input = { ...validCreateTagInput, name: '  Test Tag  ' };
      const result = createTagSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Test Tag');
      }
    });
  });

  describe('dataType field', () => {
    testEnumValidation(createTagSchema, 'dataType', Object.values(TagValueType), validCreateTagInput);
  });

  describe('categoryId field', () => {
    testUUIDValidation(createTagSchema, 'categoryId', validCreateTagInput);
  });

  describe('description field', () => {
    testStringConstraints(
      createTagSchema,
      'description',
      { ...validCreateTagInput, description: 'Test description' },
      { allowEmpty: true }
    );

    it('trims whitespace from description', () => {
      const input = { ...validCreateTagInput, description: '  Test description  ' };
      const result = createTagSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe('Test description');
      }
    });
  });

  describe('ownedBy field', () => {
    testUUIDValidation(createTagSchema, 'ownedBy', validCreateTagInput);
  });

  describe('updateCycle field', () => {
    testEnumValidation(createTagSchema, 'updateCycle', Object.values(UpdateCycle), validCreateTagInput);
  });

  describe('version field', () => {
    it('accepts valid version object', () => {
      const input = {
        ...validCreateTagInput,
        version: {
          version: '1.0.0',
          description: 'Initial version',
        },
      };
      const result = createTagSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts version without description', () => {
      const input = {
        ...validCreateTagInput,
        version: {
          version: '1.0.0',
        },
      };
      const result = createTagSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('requires version field in version object', () => {
      const input = {
        ...validCreateTagInput,
        version: {
          description: 'Missing version',
        },
      };
      const result = createTagSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('trims version string', () => {
      const input = {
        ...validCreateTagInput,
        version: {
          version: '  1.0.0  ',
        },
      };
      const result = createTagSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success && result.data.version) {
        expect(result.data.version.version).toBe('1.0.0');
      }
    });
  });

  describe('feature field', () => {
    it('accepts valid feature object', () => {
      const input = { ...validCreateTagInput, feature: { enabled: true } };
      const result = createTagSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts missing feature (optional)', () => {
      const input = { ...validCreateTagInput } as any;
      delete input.feature;
      const result = createTagSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: createTagSchema,
      validCases: [
        {
          input: {
            name: 'Minimal Tag',
            dataType: TagValueType.STRING,
            categoryId: '123e4567-e89b-12d3-a456-426614174000',
          },
          description: 'minimal required fields',
        },
        {
          input: {
            name: 'Full Tag',
            dataType: TagValueType.NUMBER,
            categoryId: '123e4567-e89b-12d3-a456-426614174001',
            description: 'Full description',
            ownedBy: '123e4567-e89b-12d3-a456-426614174002',
            isPublic: true,
            updateCycle: UpdateCycle.DAILY,
            version: { version: '2.0.0', description: 'Version 2' },
            feature: { enabled: true },
          },
          description: 'all fields populated',
        },
      ],
      invalidCases: [
        {
          input: { dataType: TagValueType.STRING, categoryId: '123e4567-e89b-12d3-a456-426614174000' },
          description: 'missing name',
        },
        {
          input: { name: 'Tag', categoryId: '123e4567-e89b-12d3-a456-426614174000' },
          description: 'missing dataType',
        },
        {
          input: { name: 'Tag', dataType: TagValueType.STRING },
          description: 'missing categoryId',
        },
        {
          input: {
            name: 'Tag',
            dataType: 'INVALID_TYPE',
            categoryId: '123e4567-e89b-12d3-a456-426614174000',
          },
          description: 'invalid dataType enum value',
        },
      ],
    });
  });
});
