import { describe, it, expect } from 'vitest';
import { featureSchema } from '@/shared/schemas/common/featureSchema';

describe('featureSchema', () => {
  describe('primitive types', () => {
    it('accepts string', () => {
      const result = featureSchema.safeParse('test string');
      expect(result.success).toBe(true);
    });

    it('accepts empty string', () => {
      const result = featureSchema.safeParse('');
      expect(result.success).toBe(true);
    });

    it('accepts number', () => {
      const result = featureSchema.safeParse(42);
      expect(result.success).toBe(true);
    });

    it('accepts zero', () => {
      const result = featureSchema.safeParse(0);
      expect(result.success).toBe(true);
    });

    it('accepts negative number', () => {
      const result = featureSchema.safeParse(-100);
      expect(result.success).toBe(true);
    });

    it('accepts float', () => {
      const result = featureSchema.safeParse(3.14159);
      expect(result.success).toBe(true);
    });

    it('accepts boolean true', () => {
      const result = featureSchema.safeParse(true);
      expect(result.success).toBe(true);
    });

    it('accepts boolean false', () => {
      const result = featureSchema.safeParse(false);
      expect(result.success).toBe(true);
    });

    it('accepts null', () => {
      const result = featureSchema.safeParse(null);
      expect(result.success).toBe(true);
    });
  });

  describe('array types', () => {
    it('accepts empty array', () => {
      const result = featureSchema.safeParse([]);
      expect(result.success).toBe(true);
    });

    it('accepts array of strings', () => {
      const result = featureSchema.safeParse(['a', 'b', 'c']);
      expect(result.success).toBe(true);
    });

    it('accepts array of numbers', () => {
      const result = featureSchema.safeParse([1, 2, 3]);
      expect(result.success).toBe(true);
    });

    it('accepts array of booleans', () => {
      const result = featureSchema.safeParse([true, false, true]);
      expect(result.success).toBe(true);
    });

    it('accepts array of nulls', () => {
      const result = featureSchema.safeParse([null, null]);
      expect(result.success).toBe(true);
    });

    it('accepts mixed type array', () => {
      const result = featureSchema.safeParse(['text', 123, true, null]);
      expect(result.success).toBe(true);
    });

    it('accepts nested arrays', () => {
      const result = featureSchema.safeParse([[1, 2], [3, 4]]);
      expect(result.success).toBe(true);
    });

    it('accepts deeply nested arrays', () => {
      const result = featureSchema.safeParse([[[[1]]]]);
      expect(result.success).toBe(true);
    });

    it('accepts array with objects', () => {
      const result = featureSchema.safeParse([{ id: 1 }, { id: 2 }]);
      expect(result.success).toBe(true);
    });
  });

  describe('object types', () => {
    it('accepts empty object', () => {
      const result = featureSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts object with string values', () => {
      const result = featureSchema.safeParse({ name: 'test' });
      expect(result.success).toBe(true);
    });

    it('accepts object with number values', () => {
      const result = featureSchema.safeParse({ count: 10 });
      expect(result.success).toBe(true);
    });

    it('accepts object with boolean values', () => {
      const result = featureSchema.safeParse({ active: true });
      expect(result.success).toBe(true);
    });

    it('accepts object with null values', () => {
      const result = featureSchema.safeParse({ data: null });
      expect(result.success).toBe(true);
    });

    it('accepts object with array values', () => {
      const result = featureSchema.safeParse({ items: [1, 2, 3] });
      expect(result.success).toBe(true);
    });

    it('accepts object with nested object values', () => {
      const result = featureSchema.safeParse({ nested: { deep: 'value' } });
      expect(result.success).toBe(true);
    });

    it('accepts complex nested object', () => {
      const input = {
        level1: {
          level2: {
            level3: {
              value: 'deep',
              array: [1, 2, { mixed: true }],
            },
          },
        },
      };
      const result = featureSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts object with multiple key types', () => {
      const input = {
        string: 'text',
        number: 123,
        boolean: true,
        null: null,
        array: [1, 'two', false],
        nested: { key: 'value' },
      };
      const result = featureSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid types', () => {
    it('rejects function', () => {
      const result = featureSchema.safeParse(() => {});
      expect(result.success).toBe(false);
    });

    it('rejects Symbol', () => {
      const result = featureSchema.safeParse(Symbol('test'));
      expect(result.success).toBe(false);
    });

    it('rejects Date object', () => {
      const result = featureSchema.safeParse(new Date());
      expect(result.success).toBe(false);
    });

    it('rejects Map', () => {
      const result = featureSchema.safeParse(new Map());
      expect(result.success).toBe(false);
    });

    it('rejects Set', () => {
      const result = featureSchema.safeParse(new Set());
      expect(result.success).toBe(false);
    });
  });

  describe('optional field behavior', () => {
    it('accepts undefined (optional)', () => {
      const result = featureSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });
  });

  describe('type inference', () => {
    it('preserves string type', () => {
      const result = featureSchema.safeParse('test');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data).toBe('string');
        expect(result.data).toBe('test');
      }
    });

    it('preserves number type', () => {
      const result = featureSchema.safeParse(42);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data).toBe('number');
        expect(result.data).toBe(42);
      }
    });

    it('preserves object structure', () => {
      const input = { key: 'value', nested: { data: 123 } };
      const result = featureSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(input);
      }
    });

    it('preserves array structure', () => {
      const input = [1, 2, 3, 'four'];
      const result = featureSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(input);
      }
    });
  });

  describe('real-world use cases', () => {
    it('accepts feature flags object', () => {
      const input = {
        enabled: true,
        variants: ['A', 'B'],
        config: { threshold: 0.5 },
      };
      const result = featureSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts metadata object', () => {
      const input = {
        version: '1.0.0',
        author: 'team',
        tags: ['core', 'api'],
        deprecated: false,
      };
      const result = featureSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts settings object', () => {
      const input = {
        theme: 'dark',
        notifications: {
          email: true,
          push: false,
        },
        limits: [10, 20, 30],
      };
      const result = featureSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});
