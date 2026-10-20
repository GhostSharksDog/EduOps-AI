import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {agentApi} from '@/modules/agent/server';
import {alertService} from '@/modules/alert/server';
async function GETHandler(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await alertService.list(actor,request.nextUrl.searchParams.get('active')==='true')}));}

export const GET=withCompanyRoute(GETHandler);
