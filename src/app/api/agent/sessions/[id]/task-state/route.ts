import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {agentApi,agentService,readAgentBody} from '@/modules/agent/server';
import {taskStatePatchSchema} from '@/modules/agent/contracts';

async function PATCHHandler(request:NextRequest,context:{params:Promise<{id:string}>}){
 return agentApi(request,async actor=>{
  const id=z.uuid().parse((await context.params).id),input=taskStatePatchSchema.parse(await readAgentBody(request));
  return NextResponse.json({status:'ready',data:await agentService.updateTaskState(actor,id,input)});
 });
}
export const PATCH=withCompanyRoute(PATCHHandler);
