import {NextRequest,NextResponse} from 'next/server';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import type {AgentActor} from '../contracts';
import {AgentError} from '../domain/errors';
import {safeAgentError} from './service';
export async function agentApi(request:NextRequest,operation:(actor:AgentActor)=>Promise<NextResponse>|NextResponse):Promise<NextResponse>{
  const denied=await authMiddleware(request);if(denied)return denied;
  const user=getCurrentUser(request);
  if(!user?.id||!user.ownedBy)return NextResponse.json({status:'error',message:'请先登录',data:null},{status:401});
  try{return await operation({userId:user.id,organizationId:user.ownedBy,role:user.role});}
  catch(error){const safe=safeAgentError(error);return NextResponse.json({status:'error',message:safe.message,errorCode:safe.code,data:null},{status:safe.status});}
}
export async function readAgentBody(request:NextRequest):Promise<unknown>{
  if(Number(request.headers.get('content-length')??0)>64000)throw new AgentError('INVALID_ARGUMENTS','请求内容过长',400);
  try{return await request.json();}catch{throw new AgentError('INVALID_ARGUMENTS','请求须为有效JSON',400);}
}
