import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {withCompanyRoute} from '@/modules/identity/server';
import {agentApi,agentService,readAgentBody} from '@/modules/agent/server';
export const maxDuration=130;
async function POSTHandler(request:NextRequest,context:{params:Promise<{id:string}>}){
 return agentApi(request,async actor=>{
  const result=await agentService.retryInterpretation(await readAgentBody(request),actor,z.uuid().parse((await context.params).id));
  return NextResponse.json(result,{status:result.status==='unconfigured'?503:result.status==='error'?502:200,headers:{'Cache-Control':'no-store'}});
 });
}
export const POST=withCompanyRoute(POSTHandler);
