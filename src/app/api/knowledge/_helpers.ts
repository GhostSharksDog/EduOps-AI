import {NextRequest,NextResponse} from 'next/server';
import {ZodError} from 'zod';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {WorkflowError} from '@/shared/errors/workflow-error';
export async function knowledgeRequest(request:NextRequest,run:(user:NonNullable<ReturnType<typeof getCurrentUser>>)=>Promise<NextResponse>){
 const error=await authMiddleware(request);if(error)return error;const user=getCurrentUser(request);if(!user?.ownedBy)return NextResponse.json({status:'error',message:'请先登录'},{status:401});
 try{return await run(user);}catch(e){if(e instanceof ZodError)return NextResponse.json({status:'error',message:'请求参数无效',issues:e.issues},{status:400});if(e instanceof WorkflowError)return NextResponse.json({status:'error',message:e.message,...(e.code?{errorCode:e.code}:{})},{status:e.status});return NextResponse.json({status:'error',message:'知识服务暂不可用，请稍后重试。'},{status:503});}
}
