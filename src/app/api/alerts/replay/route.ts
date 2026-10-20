import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {agentApi,readAgentBody} from '@/modules/agent/server';
import {alertService} from '@/modules/alert/server';
import {alertReplaySchema} from '@/modules/alert/contracts';
async function POSTHandler(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await alertService.replay(actor,alertReplaySchema.parse(await readAgentBody(request)))}));}

export const POST=withCompanyRoute(POSTHandler);
