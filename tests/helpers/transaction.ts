import {transaction,type DbClient} from '@/platform/database';
import { generateTestUuid, generateRandomTestUuid, generateTestId, TEST_USER_ID, TEST_ORG_ID, resetTestIdCounter } from './constants';

export {
  TEST_USER_ID,
  TEST_ORG_ID,
  generateTestUuid,
  generateRandomTestUuid,
  generateTestId,
  resetTestIdCounter,
};

export const TEST_ROLLBACK_ERROR = new Error('TEST_ROLLBACK_SENTINEL');

export function isRollbackError(error: unknown): boolean {
  return error === TEST_ROLLBACK_ERROR;
}

export type TransactionClient=DbClient;
function guard(){if(!process.env.DATABASE_URL||!new URL(process.env.DATABASE_URL).pathname.endsWith('_test'))throw new Error('事务测试仅允许专用_test数据库');}
export async function withRollback<T>(work:(client:DbClient)=>Promise<T>):Promise<T>{
 guard();let result:T|undefined;
 try{await transaction(async client=>{result=await work(client);throw TEST_ROLLBACK_ERROR;});}catch(error){if(!isRollbackError(error))throw error;}
 return result as T;
}
export async function withRollbackVoid(work:(client:DbClient)=>Promise<void>):Promise<void>{await withRollback(work);}
