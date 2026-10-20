import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {agentApi,readAgentBody} from '@/modules/agent/server';
import {evaluationService} from '@/modules/decision/server';
async function PATCHHandler(request:NextRequest,context:{params:Promise<{id:string}>}){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await evaluationService.rate(actor,z.uuid().parse((await context.params).id),await readAgentBody(request))}));}

export const PATCH=withCompanyRoute(PATCHHandler);
