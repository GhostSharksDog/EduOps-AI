import {NextRequest,NextResponse} from 'next/server';
export default function proxy(request:NextRequest){
 const headers=new Headers(request.headers);
 // 身份只由 API 路由的统一包装器建立，任何外部身份头都先移除。
 for(const name of ['x-user-id','x-tenant-id','x-user-info','x-company-code'])headers.delete(name);
 return NextResponse.next({request:{headers}});
}
export const config={matcher:['/api/:path*']};
