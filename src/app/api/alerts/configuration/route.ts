import {NextRequest,NextResponse} from 'next/server';
import {agentApi,readAgentBody} from '@/modules/agent/server';
import {alertService} from '@/modules/alert/server';
import {alertRulesUpdateSchema} from '@/modules/alert/contracts';
export async function GET(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await alertService.configuration(actor)}));}
export async function PUT(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await alertService.updateConfiguration(actor,alertRulesUpdateSchema.parse(await readAgentBody(request)))}));}
