import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {agentApi} from '@/modules/agent/server';
import {evaluationService} from '@/modules/decision/server';
async function GETHandler(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await evaluationService.summary(actor)}));}

export const GET=withCompanyRoute(GETHandler);
