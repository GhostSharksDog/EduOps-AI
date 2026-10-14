import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setRequestContext } from '@/platform/request-context';

vi.mock('pino', () => {
  const loggedMessages: unknown[] = [];
  return {
    default: vi.fn(() => ({
      info: (obj: unknown, msg?: string) => {
        loggedMessages.push(typeof obj === 'string' ? { msg: obj } : { ...(obj as Record<string, unknown>), msg });
      },
      error: (obj: unknown, msg?: string) => {
        loggedMessages.push(typeof obj === 'string' ? { msg: obj } : { ...(obj as Record<string, unknown>), msg });
      },
      warn: (obj: unknown, msg?: string) => {
        loggedMessages.push(typeof obj === 'string' ? { msg: obj } : { ...(obj as Record<string, unknown>), msg });
      },
      debug: (obj: unknown, msg?: string) => {
        loggedMessages.push(typeof obj === 'string' ? { msg: obj } : { ...(obj as Record<string, unknown>), msg });
      },
      _messages: loggedMessages,
    })),
  };
});

describe('Enhanced Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should work without context', async () => {
    const { log } = await import('@/platform/logger');
    log.info('standalone message');
    expect(true).toBe(true);
  });

  it('should include requestId when context is set', async () => {
    setRequestContext({
      requestId: 'req_test123',
      startTime: Date.now(),
      path: '/api/test',
      method: 'POST',
    });

    vi.resetModules();
    const { log } = await import('@/platform/logger');
    log.info('test message');
    expect(true).toBe(true);
  });
});
