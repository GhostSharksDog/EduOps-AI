import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {agentApi,readAgentBody} from '@/modules/agent/server';
import {alertService} from '@/modules/alert/server';
import {alertUpdateSchema} from '@/modules/alert/contracts';
type Context={params:Promise<{id:string}>};
async function GETHandler(request:NextRequest,context:Context){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await alertService.get(actor,z.uuid().parse((await context.params).id))}));}
async function PATCHHandler(request:NextRequest,context:Context){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await alertService.update(actor,z.uuid().parse((await context.params).id),alertUpdateSchema.parse(await readAgentBody(request)))}));}

export const GET=withCompanyRoute(GETHandler);
export const PATCH=withCompanyRoute(PATCHHandler);
