import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {agentApi,agentService,readAgentBody} from '@/modules/agent/server';
export const maxDuration=130;
async function POSTHandler(request:NextRequest){return agentApi(request,async actor=>{const result=await agentService.run(await readAgentBody(request),actor);return NextResponse.json(result,{status:result.status==='unconfigured'?503:result.status==='error'?502:200});});}

export const POST=withCompanyRoute(POSTHandler);
