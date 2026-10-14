import {ConflictException,BusinessException,DatabaseException} from '@/shared/errors/index';
type DatabaseFailure={code:string;constraint?:string};
export function isDatabaseError(error:unknown):error is DatabaseFailure{return !!error&&typeof error==='object'&&'code' in error&&typeof error.code==='string'&&/^[0-9A-Z]{5}$/.test(error.code);}
export function mapDatabaseError(error:DatabaseFailure):never{
 if(error.code==='23505')throw new ConflictException('TAG_VALIDATION_NAME_DUPLICATE',{message:'记录与现有数据冲突'});
 if(error.code==='23503'||error.code==='23514')throw new BusinessException('TAG_BUSINESS_RULE_INVALID',{message:'数据不符合约束'});
 throw new DatabaseException({message:'数据库操作失败',code:error.code});
}
export async function handleDatabaseError<T>(operation:()=>Promise<T>):Promise<T>{try{return await operation();}catch(error){if(isDatabaseError(error))mapDatabaseError(error);throw error;}}
