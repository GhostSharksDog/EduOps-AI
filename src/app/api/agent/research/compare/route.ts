import {NextRequest,NextResponse} from 'next/server';
import {withCompanyRoute} from '@/modules/identity/server';
import {agentApi,readAgentBody,agentResearchService} from '@/modules/agent/server';
async function POSTHandler(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await agentResearchService.compare(actor,await readAgentBody(request))}));}
export const POST=withCompanyRoute(POSTHandler);
