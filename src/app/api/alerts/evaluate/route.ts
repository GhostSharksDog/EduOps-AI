import {NextRequest,NextResponse} from 'next/server';
import {agentApi,readAgentBody} from '@/modules/agent/server';
import {alertService} from '@/modules/alert/server';
import {alertEvaluationSchema} from '@/modules/alert/contracts';
export async function POST(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await alertService.evaluate(actor,alertEvaluationSchema.parse(await readAgentBody(request)))}));}
