import {jwtVerify,SignJWT} from 'jose';
import type {UserDTO} from '../contracts';
import {config} from '@/platform/config/index';
function jwtKey(){if(config.jwt.secret.length<32)throw new Error('JWT_SECRET至少需要32个字符');return new TextEncoder().encode(config.jwt.secret);}
export async function createLocalJWT(user:UserDTO):Promise<string>{
  return new SignJWT({id:user.id,username:user.username,realName:user.realName,email:user.email,role:user.role,ownedBy:user.ownedBy,companyCode:user.companyCode})
    .setProtectedHeader({alg:'HS256'}).setExpirationTime(config.jwt.expiry).setIssuedAt().sign(jwtKey());
}
export async function verifyJWT(token:string):Promise<Record<string,unknown>>{
  try{const {payload}=await jwtVerify(token,jwtKey(),{algorithms:['HS256']});return payload;}
  catch{throw new Error('Token 无效或已过期');}
}
export async function extractUserFromJWT(token:string):Promise<UserDTO>{
  const p=await verifyJWT(token) as Record<string,string>;
  return {id:p.id,username:p.username,realName:p.realName,email:p.email,role:p.role,ownedBy:p.ownedBy,companyCode:p.companyCode};
}
