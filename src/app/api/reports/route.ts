import {NextRequest,NextResponse} from 'next/server';
import {agentApi,readAgentBody} from '@/modules/agent/server';
import {reportService} from '@/modules/report/server';
import {reportInputSchema} from '@/modules/report/contracts';
export async function GET(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await reportService.list(actor)}));}
export async function POST(request:NextRequest){return agentApi(request,async actor=>{const data=await reportService.generate(actor,reportInputSchema.parse(await readAgentBody(request)));return NextResponse.json({status:data.status==='failed'?'error':data.status==='generating'?'running':'ready',message:data.errorMessage,data});});}
