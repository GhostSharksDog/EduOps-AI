import {NextRequest,NextResponse} from 'next/server';
import {agentApi,agentActionService,agentService,readAgentBody} from '@/modules/agent/server';
import {withCompanyRoute} from '@/modules/identity/server';
import {editActionPlanSchema} from '@/modules/agent/contracts/actions';
async function PATCHHandler(request:NextRequest){return agentApi(request,async actor=>{
 const input=editActionPlanSchema.parse(await readAgentBody(request));await agentActionService.edit(input,actor);
 return NextResponse.json({status:'ready',message:'操作计划已更新，请重新核对确认卡',data:await agentService.getRun(actor,input.runId)});
});}
export const PATCH=withCompanyRoute(PATCHHandler);
