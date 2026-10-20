import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {agentApi} from '@/modules/agent/server';
import {runtimeDiagnosticsService} from '@/modules/system/server';
export const dynamic='force-dynamic';
async function GETHandler(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await runtimeDiagnosticsService.query(actor)},{headers:{'Cache-Control':'no-store'}}));}

export const GET=withCompanyRoute(GETHandler);
