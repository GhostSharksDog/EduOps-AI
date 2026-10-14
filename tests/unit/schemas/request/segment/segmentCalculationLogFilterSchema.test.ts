import { describe, it, expect } from 'vitest';
import { segmentCalculationLogFilterSchema } from '@/modules/segment/contracts/schemas/request/segment/segmentCalculationLogFilterSchema';
import {
  testSchema,
  testDefaultValues,
  testUUIDValidation,
} from '../../../../helpers/schema-test-utils';

describe('segmentCalculationLogFilterSchema', () => {
  describe('schema structure', () => {
    it('allows empty object (all fields optional)', () => {
      const result = segmentCalculationLogFilterSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('default values', () => {
    testDefaultValues(segmentCalculationLogFilterSchema, { page: 1, pageSize: 20 }, {});
  });

  describe('segmentId field', () => {
    it('accepts valid segmentId', () => {
      const result = segmentCalculationLogFilterSchema.safeParse({ segmentId: '123e4567-e89b-12d3-a456-426614174000' });
      expect(result.success).toBe(true);
    });
    it('rejects invalid segmentId format', () => {
      const result = segmentCalculationLogFilterSchema.safeParse({ segmentId: 'invalid-uuid' });
      expect(result.success).toBe(false);
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: segmentCalculationLogFilterSchema,
      validCases: [
        {
          input: {},
          description: 'empty object (all fields optional)',
        },
        {
          input: { segmentId: '123e4567-e89b-12d3-a456-426614174000' },
          description: 'with segmentId',
        },
        {
          input: { segmentId: '123e4567-e89b-12d3-a456-426614174000', page: 2, pageSize: 50 },
          description: 'with pagination',
        },
      ],
      invalidCases: [
        {
          input: { segmentId: 'invalid-uuid' },
          description: 'invalid segmentId format',
        },
      ],
    });
  });
});
