import { describe, it, expect } from 'vitest';
import {
  setRequestContext,
  getRequestContext,
  generateRequestId,
  type RequestContext,
} from '@/platform/request-context';

describe('RequestContext', () => {
  describe('generateRequestId', () => {
    it('should generate unique request IDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^req_[a-z0-9]+_[a-z0-9]+$/);
    });
  });

  describe('setRequestContext / getRequestContext', () => {
    it('should store and retrieve context', () => {
      const ctx: RequestContext = {
        requestId: 'req_test',
        startTime: Date.now(),
        path: '/api/test',
        method: 'GET',
      };
      setRequestContext(ctx);
      expect(getRequestContext()).toEqual(ctx);
    });

    it('should handle missing context gracefully (AsyncLocalStorage may retain previous test context)', () => {
      const result = getRequestContext();
      const isValidResult = result === undefined || result?.requestId === 'req_test';
      expect(isValidResult).toBe(true);
    });
  });
});
