import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {agentApi,readAgentBody} from '@/modules/agent/server';
import {decisionService} from '@/modules/decision/server';
import {decisionUpdateSchema} from '@/modules/decision/contracts';
type Context={params:Promise<{id:string}>};
export async function GET(request:NextRequest,context:Context){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await decisionService.get(actor,z.uuid().parse((await context.params).id))}));}
export async function PATCH(request:NextRequest,context:Context){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await decisionService.update(actor,z.uuid().parse((await context.params).id),decisionUpdateSchema.parse(await readAgentBody(request)))}));}
