import {NextRequest,NextResponse} from 'next/server';
import {authMiddleware, getCurrentUser} from '@/modules/identity/server';
export default async function proxy(request:NextRequest){
 const error=await authMiddleware(request);if(error)return error;
 const headers=new Headers(request.headers);
 // 公开标签接口的机构头仅用于选择公开目录，不能建立用户身份。
 const publicSelector = ['/api/public/tags', '/api/public/tags/values'].includes(request.nextUrl.pathname) ? request.headers.get('x-tenant-id') : null;
 for(const name of ['x-user-id','x-tenant-id','x-user-info'])headers.delete(name);
 const user=getCurrentUser(request);
 if(publicSelector)headers.set('x-tenant-id',publicSelector);
 if(user){headers.set('x-user-id',user.id);headers.set('x-tenant-id',user.ownedBy??'');headers.set('x-user-info',Buffer.from(JSON.stringify(user)).toString('base64'));}
 return NextResponse.next({request:{headers}});
}
export const config={matcher:['/api/:path*']};
