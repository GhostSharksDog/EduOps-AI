import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {agentApi,readAgentBody} from '@/modules/agent/server';
import {alertService} from '@/modules/alert/server';
import {alertRulesUpdateSchema} from '@/modules/alert/contracts';
async function GETHandler(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await alertService.configuration(actor)}));}
async function PUTHandler(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await alertService.updateConfiguration(actor,alertRulesUpdateSchema.parse(await readAgentBody(request)))}));}

export const GET=withCompanyRoute(GETHandler);
export const PUT=withCompanyRoute(PUTHandler);
