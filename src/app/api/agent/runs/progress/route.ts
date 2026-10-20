import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {agentApi,agentService} from '@/modules/agent/server';
const schema=z.object({requestKey:z.uuid().optional(),runId:z.uuid().optional()}).refine(v=>!!v.requestKey!==!!v.runId,{message:'提供一个查询编号'});
async function GETHandler(request:NextRequest){return agentApi(request,async actor=>{const input=schema.parse({requestKey:request.nextUrl.searchParams.get('requestKey')??undefined,runId:request.nextUrl.searchParams.get('runId')??undefined});return NextResponse.json({status:'ready',data:await agentService.progress(actor,input.requestKey,input.runId)},{headers:{'Cache-Control':'no-store'}});});}

export const GET=withCompanyRoute(GETHandler);
