import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {agentApi} from '@/modules/agent/server';
import {reportService} from '@/modules/report/server';
async function GETHandler(request:NextRequest,context:{params:Promise<{id:string}>}){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await reportService.get(actor,z.uuid().parse((await context.params).id))}));}

export const GET=withCompanyRoute(GETHandler);
