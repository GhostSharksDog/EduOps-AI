import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {agentApi,agentService} from '@/modules/agent/server';
export async function GET(request:NextRequest,context:{params:Promise<{id:string}>}){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await agentService.getSession(actor,z.uuid().parse((await context.params).id))}));}
