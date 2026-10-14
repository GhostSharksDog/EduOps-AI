import {NextRequest,NextResponse} from 'next/server';
import {channels} from '@/modules/analytics/server';
import {channelQuerySchema} from '@/modules/analytics/contracts';
import {agentApi,readAgentBody} from '@/modules/agent/server';
export async function POST(request:NextRequest){return agentApi(request,async actor=>{const input=channelQuerySchema.parse(await readAgentBody(request));const data=await channels.catalogQuery(input.datasetId,{...input.scope,organizationId:actor.organizationId,authorizedCampusIds:[]});return NextResponse.json({status:'ready',message:'渠道目录已读取',data});});}
