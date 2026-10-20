import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {agentApi} from '@/modules/agent/server';
import {decisionService} from '@/modules/decision/server';
async function GETHandler(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await decisionService.owners(actor)}));}

export const GET=withCompanyRoute(GETHandler);
