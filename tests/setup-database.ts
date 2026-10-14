import {beforeAll,afterAll} from 'vitest';
import {db} from '@/platform/database';
beforeAll(async()=>{const url=process.env.DATABASE_URL;if(!url||!new URL(url).pathname.endsWith('_test'))throw new Error('禁止连接非专用测试数据库');await db.query('SELECT 1');});
afterAll(async()=>{await db.end();});
