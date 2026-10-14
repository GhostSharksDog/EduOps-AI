import { describe, it, expect } from 'vitest';
import { segmentFeatureSchema } from '@/modules/segment/contracts/schemas/request/segment/segmentFeatureSchema';

describe('segmentFeatureSchema', () => {
  describe('calculationSchedule field', () => {
    it('accepts object with calculation schedule', () => {
      const input = {
        calculationSchedule: {
          frequency: 'daily',
          time: '00:00',
        },
      };
      const result = segmentFeatureSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts empty object', () => {
      const result = segmentFeatureSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('tags field', () => {
    it('accepts array of strings', () => {
      const input = { tags: ['important', 'customer'] };
      const result = segmentFeatureSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('uses default empty array', () => {
      const result = segmentFeatureSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toEqual([]);
      }
    });
  });

  describe('businessOwner field', () => {
    it('accepts valid UUID', () => {
      const input = { businessOwner: '123e4567-e89b-12d3-a456-426614174000' };
      const result = segmentFeatureSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects invalid UUID', () => {
      const input = { businessOwner: 'invalid-uuid' };
      const result = segmentFeatureSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('technicalOwner field', () => {
    it('accepts valid UUID', () => {
      const input = { technicalOwner: '123e4567-e89b-12d3-a456-426614174000' };
      const result = segmentFeatureSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects invalid UUID', () => {
      const input = { technicalOwner: 'invalid-uuid' };
      const result = segmentFeatureSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('complete valid inputs', () => {
    it('accepts all fields', () => {
      const input = {
        calculationSchedule: { frequency: 'weekly' },
        tags: ['enterprise'],
        businessOwner: '123e4567-e89b-12d3-a456-426614174000',
        technicalOwner: '123e4567-e89b-12d3-a456-426614174001',
      };
      const result = segmentFeatureSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('allows unknown fields (passthrough mode)', () => {
      const input = { tags: [], extra: 'field' };
      const result = segmentFeatureSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
});
});
