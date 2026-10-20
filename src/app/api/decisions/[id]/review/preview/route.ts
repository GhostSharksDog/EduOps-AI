import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {agentApi,readAgentBody} from '@/modules/agent/server';
import {decisionService} from '@/modules/decision/server';
import {reviewPreviewInputSchema} from '@/modules/decision/contracts';
type Context={params:Promise<{id:string}>};
async function POSTHandler(request:NextRequest,context:Context){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await decisionService.previewReview(actor,z.uuid().parse((await context.params).id),reviewPreviewInputSchema.parse(await readAgentBody(request)))}));}

export const POST=withCompanyRoute(POSTHandler);
