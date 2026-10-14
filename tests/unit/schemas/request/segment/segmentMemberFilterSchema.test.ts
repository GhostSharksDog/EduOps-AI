import { describe, it, expect } from 'vitest';
import { segmentMemberFilterSchema } from '@/modules/segment/contracts/schemas/request/segment/segmentMemberFilterSchema';
import { SegmentType } from '@/shared/enums/segment/SegmentType';
import {
  testSchema,
  testStrictObject,
  testOptionalFields,
  testEnumValidation,
} from '../../../../helpers/schema-test-utils';

describe('segmentMemberFilterSchema', () => {
  const validInput = {
    memberType: SegmentType.USER,
    joinedAfter: '2024-01-01',
    joinedBefore: '2024-12-31',
  };

  describe('schema structure', () => {
    testStrictObject(segmentMemberFilterSchema, validInput);
  });

  describe('all fields optional', () => {
    testOptionalFields(
      segmentMemberFilterSchema,
      ['memberType', 'joinedAfter', 'joinedBefore'],
      validInput
    );
  });

  describe('memberType field', () => {
    testEnumValidation(segmentMemberFilterSchema, 'memberType', Object.values(SegmentType), validInput);
  });

  describe('joinedAfter field', () => {
    it('accepts ISO date string', () => {
      const result = segmentMemberFilterSchema.safeParse({ joinedAfter: '2024-01-01' });
      expect(result.success).toBe(true);
    });

    it('accepts Date object', () => {
      const result = segmentMemberFilterSchema.safeParse({ joinedAfter: new Date('2024-01-01') });
      expect(result.success).toBe(true);
    });

    it('coerces string to Date', () => {
      const result = segmentMemberFilterSchema.safeParse({ joinedAfter: '2024-01-01' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.joinedAfter).toBeInstanceOf(Date);
      }
    });
  });

  describe('joinedBefore field', () => {
    it('accepts ISO date string', () => {
      const result = segmentMemberFilterSchema.safeParse({ joinedBefore: '2024-12-31' });
      expect(result.success).toBe(true);
    });

    it('coerces string to Date', () => {
      const result = segmentMemberFilterSchema.safeParse({ joinedBefore: '2024-12-31' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.joinedBefore).toBeInstanceOf(Date);
      }
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: segmentMemberFilterSchema,
      validCases: [
        {
          input: {},
          description: 'empty object - all optional',
        },
        {
          input: { memberType: SegmentType.USER },
          description: 'only memberType',
        },
        {
          input: { joinedAfter: '2024-01-01', joinedBefore: '2024-12-31' },
          description: 'date range only',
        },
        {
          input: validInput,
          description: 'all fields',
        },
      ],
      invalidCases: [
        {
          input: { memberType: 'INVALID' },
          description: 'invalid memberType enum',
        },
        {
          input: { ...validInput, extra: 'field' },
          description: 'extra field rejected',
        },
      ],
    });
  });
});
