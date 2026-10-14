import { describe, it, expect } from 'vitest';
import { segmentConditionValueSchema } from '@/modules/segment/contracts/schemas/request/segment/segmentConditionValueSchema';

describe('segmentConditionValueSchema', () => {
  describe('string values', () => {
    it('accepts string value', () => {
      const result = segmentConditionValueSchema.safeParse('test value');
      expect(result.success).toBe(true);
    });

    it('accepts empty string', () => {
      const result = segmentConditionValueSchema.safeParse('');
      expect(result.success).toBe(true);
    });

    it('trims whitespace from string', () => {
      const result = segmentConditionValueSchema.safeParse('  trimmed  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('trimmed');
      }
    });
  });

  describe('number values', () => {
    it('accepts integer', () => {
      const result = segmentConditionValueSchema.safeParse(42);
      expect(result.success).toBe(true);
    });

    it('accepts float', () => {
      const result = segmentConditionValueSchema.safeParse(3.14);
      expect(result.success).toBe(true);
    });

    it('accepts zero', () => {
      const result = segmentConditionValueSchema.safeParse(0);
      expect(result.success).toBe(true);
    });

    it('accepts negative number', () => {
      const result = segmentConditionValueSchema.safeParse(-100);
      expect(result.success).toBe(true);
    });
  });

  describe('boolean values', () => {
    it('accepts true', () => {
      const result = segmentConditionValueSchema.safeParse(true);
      expect(result.success).toBe(true);
    });

    it('accepts false', () => {
      const result = segmentConditionValueSchema.safeParse(false);
      expect(result.success).toBe(true);
    });
  });

  describe('array values', () => {
    it('accepts array of strings', () => {
      const result = segmentConditionValueSchema.safeParse(['a', 'b', 'c']);
      expect(result.success).toBe(true);
    });

    it('accepts array of numbers', () => {
      const result = segmentConditionValueSchema.safeParse([1, 2, 3]);
      expect(result.success).toBe(true);
    });

    it('accepts mixed array of strings and numbers', () => {
      const result = segmentConditionValueSchema.safeParse(['text', 123, 'more', 456]);
      expect(result.success).toBe(true);
    });

    it('accepts empty array', () => {
      const result = segmentConditionValueSchema.safeParse([]);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid types', () => {
    it('rejects object', () => {
      const result = segmentConditionValueSchema.safeParse({ key: 'value' });
      expect(result.success).toBe(false);
    });

    it('rejects null', () => {
      const result = segmentConditionValueSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it('rejects undefined', () => {
      const result = segmentConditionValueSchema.safeParse(undefined);
      expect(result.success).toBe(false);
    });
  });
});
