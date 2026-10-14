import { describe, it, expect } from 'vitest';
import { segmentSchema } from '@/modules/segment/contracts/schemas/response/segment/segmentSchema';
import { SegmentStatus, SegmentType, SegmentCalculationType } from '@/shared/enums/index';
import {
  testSchema,
  testStrictObject,
  testRequiredFields,
  testOptionalFields,
  testStringConstraints,
  testEnumValidation,
  testUUIDValidation,
  testISODateTimeValidation,
  testBooleanValidation,
  testArrayValidation,
  testNumberConstraints,
} from '../../../../helpers/schema-test-utils';

describe('segmentSchema', () => {
  const validSegmentInput = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Segment',
    description: 'Test segment description',
    entityType: SegmentType.USER,
    computeType: SegmentCalculationType.REALTIME,
    status: SegmentStatus.ACTIVE,
    scheduleConfig: { cron: '0 * * * *' },
    lastCalculationTime: '2024-12-31T23:59:59.999Z',
    feature: { enabled: true },
    conditionGroup: null,
    rules: [],
    statistics: null,
    memberCount: 100,
    nextCalculationTime: '2025-01-01T00:00:00.000Z',
    ownedBy: '123e4567-e89b-12d3-a456-426614174001',
    isDeleted: false,
    createTime: '2024-12-31T23:59:59.999Z',
    updateTime: '2024-12-31T23:59:59.999Z',
    deleteTime: undefined,
    createdBy: '123e4567-e89b-12d3-a456-426614174002',
    updatedBy: '123e4567-e89b-12d3-a456-426614174003',
    deletedBy: undefined,
  };

  describe('schema structure', () => {
    testStrictObject(segmentSchema, validSegmentInput);
  });

  describe('base schema fields', () => {
    describe('id field', () => {
      testUUIDValidation(segmentSchema, 'id', validSegmentInput);
    });

    describe('ownedBy field', () => {
      testUUIDValidation(segmentSchema, 'ownedBy', validSegmentInput);
    });

    describe('isDeleted field', () => {
      testBooleanValidation(segmentSchema, 'isDeleted', validSegmentInput);
    });

    describe('createTime field', () => {
      testISODateTimeValidation(segmentSchema, 'createTime', validSegmentInput);
    });

    describe('updateTime field', () => {
      testISODateTimeValidation(segmentSchema, 'updateTime', validSegmentInput);
    });

    describe('createdBy field', () => {
      testUUIDValidation(segmentSchema, 'createdBy', validSegmentInput);
    });

    describe('updatedBy field', () => {
      testUUIDValidation(segmentSchema, 'updatedBy', validSegmentInput);
    });
  });

  describe('extensible base schema fields', () => {
    describe('description field', () => {
      testOptionalFields(segmentSchema, ['description'], validSegmentInput);

      testStringConstraints(
        segmentSchema,
        'description',
        { ...validSegmentInput, description: 'Test description' },
        { allowEmpty: true }
      );

      it('trims whitespace from description', () => {
        const input = { ...validSegmentInput, description: '  Test description  ' };
        const result = segmentSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.description).toBe('Test description');
        }
      });
    });

    describe('feature field', () => {
      it('accepts valid feature object', () => {
        const input = { ...validSegmentInput, feature: { enabled: true } };
        const result = segmentSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('accepts null feature', () => {
        const input = { ...validSegmentInput, feature: null };
        const result = segmentSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('accepts undefined feature', () => {
        const input = { ...validSegmentInput, feature: undefined };
        const result = segmentSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('name field', () => {
    testRequiredFields(segmentSchema, ['name'], validSegmentInput);

    testStringConstraints(segmentSchema, 'name', validSegmentInput, {
      minLength: 1,
      allowEmpty: false,
    });

    it('trims whitespace from name', () => {
      const input = { ...validSegmentInput, name: '  Test Segment  ' };
      const result = segmentSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Test Segment');
      }
    });
  });

  describe('description field (model-specific)', () => {
    testOptionalFields(
      segmentSchema,
      ['description'],
      validSegmentInput
    );

    testStringConstraints(
      segmentSchema,
      'description',
      { ...validSegmentInput, description: 'Segment description' },
      { allowEmpty: true }
    );
  });

  describe('entityType field', () => {
    testOptionalFields(segmentSchema, ['entityType'], validSegmentInput);
    testEnumValidation(segmentSchema, 'entityType', Object.values(SegmentType), validSegmentInput);
  });

  describe('computeType field', () => {
    testOptionalFields(segmentSchema, ['computeType'], validSegmentInput);
    testEnumValidation(segmentSchema, 'computeType', Object.values(SegmentCalculationType), validSegmentInput);
  });

  describe('status field', () => {
    testOptionalFields(segmentSchema, ['status'], validSegmentInput);
    testEnumValidation(segmentSchema, 'status', Object.values(SegmentStatus), validSegmentInput);
  });

  describe('scheduleConfig field', () => {
    testOptionalFields(segmentSchema, ['scheduleConfig'], validSegmentInput);

    it('accepts valid scheduleConfig object', () => {
      const input = { ...validSegmentInput, scheduleConfig: { cron: '0 * * * *' } };
      const result = segmentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts null scheduleConfig', () => {
      const input = { ...validSegmentInput, scheduleConfig: null };
      const result = segmentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('lastCalculationTime field', () => {
    testOptionalFields(segmentSchema, ['lastCalculationTime'], validSegmentInput);

    testISODateTimeValidation(segmentSchema, 'lastCalculationTime', validSegmentInput);
  });

  describe('conditionGroup field', () => {
    testOptionalFields(segmentSchema, ['conditionGroup'], validSegmentInput);
  });

  describe('rules field', () => {
    testOptionalFields(segmentSchema, ['rules'], validSegmentInput);

    testArrayValidation(segmentSchema, 'rules', validSegmentInput);

    it('applies default value for rules', () => {
      const { rules, ...input } = validSegmentInput;
      const result = segmentSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rules).toEqual([]);
      }
    });
  });

  describe('statistics field', () => {
    testOptionalFields(segmentSchema, ['statistics'], validSegmentInput);
  });

  describe('memberCount field', () => {
    testOptionalFields(segmentSchema, ['memberCount'], validSegmentInput);

    testNumberConstraints(segmentSchema, 'memberCount', validSegmentInput, {
      min: 0,
      isInteger: true,
    });
  });

  describe('nextCalculationTime field', () => {
    testOptionalFields(segmentSchema, ['nextCalculationTime'], validSegmentInput);

    testISODateTimeValidation(segmentSchema, 'nextCalculationTime', validSegmentInput);
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: segmentSchema,
      validCases: [
        {
          input: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Minimal Segment',
            ownedBy: '123e4567-e89b-12d3-a456-426614174001',
            isDeleted: false,
            createTime: '2024-12-31T23:59:59.999Z',
          },
          description: 'minimal required fields',
        },
        {
          input: validSegmentInput,
          description: 'all fields populated',
        },
        {
          input: {
            ...validSegmentInput,
            status: SegmentStatus.INACTIVE,
          },
          description: 'inactive segment',
        },
        {
          input: {
            ...validSegmentInput,
            status: SegmentStatus.DRAFT,
          },
          description: 'draft segment',
        },
        {
          input: {
            ...validSegmentInput,
            entityType: SegmentType.DEVICE,
            computeType: SegmentCalculationType.OFFLINE,
          },
          description: 'device segment with offline compute',
        },
      ],
      invalidCases: [
        {
          input: { description: 'No name' },
          description: 'missing name',
        },
        {
          input: { name: 'Segment', status: 'INVALID_STATUS' },
          description: 'invalid status enum value',
        },
        {
          input: { name: 'Segment', entityType: 'INVALID_TYPE' },
          description: 'invalid entityType enum value',
        },
        {
          input: { name: 'Segment', computeType: 'INVALID_COMPUTE' },
          description: 'invalid computeType enum value',
        },
        {
          input: { ...validSegmentInput, name: '' },
          description: 'empty name',
        },
        {
          input: { ...validSegmentInput, memberCount: -1 },
          description: 'negative memberCount',
        },
      ],
    });
  });
});
