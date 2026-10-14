import {NextRequest,NextResponse} from 'next/server';
import {extractUserFromJWT} from './jwt-utils';
import {canAccess} from '../contracts/local';
import type {UserDTO} from '../contracts/schemas/request/auth/userSchema';
export type RequestUser=UserDTO;
const verifiedUsers=new WeakMap<NextRequest,RequestUser>();
export function getCurrentUser(request:NextRequest):RequestUser|null{return verifiedUsers.get(request)??null;}
export function getCurrentUserId(request:NextRequest):string|null{return getCurrentUser(request)?.id??null;}
export async function authMiddleware(request:NextRequest):Promise<NextResponse|undefined>{
 const p=request.nextUrl.pathname;
 if(p==='/api/auth/login'||p==='/api/health'||p.startsWith('/api/health/')||p.startsWith('/api/public/'))return;
 verifiedUsers.delete(request);
 const token=request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token)return NextResponse.json({error:'请先登录'},{status:401});
 try{
  const user=await extractUserFromJWT(token);
  if(!user.id||!user.ownedBy)return NextResponse.json({error:'令牌缺少身份信息'},{status:401});
  if(!canAccess(user.role,request.method,p))return NextResponse.json({error:'当前角色没有此操作权限'},{status:403});
  verifiedUsers.set(request,user);
  request.headers.set('x-user-id',user.id);request.headers.set('x-tenant-id',user.ownedBy);
  request.headers.set('x-user-info',Buffer.from(JSON.stringify(user)).toString('base64'));
 }catch{return NextResponse.json({error:'登录已过期，请重新登录'},{status:401});}
}
export function adminMiddleware(request:NextRequest):NextResponse|undefined{
 if(getCurrentUser(request)?.role!=='admin')return NextResponse.json({error:'需要管理员权限'},{status:403});
}
