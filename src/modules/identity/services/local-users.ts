import 'server-only';
import {queryOne} from '@/platform/database';
import {verifyPassword} from '../domain/password';
import type {LocalUser} from '../contracts/local';
import {requireCompanyContext} from '@/platform/company/context';
export async function authenticateLocalUser(username:string,password:string):Promise<LocalUser|null>{
 const {company}=requireCompanyContext();
 const user=await queryOne<{id:string;username:string;passwordHash:string;realName:string;email:string|null;role:string;organizationId:string;enabled:boolean}>('SELECT id,username,password_hash AS "passwordHash",real_name AS "realName",email,role,organization_id AS "organizationId",enabled FROM local_user WHERE username=$1 AND organization_id=$2',[username,company.organizationId]);
 // 不存在的用户仍计算密码，避免通过快速响应枚举账号。
 const fallback='scrypt:00000000000000000000000000000000:'+'00'.repeat(64);
 const valid=await verifyPassword(password,user?.passwordHash??fallback);
 if(!user||!user.enabled||!valid)return null;
 return {id:user.id,username:user.username,realName:user.realName,email:user.email??'',role:user.role as LocalUser['role'],ownedBy:user.organizationId,companyCode:company.code,companyName:company.name};
}
export async function reloadLocalIdentity(id:string):Promise<LocalUser|null>{
 const {company}=requireCompanyContext();
 const user=await queryOne<{id:string;username:string;realName:string;email:string|null;role:LocalUser['role'];organizationId:string;enabled:boolean}>('SELECT id,username,real_name AS "realName",email,role,organization_id AS "organizationId",enabled FROM local_user WHERE id=$1 AND organization_id=$2',[id,company.organizationId]);
 if(!user?.enabled||!['admin','operator','viewer'].includes(user.role))return null;
 return {id:user.id,username:user.username,realName:user.realName,email:user.email??'',role:user.role,ownedBy:user.organizationId,companyCode:company.code,companyName:company.name};
}
