import {NextRequest,NextResponse} from 'next/server';
import {verifyJWT} from './jwt-utils';
import {canAccess} from '../contracts/local';
import type {UserDTO} from '../contracts/schemas/request/auth/userSchema';
import {reloadLocalIdentity} from './local-users';
import {getCompany,getDefaultCompany,CompanyConfigurationError} from '@/platform/company/registry';
import {runWithCompany} from '@/platform/company/context';
export type RequestUser=UserDTO;
const verifiedUsers=new WeakMap<NextRequest,RequestUser>();
export function getCurrentUser(request:NextRequest):RequestUser|null{return verifiedUsers.get(request)??null;}
export function getCurrentUserId(request:NextRequest):string|null{return getCurrentUser(request)?.id??null;}
export async function authMiddleware(request:NextRequest):Promise<NextResponse|undefined>{
 const p=request.nextUrl.pathname;
 if(p==='/api/auth/login'||p==='/api/auth/companies'||p==='/api/health')return;
 const cached=verifiedUsers.get(request);if(cached)return canAccess(cached.role,request.method,p)?undefined:NextResponse.json({error:'当前角色没有此操作权限'},{status:403});
 for(const header of ['x-user-id','x-tenant-id','x-user-info','x-company-code'])request.headers.delete(header);
 const token=request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token)return NextResponse.json({error:'请先登录'},{status:401});
 let claims:Record<string,unknown>;
 try{claims=await verifyJWT(token);}catch{return NextResponse.json({error:'登录已过期，请重新登录'},{status:401});}
 try{
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(typeof claims.id!=='string'||typeof claims.ownedBy!=='string'||!uuid.test(claims.id)||!uuid.test(claims.ownedBy))return NextResponse.json({error:'令牌缺少有效身份信息'},{status:401});
  // 旧令牌只可回到明确配置的原公司，不能以客户端请求头选择数据库。
  const company=typeof claims.companyCode==='string'?getCompany(claims.companyCode):getDefaultCompany();
  if(company.organizationId!==claims.ownedBy)return NextResponse.json({error:'账号所属公司与令牌不一致'},{status:401});
  const user=await runWithCompany(company.code,()=>reloadLocalIdentity(claims.id as string));
  if(!user)return NextResponse.json({error:'账号已停用或不属于当前公司，请重新登录'},{status:401});
  if(!canAccess(user.role,request.method,p))return NextResponse.json({error:'当前角色没有此操作权限'},{status:403});
  verifiedUsers.set(request,user);
  request.headers.set('x-user-id',user.id);request.headers.set('x-tenant-id',user.ownedBy);
  request.headers.set('x-user-info',Buffer.from(JSON.stringify(user)).toString('base64'));
 }catch(error){return NextResponse.json({error:error instanceof CompanyConfigurationError?'公司服务未配置，请联系管理员':'暂时无法验证账号状态，请稍后重试或检查公司服务',errorCode:'IDENTITY_SERVICE_UNAVAILABLE'},{status:503});}
}
export function adminMiddleware(request:NextRequest):NextResponse|undefined{
 if(getCurrentUser(request)?.role!=='admin')return NextResponse.json({error:'需要管理员权限'},{status:403});
}
