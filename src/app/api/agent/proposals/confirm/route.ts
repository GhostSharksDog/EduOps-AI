import {NextRequest,NextResponse} from 'next/server';
import {agentApi,agentService,readAgentBody} from '@/modules/agent/server';
export async function POST(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',message:'此版本已确认发布',data:await agentService.confirm(await readAgentBody(request),actor)}));}
