import {NextRequest,NextResponse} from 'next/server';
import {agentApi} from '@/modules/agent/server';
import {evaluationService} from '@/modules/decision/server';
export async function GET(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await evaluationService.summary(actor)}));}
