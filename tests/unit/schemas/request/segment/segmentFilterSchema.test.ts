import { describe, it, expect } from 'vitest';
import { segmentFilterSchema } from '@/modules/segment/contracts/schemas/request/segment/segmentFilterSchema';
import { SegmentType } from '@/shared/enums/segment/SegmentType';
import { SegmentStatus } from '@/shared/enums/segment/SegmentStatus';
import { SegmentCalculationType } from '@/shared/enums/segment/SegmentCalculationType';
import {
  testSchema,
  testStrictObject,
  testOptionalFields,
  testDefaultValues,
  testUUIDValidation,
  testEnumValidation,
} from '../../../../helpers/schema-test-utils';

describe('segmentFilterSchema', () => {
  const validInput = {
    page: 1,
    pageSize: 10,
  };

  describe('schema structure', () => {
    testStrictObject(segmentFilterSchema, validInput);
  });

  describe('all fields optional', () => {
    testOptionalFields(
      segmentFilterSchema,
      ['id', 'page', 'pageSize', 'name', 'type', 'status', 'calculationType', 'createdBy', 'ownedBy', 'businessOwner'],
      validInput
    );
  });

  describe('default values', () => {
    testDefaultValues(segmentFilterSchema, { page: 1, pageSize: 20 }, {});
  });

  describe('id field', () => {
    testUUIDValidation(segmentFilterSchema, 'id', validInput);
  });

  describe('page field', () => {
    it('accepts page >= 1', () => {
      const result = segmentFilterSchema.safeParse({ page: 1 });
      expect(result.success).toBe(true);
    });

    it('rejects page < 1', () => {
      const result = segmentFilterSchema.safeParse({ page: 0 });
      expect(result.success).toBe(false);
    });
  });

  describe('type field', () => {
    testEnumValidation(segmentFilterSchema, 'type', Object.values(SegmentType), validInput);
  });

  describe('status field', () => {
    testEnumValidation(segmentFilterSchema, 'status', Object.values(SegmentStatus), validInput);
  });

  describe('calculationType field', () => {
    testEnumValidation(segmentFilterSchema, 'calculationType', Object.values(SegmentCalculationType), validInput);
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: segmentFilterSchema,
      validCases: [
        {
          input: {},
          description: 'empty object - uses defaults',
        },
        {
          input: { page: 2, pageSize: 20 },
          description: 'custom pagination',
        },
        {
          input: { name: 'Test Segment', status: SegmentStatus.ACTIVE },
          description: 'filter by name and status',
        },
      ],
      invalidCases: [
        {
          input: { page: 0 },
          description: 'page < 1',
        },
        {
          input: { pageSize: 0 },
          description: 'pageSize < 1',
        },
        {
          input: { type: 'INVALID' },
          description: 'invalid type enum',
        },
        {
          input: { status: 'INVALID' },
          description: 'invalid status enum',
        },
        {
          input: { ...validInput, extra: 'field' },
          description: 'extra field rejected',
        },
      ],
    });
  });
});
