import {NextRequest,NextResponse} from 'next/server';
import {agentApi,agentService} from '@/modules/agent/server';
export async function GET(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await agentService.listSessions(actor)}));}
