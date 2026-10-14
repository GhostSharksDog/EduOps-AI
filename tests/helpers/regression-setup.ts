import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// 纯单元测试禁止未显式模拟的数据库访问。
vi.mock('@/platform/database', () => {
  const fail=()=>{throw new Error('单元测试禁止访问数据库，请显式提供 pg mock');};
  return {db:{query:fail,connect:fail,end:fail},queryRows:fail,queryOne:fail,execute:fail,transaction:fail,
    mapRow:(row:Record<string,unknown>,overrides:Record<string,string>={})=>Object.fromEntries(Object.entries(row).map(([key,value])=>[overrides[key]??key.replace(/_([a-z])/g,(_,letter:string)=>letter.toUpperCase()),value]))};
});

vi.mock('@/platform/logger', () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn(), trace: vi.fn(), child: vi.fn() };
  logger.child.mockReturnValue(logger);
  return { log: logger, logger, default: logger };
});

vi.mock('ioredis', async () => {
  const { EventEmitter } = await import('node:events');
  class RedisMock extends EventEmitter {
    status = 'wait';
    connect = vi.fn(async () => { this.status = 'ready'; this.emit('connect'); });
    ping = vi.fn(async () => 'PONG');
    quit = vi.fn(async () => { this.status = 'end'; this.emit('close'); return 'OK'; });
    disconnect = vi.fn(() => { this.status = 'end'; this.emit('close'); });
  }
  return { default: RedisMock, Redis: RedisMock };
});

// 防止测试中漏掉 mock 的外部依赖隐式连接数据库。
vi.mock('node:net', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:net')>();
  return {
    ...original,
    createConnection: vi.fn(() => { throw new Error('单元测试禁止网络连接'); }),
    connect: vi.fn(() => { throw new Error('单元测试禁止网络连接'); }),
  };
});
