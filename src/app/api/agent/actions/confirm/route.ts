import {NextRequest,NextResponse} from 'next/server';
import {agentApi,agentActionService,agentService,readAgentBody} from '@/modules/agent/server';
import {withCompanyRoute} from '@/modules/identity/server';
import {confirmActionPlanSchema} from '@/modules/agent/contracts/actions';
export const maxDuration=180;
async function POSTHandler(request:NextRequest){return agentApi(request,async actor=>{
 const input=confirmActionPlanSchema.parse(await readAgentBody(request)),plan=await agentActionService.confirm(input,actor);
 return NextResponse.json({status:plan.status==='completed'?'ready':'error',message:plan.status==='completed'?'已完成确认的操作':plan.errorMessage??'操作记录已保存，请查看各步骤结果',errorCode:plan.errorCode,data:await agentService.getRun(actor,input.runId)});
});}
export const POST=withCompanyRoute(POSTHandler);
