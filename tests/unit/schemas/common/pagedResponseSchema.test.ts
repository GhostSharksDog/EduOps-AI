import { describe, it, expect } from 'vitest';
import { pagedResponseSchema } from '@/shared/schemas/common/pagedResponseSchema';
import { z } from 'zod';
import { testStrictObject } from '../../../helpers/schema-test-utils';

describe('pagedResponseSchema', () => {
  const itemSchema = z.object({
    id: z.string(),
    name: z.string(),
  });

  const schema = pagedResponseSchema(itemSchema);

  describe('items validation', () => {
    it('accepts valid items array', () => {
      const input = {
        items: [
          { id: '1', name: 'Item 1' },
          { id: '2', name: 'Item 2' },
        ],
        totalCount: 2,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };
      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts empty items array', () => {
      const input = {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects items with invalid structure', () => {
      const input = {
        items: [{ id: 123, name: 'Item' }], // id should be string
        totalCount: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };
      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects non-array items', () => {
      const input = {
        items: 'not an array',
        totalCount: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('totalCount validation', () => {
    const validInput = {
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    };

    it('accepts totalCount = 0', () => {
      const result = schema.safeParse({ ...validInput, totalCount: 0 });
      expect(result.success).toBe(true);
    });

    it('accepts large totalCount', () => {
      const result = schema.safeParse({ ...validInput, totalCount: 1000000 });
      expect(result.success).toBe(true);
    });

    it('rejects negative totalCount', () => {
      const result = schema.safeParse({ ...validInput, totalCount: -1 });
      expect(result.success).toBe(false);
    });

    it('rejects float totalCount', () => {
      const result = schema.safeParse({ ...validInput, totalCount: 1.5 });
      expect(result.success).toBe(false);
    });

    it('rejects missing totalCount', () => {
      const input = {
        items: [],
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('page validation', () => {
    const validInput = {
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    };

    it('accepts page = 1', () => {
      const result = schema.safeParse({ ...validInput, page: 1 });
      expect(result.success).toBe(true);
    });

    it('accepts large page number', () => {
      const result = schema.safeParse({ ...validInput, page: 1000 });
      expect(result.success).toBe(true);
    });

    it('rejects page = 0', () => {
      const result = schema.safeParse({ ...validInput, page: 0 });
      expect(result.success).toBe(false);
    });

    it('rejects negative page', () => {
      const result = schema.safeParse({ ...validInput, page: -1 });
      expect(result.success).toBe(false);
    });

    it('rejects float page', () => {
      const result = schema.safeParse({ ...validInput, page: 1.5 });
      expect(result.success).toBe(false);
    });

    it('rejects missing page', () => {
      const input = {
        items: [],
        totalCount: 0,
        pageSize: 10,
        totalPages: 0,
      };
      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('pageSize validation', () => {
    const validInput = {
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    };

    it('accepts pageSize = 1', () => {
      const result = schema.safeParse({ ...validInput, pageSize: 1 });
      expect(result.success).toBe(true);
    });

    it('accepts pageSize = 100', () => {
      const result = schema.safeParse({ ...validInput, pageSize: 100 });
      expect(result.success).toBe(true);
    });

    it('rejects pageSize = 0', () => {
      const result = schema.safeParse({ ...validInput, pageSize: 0 });
      expect(result.success).toBe(false);
    });

    it('rejects negative pageSize', () => {
      const result = schema.safeParse({ ...validInput, pageSize: -1 });
      expect(result.success).toBe(false);
    });

    it('rejects float pageSize', () => {
      const result = schema.safeParse({ ...validInput, pageSize: 10.5 });
      expect(result.success).toBe(false);
    });

    it('rejects missing pageSize', () => {
      const input = {
        items: [],
        totalCount: 0,
        page: 1,
        totalPages: 0,
      };
      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('totalPages validation', () => {
    const validInput = {
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    };

    it('accepts totalPages = 0', () => {
      const result = schema.safeParse({ ...validInput, totalPages: 0 });
      expect(result.success).toBe(true);
    });

    it('accepts large totalPages', () => {
      const result = schema.safeParse({ ...validInput, totalPages: 1000 });
      expect(result.success).toBe(true);
    });

    it('rejects negative totalPages', () => {
      const result = schema.safeParse({ ...validInput, totalPages: -1 });
      expect(result.success).toBe(false);
    });

    it('rejects float totalPages', () => {
      const result = schema.safeParse({ ...validInput, totalPages: 1.5 });
      expect(result.success).toBe(false);
    });

    it('rejects missing totalPages', () => {
      const input = {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 10,
      };
      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('strict object validation', () => {
    const validInput = {
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    };

    testStrictObject(schema, validInput);
  });

  describe('complete valid input', () => {
    it('accepts complete valid response', () => {
      const input = {
        items: [
          { id: '1', name: 'First' },
          { id: '2', name: 'Second' },
        ],
        totalCount: 100,
        page: 2,
        pageSize: 20,
        totalPages: 5,
      };
      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(2);
        expect(result.data.totalCount).toBe(100);
        expect(result.data.page).toBe(2);
        expect(result.data.pageSize).toBe(20);
        expect(result.data.totalPages).toBe(5);
      }
    });
  });

  describe('with different item schemas', () => {
    it('works with complex nested item schema', () => {
      const complexItemSchema = z.object({
        id: z.string(),
        user: z.object({
          name: z.string(),
          email: z.string().email(),
        }),
        tags: z.array(z.string()),
      });

      const complexSchema = pagedResponseSchema(complexItemSchema);

      const input = {
        items: [
          {
            id: '1',
            user: { name: 'John', email: 'john@example.com' },
            tags: ['admin', 'user'],
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };

      const result = complexSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects items that do not match complex schema', () => {
      const complexItemSchema = z.object({
        id: z.string(),
        count: z.number().int().positive(),
      });

      const complexSchema = pagedResponseSchema(complexItemSchema);

      const input = {
        items: [{ id: '1', count: -5 }], // negative count
        totalCount: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };

      const result = complexSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('type inference', () => {
    it('correctly infers item type from schema', () => {
      const input = {
        items: [{ id: 'test-id', name: 'Test Name' }],
        totalCount: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);

      if (result.success) {
        // TypeScript should infer these types correctly
        const data = result.data;
        expect(typeof data.items[0].id).toBe('string');
        expect(typeof data.items[0].name).toBe('string');
        expect(typeof data.totalCount).toBe('number');
        expect(typeof data.page).toBe('number');
        expect(typeof data.pageSize).toBe('number');
        expect(typeof data.totalPages).toBe('number');
      }
    });
  });
});
