import { describe, it, expect } from 'vitest';
import { segmentListSchema } from '@/modules/segment/contracts/schemas/response/segment/segmentListSchema';
import { segmentSchema } from '@/modules/segment/contracts/schemas/response/segment/segmentSchema';
import { SegmentStatus, SegmentType, SegmentCalculationType } from '@/shared/enums/index';
import {
  testSchema,
  testStrictObject,
} from '../../../../helpers/schema-test-utils';

describe('segmentListSchema', () => {
  const validSegmentItem = {
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

  const validListInput = {
    items: [validSegmentItem],
    totalCount: 1,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  };

  describe('schema structure', () => {
    testStrictObject(segmentListSchema, validListInput);
  });

  describe('paged response fields', () => {
    it('accepts valid paged response', () => {
      const result = segmentListSchema.safeParse(validListInput);
      expect(result.success).toBe(true);
    });

    it('accepts empty list', () => {
      const input = { ...validListInput, items: [] };
      const result = segmentListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts multiple items in list', () => {
      const input = {
        ...validListInput,
        items: [validSegmentItem, validSegmentItem],
        totalCount: 2,
      };
      const result = segmentListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects missing items field', () => {
      const { items, ...input } = validListInput;
      const result = segmentListSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects missing totalCount field', () => {
      const { totalCount, ...input } = validListInput;
      const result = segmentListSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects missing page field', () => {
      const { page, ...input } = validListInput;
      const result = segmentListSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects missing pageSize field', () => {
      const { pageSize, ...input } = validListInput;
      const result = segmentListSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects invalid list items', () => {
      const input = { ...validListInput, items: [{ invalid: 'item' }] };
      const result = segmentListSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: segmentListSchema,
      validCases: [
        {
          input: validListInput,
          description: 'valid segment list',
        },
        {
          input: { items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 },
          description: 'empty list',
        },
        {
          input: { items: [validSegmentItem], totalCount: 1, page: 1, pageSize: 1, totalPages: 1 },
          description: 'single item with pageSize 1',
        },
        {
          input: { items: [validSegmentItem, validSegmentItem], totalCount: 100, page: 2, pageSize: 10, totalPages: 10 },
          description: 'paginated response',
        },
      ],
      invalidCases: [
        {
          input: { totalCount: 1, page: 1, pageSize: 10, totalPages: 1 },
          description: 'missing items',
        },
        {
          input: { items: [], page: 1, pageSize: 10, totalPages: 0 },
          description: 'missing totalCount',
        },
        {
          input: { items: [], totalCount: 0, pageSize: 10, totalPages: 0 },
          description: 'missing page',
        },
        {
          input: { items: [], totalCount: 0, page: 1, totalPages: 0 },
          description: 'missing pageSize',
        },
      ],
    });
  });
});
