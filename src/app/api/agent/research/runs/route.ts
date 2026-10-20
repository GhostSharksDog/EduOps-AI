import {NextRequest,NextResponse} from 'next/server';
import {withCompanyRoute} from '@/modules/identity/server';
import {agentApi,agentResearchService} from '@/modules/agent/server';
async function GETHandler(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await agentResearchService.list(actor)}));}
export const GET=withCompanyRoute(GETHandler);
