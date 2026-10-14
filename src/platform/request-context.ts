export interface RequestContext {
  requestId: string;
  userId?: string;
  userRole?: string;
  startTime: number;
  path: string;
  method: string;
}

type Storage = {
  getStore(): RequestContext | undefined;
  enterWith(ctx: RequestContext): void;
};

let storage: Storage | null = null;

if (typeof window === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AsyncLocalStorage } = require('async_hooks');
    const ALS = AsyncLocalStorage as new () => { getStore(): RequestContext | undefined; enterWith(ctx: RequestContext): void };
    storage = new ALS();
  } catch {
    storage = null;
  }
}

export function setRequestContext(ctx: RequestContext): void {
  storage?.enterWith(ctx);
}

export function getRequestContext(): RequestContext | undefined {
  return storage?.getStore();
}

export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
