import { describe, it, expect } from 'vitest';
import { TagValueStatus } from '@/shared/enums/tag/TagValueStatus';
import type { TagValue } from '@/modules/tag/domain/entities/TagValue';
import type { JsonValue } from 'fast-check';

describe('TagValue Entity (Value Object) - domain', () => {
  it('should create a valid TagValue with primitive string value', () => {
    const tv: TagValue = {
      id: 'tv-001',
      tagId: 'tag-001',
      entityId: 'entity-001',
      value: 'hello' as JsonValue,
      calculatedAt: new Date('2026-03-21T00:00:00Z'),
      calculatedVersion: 'v1',
      status: TagValueStatus.VALID,
    };

    expect(tv.id).toBe('tv-001');
    expect(tv.tagId).toBe('tag-001');
    expect(tv.entityId).toBe('entity-001');
    expect(tv.value).toBe('hello');
    expect(tv.calculatedAt).toBeInstanceOf(Date);
    expect(tv.calculatedVersion).toBe('v1');
    expect(tv.status).toBe(TagValueStatus.VALID);
  });

  it('should support complex JSON value', () => {
    const payload: JsonValue = { a: 1, b: ['x', true], c: { nested: 'yes' } } as any;
    const tv: TagValue = {
      id: 'tv-002',
      tagId: 'tag-001',
      entityId: 'entity-001',
      value: payload,
      calculatedAt: new Date(),
      calculatedVersion: 'v2',
      status: TagValueStatus.VALID,
    };
    expect(tv.value).toEqual(payload);
  });

  it('should allow null as value', () => {
    const tv: TagValue = {
      id: 'tv-003',
      tagId: 'tag-001',
      entityId: 'entity-001',
      value: null as any,
      calculatedAt: new Date(),
      calculatedVersion: 'v3',
      status: TagValueStatus.INVALID,
    };
    expect(tv.value).toBeNull();
    expect(tv.status).toBe(TagValueStatus.INVALID);
  });
});
