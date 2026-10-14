import { describe, it, expect } from 'vitest';
import { setCurrentVersionSchema } from '@/modules/tag/contracts/schemas/request/tag/setCurrentVersionSchema';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testUUIDValidation,
} from '../../../../helpers/schema-test-utils';

describe('setCurrentVersionSchema', () => {
  const validInput = {
    versionId: '123e4567-e89b-12d3-a456-426614174001',
  };

  describe('schema structure', () => {
    testStrictObject(setCurrentVersionSchema, validInput);
  });

  describe('required fields', () => {
    testRequiredFields(setCurrentVersionSchema, ['versionId'], validInput);
  });

  describe('tagId field', () => {
    it('tagId 来自路径，拒绝正文中的 tagId', () => {
      expect(setCurrentVersionSchema.safeParse({ ...validInput, tagId: '123e4567-e89b-12d3-a456-426614174000' }).success).toBe(false);
    });
  });

  describe('versionId field', () => {
    testUUIDValidation(setCurrentVersionSchema, 'versionId', validInput);
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: setCurrentVersionSchema,
      validCases: [
        {
          input: validInput,
          description: 'valid tagId and versionId',
        },
      ],
      invalidCases: [
        {
          input: { versionId: '' },
          description: 'empty versionId',
        },
        {
          input: { tagId: '123e4567-e89b-12d3-a456-426614174000' },
          description: 'missing versionId',
        },
        {
          input: { tagId: 'invalid-uuid', versionId: '123e4567-e89b-12d3-a456-426614174001' },
          description: 'invalid tagId format',
        },
        {
          input: { tagId: '123e4567-e89b-12d3-a456-426614174000', versionId: 'invalid-uuid' },
          description: 'invalid versionId format',
        },
        {
          input: { tagId: '123e4567-e89b-12d3-a456-426614174000', versionId: '123e4567-e89b-12d3-a456-426614174001', extra: 'field' },
          description: 'extra field rejected by strictObject',
        },
      ],
    });
  });
});
