import {withCompanyRoute} from '@/modules/identity/server';
import {NextRequest,NextResponse} from 'next/server';
import {channels} from '@/modules/analytics/server';
import {channelQuerySchema} from '@/modules/analytics/contracts';
import {agentApi,readAgentBody} from '@/modules/agent/server';
async function POSTHandler(request:NextRequest){return agentApi(request,async actor=>{const input=channelQuerySchema.parse(await readAgentBody(request));const data=await channels.query(input.datasetId,{...input.scope,organizationId:actor.organizationId,authorizedCampusIds:[]});return NextResponse.json({status:'ready',message:'渠道分析已完成',data});});}

export const POST=withCompanyRoute(POSTHandler);
