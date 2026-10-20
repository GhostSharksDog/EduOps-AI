import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {agentApi,getCapability} from '@/modules/agent/server';
async function GETHandler(request:NextRequest){return agentApi(request,()=>NextResponse.json(getCapability()));}

export const GET=withCompanyRoute(GETHandler);
