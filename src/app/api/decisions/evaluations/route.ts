import {NextRequest,NextResponse} from 'next/server';
import {agentApi,readAgentBody} from '@/modules/agent/server';
import {evaluationService} from '@/modules/decision/server';
import {evaluationCreateSchema} from '@/modules/decision/contracts/evaluation';
import {z} from 'zod';
export async function GET(request:NextRequest){return agentApi(request,async actor=>{const filters=z.object({reportId:z.uuid().optional(),status:z.enum(['completed','failed']).optional(),method:z.enum(['template','direct_model','tool_agent']).optional()}).strict().parse(Object.fromEntries(request.nextUrl.searchParams));return NextResponse.json({status:'ready',data:await evaluationService.list(actor,filters)});});}
export async function POST(request:NextRequest){return agentApi(request,async actor=>{const input=evaluationCreateSchema.parse(await readAgentBody(request));return NextResponse.json({status:'ready',data:await evaluationService.compare(actor,input.reportId,input.caseId)});});}
