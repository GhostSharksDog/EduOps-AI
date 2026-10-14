import {NextRequest,NextResponse} from 'next/server';
import {agentApi} from '@/modules/agent/server';
import {decisionService} from '@/modules/decision/server';
export async function GET(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await decisionService.owners(actor)}));}
