import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {agentApi,agentService} from '@/modules/agent/server';
async function GETHandler(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await agentService.listSessions(actor)}));}

export const GET=withCompanyRoute(GETHandler);
