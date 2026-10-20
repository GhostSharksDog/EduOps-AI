export interface RequestContext {
  requestId: string;
  userId?: string;
  userRole?: string;
  companyCode?:string;
  startTime: number;
  path: string;
  method: string;
}

type Storage = {
  getStore(): RequestContext | undefined;
  run<T>(ctx:RequestContext,work:()=>T):T;
};

let storage: Storage | null = null;

if (typeof window === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AsyncLocalStorage } = require('async_hooks');
    const ALS = AsyncLocalStorage as new () => Storage;
    storage = new ALS();
  } catch {
    storage = null;
  }
}

export function runWithRequestContext<T>(ctx:RequestContext,work:()=>T):T {
  return storage?storage.run(ctx,work):work();
}

export function getRequestContext(): RequestContext | undefined {
  return storage?.getStore();
}

export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
