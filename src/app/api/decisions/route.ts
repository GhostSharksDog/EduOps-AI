import {NextRequest,NextResponse} from 'next/server';
import {agentApi,readAgentBody} from '@/modules/agent/server';
import {decisionService} from '@/modules/decision/server';
import {decisionCreateSchema} from '@/modules/decision/contracts';
export async function GET(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await decisionService.list(actor)}));}
export async function POST(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await decisionService.create(actor,decisionCreateSchema.parse(await readAgentBody(request)))}));}
