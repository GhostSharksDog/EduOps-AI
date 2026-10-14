import { describe, it, expect } from 'vitest';
import { segmentMetadataSchema } from '@/modules/segment/contracts/schemas/response/segment/segmentMetadataSchema';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testOptionalFields,
  testStringConstraints,
  testUUIDValidation,
  testISODateTimeValidation,
  testArrayValidation,
} from '../../../../helpers/schema-test-utils';

describe('segmentMetadataSchema', () => {
  const validMetadataInput = {
    createTime: '2024-12-31T23:59:59.999Z',
    createdBy: '123e4567-e89b-12d3-a456-426614174001',
    updateTime: '2024-12-31T23:59:59.999Z',
    updatedBy: '123e4567-e89b-12d3-a456-426614174002',
    deleteTime: '2024-12-31T23:59:59.999Z',
    deletedBy: '123e4567-e89b-12d3-a456-426614174003',
    description: 'Test description',
    tags: ['tag1', 'tag2'],
    businessOwner: '123e4567-e89b-12d3-a456-426614174004',
    technicalOwner: '123e4567-e89b-12d3-a456-426614174005',
    feature: { enabled: true },
  };

  describe('schema structure', () => {
    testStrictObject(segmentMetadataSchema, validMetadataInput);
  });

  describe('required fields', () => {
    describe('createTime field', () => {
      testRequiredFields(segmentMetadataSchema, ['createTime'], validMetadataInput);
      testISODateTimeValidation(segmentMetadataSchema, 'createTime', validMetadataInput);
    });
  });

  describe('optional fields', () => {
    describe('createdBy field', () => {
      testOptionalFields(segmentMetadataSchema, ['createdBy'], validMetadataInput);
      testUUIDValidation(segmentMetadataSchema, 'createdBy', validMetadataInput);
    });

    describe('updateTime field', () => {
      testOptionalFields(segmentMetadataSchema, ['updateTime'], validMetadataInput);
      testISODateTimeValidation(segmentMetadataSchema, 'updateTime', validMetadataInput);
    });

    describe('updatedBy field', () => {
      testOptionalFields(segmentMetadataSchema, ['updatedBy'], validMetadataInput);
      testUUIDValidation(segmentMetadataSchema, 'updatedBy', validMetadataInput);
    });

    describe('deleteTime field', () => {
      testOptionalFields(segmentMetadataSchema, ['deleteTime'], validMetadataInput);
      testISODateTimeValidation(segmentMetadataSchema, 'deleteTime', validMetadataInput);
    });

    describe('deletedBy field', () => {
      testOptionalFields(segmentMetadataSchema, ['deletedBy'], validMetadataInput);
      testUUIDValidation(segmentMetadataSchema, 'deletedBy', validMetadataInput);
    });

    describe('description field', () => {
      testOptionalFields(segmentMetadataSchema, ['description'], validMetadataInput);
      testStringConstraints(
        segmentMetadataSchema,
        'description',
        { ...validMetadataInput, description: 'Test' },
        { allowEmpty: true }
      );

      it('trims whitespace from description', () => {
        const input = { ...validMetadataInput, description: '  Test description  ' };
        const result = segmentMetadataSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.description).toBe('Test description');
        }
      });
    });

    describe('tags field', () => {
      testOptionalFields(segmentMetadataSchema, ['tags'], validMetadataInput);
      testArrayValidation(segmentMetadataSchema, 'tags', validMetadataInput);

      it('applies default value for tags', () => {
        const { tags, ...input } = validMetadataInput;
        const result = segmentMetadataSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.tags).toEqual([]);
        }
      });

      it('accepts array of trimmed strings', () => {
        const input = { ...validMetadataInput, tags: ['  tag1  ', 'tag2'] };
        const result = segmentMetadataSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.tags).toEqual(['tag1', 'tag2']);
        }
      });

      it('rejects array with non-string values', () => {
        const input = { ...validMetadataInput, tags: [1, 2, 3] };
        const result = segmentMetadataSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    describe('businessOwner field', () => {
      testOptionalFields(segmentMetadataSchema, ['businessOwner'], validMetadataInput);
      testUUIDValidation(segmentMetadataSchema, 'businessOwner', validMetadataInput);
    });

    describe('technicalOwner field', () => {
      testOptionalFields(segmentMetadataSchema, ['technicalOwner'], validMetadataInput);
      testUUIDValidation(segmentMetadataSchema, 'technicalOwner', validMetadataInput);
    });

    describe('feature field', () => {
      testOptionalFields(segmentMetadataSchema, ['feature'], validMetadataInput);

      it('accepts valid feature object', () => {
        const input = { ...validMetadataInput, feature: { enabled: true } };
        const result = segmentMetadataSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('accepts null feature', () => {
        const input = { ...validMetadataInput, feature: null };
        const result = segmentMetadataSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: segmentMetadataSchema,
      validCases: [
        {
          input: {
            createTime: '2024-12-31T23:59:59.999Z',
          },
          description: 'minimal required fields',
        },
        {
          input: validMetadataInput,
          description: 'all fields populated',
        },
        {
          input: {
            createTime: '2024-12-31T23:59:59.999Z',
            createdBy: '123e4567-e89b-12d3-a456-426614174001',
            tags: [],
          },
          description: 'with empty tags array',
        },
        {
          input: {
            createTime: '2024-12-31T23:59:59.999Z',
            description: 'Only description',
          },
          description: 'with only description',
        },
      ],
      invalidCases: [
        {
          input: { createdBy: '123e4567-e89b-12d3-a456-426614174001' },
          description: 'missing createTime',
        },
        {
          input: { createTime: 'invalid-date' },
          description: 'invalid createTime format',
        },
        {
          input: { createTime: '2024-01-01' },
          description: 'date-only format for createTime',
        },
        {
          input: { tags: 'not-an-array' },
          description: 'tags as string instead of array',
        },
      ],
    });
  });
});
