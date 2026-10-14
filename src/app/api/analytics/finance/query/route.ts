import {NextRequest,NextResponse} from 'next/server';
import {agentApi,readAgentBody} from '@/modules/agent/server';
import {financeAnalytics} from '@/modules/finance/server';
import {financeQuerySchema} from '@/modules/finance/contracts';
export async function POST(request:NextRequest){return agentApi(request,async actor=>{const input=financeQuerySchema.parse(await readAgentBody(request));return NextResponse.json({status:'ready',data:await financeAnalytics.query(input.datasetId,{...input.financeScope,organizationId:actor.organizationId})});});}
