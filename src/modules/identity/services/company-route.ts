import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {authMiddleware,getCurrentUser} from './jwt-middleware';
import {runWithCompany} from '@/platform/company/context';
import {CompanyConfigurationError} from '@/platform/company/registry';
import {runWithRequestContext,generateRequestId} from '@/platform/request-context';

// 认证和公司连接选择都在路由请求内执行，不能依靠 Proxy 的异步上下文跨边界传递。
export function withCompanyRoute<Context>(handler:(request:NextRequest,context:Context)=>Promise<Response>|Response){
 return async function(request:NextRequest,context:Context):Promise<Response>{
  const denial=await authMiddleware(request);if(denial)return denial;
  const user=getCurrentUser(request);
  if(!user?.companyCode||!user.ownedBy)return NextResponse.json({error:'缺少有效公司身份，请重新登录',errorCode:'COMPANY_CONTEXT_REQUIRED'},{status:401});
  try{const response=await runWithCompany(user.companyCode,()=>runWithRequestContext({requestId:generateRequestId(),userId:user.id,userRole:user.role,companyCode:user.companyCode,startTime:Date.now(),path:request.nextUrl.pathname,method:request.method},()=>handler(request,context)),{userId:user.id,organizationId:user.ownedBy,role:user.role});response.headers.set('Cache-Control','private, no-store');return response;}
  catch(error){if(error instanceof CompanyConfigurationError)return NextResponse.json({error:error.message,errorCode:error.code},{status:503});throw error;}
 };
}
