import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {agentApi,readAgentBody} from '@/modules/agent/server';
import {decisionService} from '@/modules/decision/server';
import {decisionCreateSchema} from '@/modules/decision/contracts';
async function GETHandler(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await decisionService.list(actor)}));}
async function POSTHandler(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await decisionService.create(actor,decisionCreateSchema.parse(await readAgentBody(request)))}));}

export const GET=withCompanyRoute(GETHandler);
export const POST=withCompanyRoute(POSTHandler);
