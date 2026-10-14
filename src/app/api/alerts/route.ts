import {NextRequest,NextResponse} from 'next/server';
import {agentApi} from '@/modules/agent/server';
import {alertService} from '@/modules/alert/server';
export async function GET(request:NextRequest){return agentApi(request,async actor=>NextResponse.json({status:'ready',data:await alertService.list(actor,request.nextUrl.searchParams.get('active')==='true')}));}
